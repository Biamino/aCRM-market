import { Router } from "express";
import { num, one, q } from "../db.js";
import { optionalAuth } from "../auth.js";
import { CATEGORY_JOIN, CATEGORY_SQL } from "../crm.js";
import { colorKey, galleryUrls, mediaByProduct, type ProductMedia } from "../product-media.js";

export const catalogRouter = Router();

const PAGE_SIZE = 48;

const canSeePrices = (user?: { status: string }) => user?.status === "APPROVED";

const ON_SHOWCASE = "p.is_archived = 0 AND COALESCE(d.is_visible, 0) = 1";
const FROM_PRODUCTS = `FROM products p ${CATEGORY_JOIN} LEFT JOIN web_product_details d ON d.product_id = p.id`;

interface ModelRow {
  product_id: number;
  sku: string;
  title: string;
  category: string;
  wholesale_price: string;
  image_url: string | null;
  fabric: string | null;
  composition: string | null;
  season: string | null;
  country: string | null;
  fit_notes: string | null;
  web_description: string | null;
}

export interface ModelColor {
  color: string;
  hex: string | null;
}

/** Складские данные модели. В CRM остаток общий на модель, цвета — в product_colors. */
export interface ModelStock {
  colors: ModelColor[];
  /** основной складской вариант (product_variants), на него оформляются позиции заказа */
  variantId: number | null;
  composition: Record<string, number>;
  fullPacks: number;
}

/** Цвет «по умолчанию» CRM ставит, когда цвет при создании не указан. */
const isRealColor = (c: string | null | undefined) => Boolean(c?.trim()) && c!.trim().toLowerCase() !== "default";

export async function stockByProduct(productIds: number[]): Promise<Map<number, ModelStock>> {
  const map = new Map<number, ModelStock>();
  if (productIds.length === 0) return map;
  const ph = productIds.map(() => "?").join(",");

  const [colorRows, variantRows, templates, packs] = await Promise.all([
    q(`SELECT product_id, color, color_hex FROM product_colors WHERE product_id IN (${ph}) ORDER BY id`, productIds),
    q(`SELECT id, product_id, color FROM product_variants WHERE product_id IN (${ph}) ORDER BY id`, productIds),
    q(
      `SELECT pt.variant_id, s.title AS size, pt.qty
       FROM pack_templates pt
       JOIN sizes s ON s.id = pt.size_id
       JOIN product_variants v ON v.id = pt.variant_id
       WHERE v.product_id IN (${ph})
       ORDER BY s.sort_order, s.id`,
      productIds,
    ),
    q(
      `SELECT v.product_id, COUNT(*) AS packs
       FROM packs pk JOIN product_variants v ON v.id = pk.variant_id
       WHERE v.product_id IN (${ph}) AND pk.status = 'full'
       GROUP BY v.product_id`,
      productIds,
    ),
  ]);

  const byVariant = new Map<number, Record<string, number>>();
  for (const t of templates) {
    const m = byVariant.get(Number(t.variant_id)) ?? {};
    m[t.size] = Number(t.qty);
    byVariant.set(Number(t.variant_id), m);
  }

  for (const pid of productIds) {
    const variants = variantRows.filter((v) => Number(v.product_id) === pid);
    // основной вариант — первый (ensure_variant_for_color в CRM), состав пачки — у первого с шаблоном
    const primary = variants[0] ? Number(variants[0].id) : null;
    const withTemplate = variants.find((v) => byVariant.has(Number(v.id)));
    let colors: ModelColor[] = colorRows
      .filter((c) => Number(c.product_id) === pid)
      .map((c) => ({ color: c.color, hex: c.color_hex || null }));
    if (colors.length === 0) {
      // старые товары: цвета жили только в вариантах
      const seen = new Set<string>();
      colors = variants
        .filter((v) => isRealColor(v.color) && !seen.has(colorKey(v.color)) && seen.add(colorKey(v.color)))
        .map((v) => ({ color: v.color, hex: null }));
    }
    map.set(pid, {
      colors,
      variantId: primary,
      composition: withTemplate ? byVariant.get(Number(withTemplate.id))! : {},
      fullPacks: 0,
    });
  }
  for (const p of packs) {
    const entry = map.get(Number(p.product_id));
    if (entry) entry.fullPacks = Number(p.packs);
  }
  return map;
}

function pickColor(colors: ModelColor[], wanted?: string, search?: string): ModelColor | null {
  if (colors.length === 0) return null;
  if (wanted) {
    const exact = colors.find((c) => colorKey(c.color) === colorKey(wanted));
    if (exact) return exact;
  }
  const term = search?.trim().toLowerCase();
  if (term) {
    const match = colors.find((c) => c.color.toLowerCase().includes(term));
    if (match) return match;
  }
  return colors[0];
}

function serialize(
  row: ModelRow,
  stock: ModelStock | undefined,
  media: ProductMedia | undefined,
  user: { status: string } | undefined,
  selected: ModelColor | null,
  full = false,
) {
  const visible = canSeePrices(user);
  const packComposition = stock?.composition ?? {};
  const packSize = Object.values(packComposition).reduce((s, n) => s + n, 0);
  const stockPacks = stock?.fullPacks ?? 0;
  const inStock = stockPacks > 0;
  const urls = galleryUrls(media, selected?.color ?? null, row.image_url);

  const base: Record<string, unknown> = {
    id: Number(row.product_id),
    productId: Number(row.product_id),
    variantId: stock?.variantId ?? null,
    model: row.sku,
    name: row.title,
    color: selected?.color ?? "",
    colorHex: selected?.hex ?? null,
    colors: (stock?.colors ?? []).map((c) => ({
      color: c.color,
      hex: c.hex,
      imageUrl: galleryUrls(media, c.color, row.image_url)[0] ?? "",
      // остаток общий на модель — наличие одинаково для всех цветов
      inStock,
    })),
    imageUrl: urls[0] ?? "",
    imageUrls: urls,
    category: row.category,
    sizes: Object.keys(packComposition),
    packComposition,
    packSize,
    allowUnits: false,
    // V2-W04/W01: гость не видит цену и точные остатки; персональная скидка — на весь заказ (orders.ts)
    price: visible ? Math.round(num(row.wholesale_price)) : null,
    stockPacks: visible ? stockPacks : null,
    inStock,
  };
  if (full) {
    Object.assign(base, {
      fabric: row.fabric,
      composition: row.composition,
      season: row.season,
      country: row.country,
      fitNotes: row.fit_notes,
      description: row.web_description,
    });
  }
  return base;
}

const MODEL_SELECT = `
  SELECT p.id AS product_id, p.sku, p.title, ${CATEGORY_SQL} AS category, p.wholesale_price,
         d.image_url, d.fabric, d.composition, d.season, d.country, d.fit_notes, d.web_description
  ${FROM_PRODUCTS}`;

// V2-W03: каталог из общей базы CRM — модель на витрине, цвета из product_colors
catalogRouter.get("/products", optionalAuth, async (req, res) => {
  const { category, q: search } = req.query as { category?: string; q?: string };
  const page = Math.max(1, Number(req.query.page ?? 1));

  const where: string[] = [ON_SHOWCASE];
  const params: unknown[] = [];
  if (category) {
    where.push(`${CATEGORY_SQL} = ?`);
    params.push(category);
  }
  if (search) {
    where.push(
      `(p.title LIKE ? OR p.sku LIKE ?
        OR EXISTS (SELECT 1 FROM product_colors cx WHERE cx.product_id = p.id AND cx.color LIKE ?)
        OR EXISTS (SELECT 1 FROM product_variants vx WHERE vx.product_id = p.id AND vx.color LIKE ?))`,
    );
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [countRow, rows] = await Promise.all([
    one(`SELECT COUNT(*) AS total ${FROM_PRODUCTS} ${whereSql}`, params),
    q<ModelRow>(
      `${MODEL_SELECT} ${whereSql}
       ORDER BY p.id DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params,
    ),
  ]);

  const productIds = rows.map((r) => Number(r.product_id));
  const [stock, media] = await Promise.all([stockByProduct(productIds), mediaByProduct(productIds)]);

  res.json({
    pricesVisible: canSeePrices(req.user),
    total: Number(countRow?.total ?? 0),
    page,
    pageSize: PAGE_SIZE,
    products: rows.map((row) => {
      const pid = Number(row.product_id);
      const s = stock.get(pid);
      return serialize(row, s, media.get(pid), req.user, pickColor(s?.colors ?? [], undefined, search));
    }),
  });
});

// /products/:id — id модели (products.id), ?color= — выбранный цвет
catalogRouter.get("/products/:id", optionalAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const row = await one<ModelRow>(`${MODEL_SELECT} WHERE p.id = ? AND ${ON_SHOWCASE}`, [productId]);
  if (!row) return res.status(404).json({ error: "Товар не найден" });

  const [stock, media] = await Promise.all([stockByProduct([productId]), mediaByProduct([productId])]);
  const s = stock.get(productId);
  const color = typeof req.query.color === "string" ? req.query.color : undefined;
  res.json({
    pricesVisible: canSeePrices(req.user),
    product: serialize(row, s, media.get(productId), req.user, pickColor(s?.colors ?? [], color), true),
  });
});

/** Обложка модели: общие фото → фото первого цвета → фото CRM → старая обложка. */
function coverUrl(media: ProductMedia | undefined, fallbackUrl: string | null) {
  return galleryUrls(media, null, null)[0] ?? [...(media?.web.values() ?? [])][0]?.[0]?.url ?? fallbackUrl ?? "";
}

// категории витрины: число моделей и обложка — самая новая модель категории
// категории, как и модели, видны только одобренным партнёрам; гостю — пустой список
catalogRouter.get("/categories", optionalAuth, async (req, res) => {
  if (!canSeePrices(req.user)) return res.json({ categories: [] });
  const rows = await q(
    `SELECT ${CATEGORY_SQL} AS name, COUNT(*) AS cnt, MAX(p.id) AS cover_id
     ${FROM_PRODUCTS}
     WHERE ${ON_SHOWCASE}
     GROUP BY name ORDER BY cnt DESC`,
  );
  const coverIds = rows.map((r) => Number(r.cover_id));
  const [media, details] = await Promise.all([
    mediaByProduct(coverIds),
    coverIds.length
      ? q(`SELECT product_id, image_url FROM web_product_details WHERE product_id IN (${coverIds.map(() => "?").join(",")})`, coverIds)
      : Promise.resolve([]),
  ]);
  const fallback = new Map(details.map((d) => [Number(d.product_id), d.image_url as string | null]));
  res.json({
    categories: rows.map((r, i) => ({
      id: i + 1,
      name: r.name,
      count: Number(r.cnt),
      imageUrl: coverUrl(media.get(Number(r.cover_id)), fallback.get(Number(r.cover_id)) ?? null),
    })),
  });
});
