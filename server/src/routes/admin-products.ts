import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { extname } from "node:path";
import { Router } from "express";
import multer from "multer";
import { exec, one, q } from "../db.js";
import { CATEGORY_JOIN, CATEGORY_SQL } from "../crm.js";
import {
  colorKey,
  diskPathFromUrl,
  ensureUploadDir,
  MAX_IMAGES_PER_COLOR,
  mediaByProduct,
  toPublicUrl,
} from "../product-media.js";
import { stockByProduct } from "./catalog.js";

export const adminProductsRouter = Router();

const PAGE_SIZE = 40;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        cb(null, ensureUploadDir("products", String(Number(req.params.productId))));
      } catch (e) {
        cb(e as Error, "");
      }
    },
    filename: (_req, file, cb) => {
      const ext = ALLOWED_MIME[file.mimetype] ?? extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: MAX_IMAGES_PER_COLOR },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) cb(null, true);
    else cb(new Error("Можно загрузить только JPEG, PNG или WebP"));
  },
});

function parseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
}

/** Цвет из запроса: пусто — общие фото модели. */
const colorParam = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 80) : "");

async function upsertVisibility(productIds: number[], isVisible: boolean) {
  if (productIds.length === 0) return;
  const ph = productIds.map(() => "(?, ?)").join(",");
  const params = productIds.flatMap((id) => [id, isVisible ? 1 : 0]);
  await exec(
    `INSERT INTO web_product_details (product_id, is_visible) VALUES ${ph}
     ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)`,
    params,
  );
}

adminProductsRouter.get("/products", async (req, res) => {
  const { category, q: search, visibility } = req.query as {
    category?: string;
    q?: string;
    visibility?: string;
  };
  const page = Math.max(1, Number(req.query.page ?? 1));

  const where: string[] = ["p.is_archived = 0"];
  const params: unknown[] = [];
  if (category) {
    where.push(`${CATEGORY_SQL} = ?`);
    params.push(category);
  }
  if (search?.trim()) {
    where.push("(p.title LIKE ? OR p.sku LIKE ?)");
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }
  if (visibility === "visible") where.push("COALESCE(d.is_visible, 0) = 1");
  if (visibility === "hidden") where.push("COALESCE(d.is_visible, 0) = 0");

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const fromSql = `FROM products p ${CATEGORY_JOIN} LEFT JOIN web_product_details d ON d.product_id = p.id`;

  const [countRow, stats, categories, rows] = await Promise.all([
    one(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`, params),
    one(
      `SELECT
         SUM(CASE WHEN COALESCE(d.is_visible, 0) = 1 THEN 1 ELSE 0 END) AS visible_count,
         SUM(CASE WHEN COALESCE(d.is_visible, 0) = 0 THEN 1 ELSE 0 END) AS hidden_count
       FROM products p
       LEFT JOIN web_product_details d ON d.product_id = p.id
       WHERE p.is_archived = 0`,
    ),
    q(
      `SELECT ${CATEGORY_SQL} AS name, COUNT(*) AS cnt
       FROM products p ${CATEGORY_JOIN} WHERE p.is_archived = 0
       GROUP BY name ORDER BY name`,
    ),
    q(
      `SELECT p.id, p.sku, p.title, ${CATEGORY_SQL} AS category, p.wholesale_price,
              COALESCE(d.is_visible, 0) AS is_visible, d.image_url
       ${fromSql} ${whereSql}
       ORDER BY COALESCE(d.is_visible, 0) DESC, category, p.title
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
  ]);

  const productIds = rows.map((r) => Number(r.id));
  const [stock, media] = await Promise.all([stockByProduct(productIds), mediaByProduct(productIds)]);

  res.json({
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    visibleCount: Number(stats?.visible_count ?? 0),
    hiddenCount: Number(stats?.hidden_count ?? 0),
    categories: categories.map((c) => ({ name: c.name, count: Number(c.cnt) })),
    products: rows.map((r) => {
      const pid = Number(r.id);
      const m = media.get(pid);
      // секции фото: каждый цвет CRM + «общие» (без цвета)
      const colors = [...(stock.get(pid)?.colors ?? []).map((c) => ({ color: c.color, hex: c.hex })), { color: "", hex: null }];
      const sections = colors.map((c) => {
        const pics = m?.web.get(colorKey(c.color)) ?? [];
        return { color: c.color, hex: c.hex, photoCount: pics.length, images: pics, coverUrl: pics[0]?.url ?? null };
      });
      const cover = sections.find((s) => s.coverUrl)?.coverUrl ?? m?.crm[0] ?? r.image_url ?? "";
      return {
        id: pid,
        sku: r.sku,
        title: r.title,
        category: r.category,
        price: Number(r.wholesale_price),
        isVisible: Boolean(Number(r.is_visible)),
        imageUrl: cover,
        photoCount: sections.reduce((s, v) => s + v.photoCount, 0),
        crmPhotoCount: m?.crm.length ?? 0,
        colors: sections,
      };
    }),
  });
});

adminProductsRouter.patch("/products/:id/visibility", async (req, res) => {
  const productId = Number(req.params.id);
  const isVisible = Boolean(req.body?.isVisible);
  const product = await one("SELECT id FROM products WHERE id = ? AND is_archived = 0", [productId]);
  if (!product) return res.status(404).json({ error: "Товар не найден" });
  await upsertVisibility([productId], isVisible);
  res.json({ productId, isVisible });
});

adminProductsRouter.post("/products/visibility/bulk", async (req, res) => {
  const productIds = parseIds(req.body?.productIds);
  const isVisible = Boolean(req.body?.isVisible);
  if (productIds.length === 0) return res.status(400).json({ error: "Не выбраны товары" });
  const existing = await q(
    `SELECT id FROM products WHERE is_archived = 0 AND id IN (${productIds.map(() => "?").join(",")})`,
    productIds,
  );
  const ids = existing.map((r) => Number(r.id));
  await upsertVisibility(ids, isVisible);
  res.json({ updated: ids.length, isVisible });
});

/** Условие «фото этого цвета» (пустой цвет — общие фото модели). */
const colorWhere = (color: string) =>
  color ? { sql: "color = ?", params: [color] } : { sql: "(color IS NULL OR color = '')", params: [] };

// ?color= — цвет из CRM; без него фото общие для модели
adminProductsRouter.post(
  "/products/:productId/images",
  async (req, res, next) => {
    const product = await one("SELECT id FROM products WHERE id = ?", [Number(req.params.productId)]);
    if (!product) return res.status(404).json({ error: "Товар не найден" });
    next();
  },
  (req, res, next) => {
    upload.array("photos", MAX_IMAGES_PER_COLOR)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message ?? "Не удалось загрузить файл" });
      next();
    });
  },
  async (req, res) => {
    const productId = Number(req.params.productId);
    const color = colorParam(req.query.color);
    const where = colorWhere(color);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) return res.status(400).json({ error: "Выберите хотя бы одно фото" });

    const current = await one<{ cnt: number; m: number | null }>(
      `SELECT COUNT(*) AS cnt, MAX(sort_order) AS m FROM web_product_images WHERE product_id = ? AND ${where.sql}`,
      [productId, ...where.params],
    );
    if (Number(current?.cnt ?? 0) + files.length > MAX_IMAGES_PER_COLOR) {
      await Promise.all(files.map((f) => unlink(f.path).catch(() => undefined)));
      return res.status(400).json({
        error: `Можно загрузить не больше ${MAX_IMAGES_PER_COLOR} фото на цвет`,
      });
    }

    let order = Number(current?.m ?? -1) + 1;
    const created: { id: number; url: string }[] = [];
    for (const file of files) {
      const publicPath = `/uploads/products/${productId}/${file.filename}`;
      const id = await exec(
        "INSERT INTO web_product_images (product_id, color, file_path, sort_order) VALUES (?, ?, ?, ?)",
        [productId, color || null, publicPath, order],
      );
      created.push({ id, url: toPublicUrl(publicPath) });
      order += 1;
    }
    res.json({ images: created });
  },
);

adminProductsRouter.delete("/products/:productId/images/:imageId", async (req, res) => {
  const productId = Number(req.params.productId);
  const imageId = Number(req.params.imageId);
  const row = await one("SELECT id, file_path FROM web_product_images WHERE id = ? AND product_id = ?", [
    imageId,
    productId,
  ]);
  if (!row) return res.status(404).json({ error: "Фото не найдено" });
  await exec("DELETE FROM web_product_images WHERE id = ?", [imageId]);
  if (!/^https?:\/\//i.test(row.file_path)) await unlink(diskPathFromUrl(row.file_path)).catch(() => undefined);
  res.json({ message: "Фото удалено" });
});

adminProductsRouter.patch("/products/:productId/images/order", async (req, res) => {
  const productId = Number(req.params.productId);
  const imageIds = parseIds(req.body?.imageIds);
  if (imageIds.length === 0) return res.status(400).json({ error: "Некорректный список фото" });
  const existing = await q(
    `SELECT id FROM web_product_images WHERE product_id = ? AND id IN (${imageIds.map(() => "?").join(",")})`,
    [productId, ...imageIds],
  );
  if (existing.length !== imageIds.length) return res.status(400).json({ error: "Некорректный список фото" });
  for (const [index, id] of imageIds.entries()) {
    await exec("UPDATE web_product_images SET sort_order = ? WHERE id = ?", [index, id]);
  }
  res.json({ message: "Порядок обновлён" });
});
