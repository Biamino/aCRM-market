import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import express, { Router, type Request } from "express";
import { BRANCHES, DEFAULT_BRANCH, findBranch, q, one, runInBranch, type Branch } from "./db.js";
import { CATEGORY_JOIN, CATEGORY_SQL } from "./crm.js";
import { galleryUrls, mediaByProduct } from "./product-media.js";

/** Публичный адрес маркета: канонические ссылки, OG, sitemap. */
export const SITE_URL = (process.env.SITE_URL ?? "https://asdem.kg").replace(/\/+$/, "");

const LEGAL_SLUGS = ["terms", "privacy", "offer", "cookies", "consent", "returns"];
const ON_SHOWCASE = "p.is_archived = 0 AND COALESCE(d.is_visible, 0) = 1";

/** Ссылка на товар: филиал в адресе, если он не первый — id товаров в филиалах совпадают. */
const productUrl = (b: Branch, id: number) =>
  `${SITE_URL}/product/${id}${b.id === DEFAULT_BRANCH.id ? "" : `?branch=${encodeURIComponent(b.id)}`}`;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const seoRouter = Router();

seoRouter.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /cart",
      "Disallow: /orders",
      "Disallow: /login",
      "Disallow: /api/",
      "",
      `Sitemap: ${SITE_URL}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

// витрина всех филиалов: главная, категории, модели, юр. документы
seoRouter.get("/sitemap.xml", async (_req, res) => {
  const urls: { loc: string; lastmod?: string }[] = [{ loc: `${SITE_URL}/` }, { loc: `${SITE_URL}/register` }];
  const categories = new Set<string>();
  for (const b of BRANCHES) {
    const rows = await runInBranch(b, () =>
      q(
        `SELECT p.id, ${CATEGORY_SQL} AS category, p.created_at
         FROM products p ${CATEGORY_JOIN} LEFT JOIN web_product_details d ON d.product_id = p.id
         WHERE ${ON_SHOWCASE} ORDER BY p.id DESC LIMIT 5000`,
      ),
    );
    for (const r of rows) {
      if (r.category) categories.add(r.category);
      urls.push({ loc: productUrl(b, Number(r.id)), lastmod: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : undefined });
    }
  }
  for (const c of categories) urls.push({ loc: `${SITE_URL}/?category=${encodeURIComponent(c)}` });
  for (const slug of LEGAL_SLUGS) urls.push({ loc: `${SITE_URL}/legal/${slug}` });

  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${xml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
      .join("\n")}\n</urlset>\n`,
  );
});

interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
}

const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`);

/** Мета модели для превью ссылки в мессенджерах (они не выполняют JS SPA). */
async function productMeta(req: Request, id: number): Promise<PageMeta | null> {
  const b = findBranch(req.query.branch) ?? DEFAULT_BRANCH;
  return runInBranch(b, async () => {
    const row = await one(
      `SELECT p.id, p.sku, p.title, ${CATEGORY_SQL} AS category, d.web_description, d.image_url
       FROM products p ${CATEGORY_JOIN} LEFT JOIN web_product_details d ON d.product_id = p.id
       WHERE p.id = ? AND ${ON_SHOWCASE}`,
      [id],
    );
    if (!row) return null;
    const media = await mediaByProduct([id]);
    const image = galleryUrls(media.get(id), null, row.image_url)[0] ?? [...(media.get(id)?.web.values() ?? [])][0]?.[0]?.url;
    const lead = row.web_description || `${row.category ?? "Модель"} ASDEM, артикул ${row.sku}.`;
    return {
      title: `${row.title} — ${row.sku} | ASDEM опт`,
      description: `${lead} Оптом от одной упаковки, цены после одобрения заявки.`.slice(0, 300),
      url: productUrl(b, id),
      image: image ? absolute(image) : undefined,
      type: "product",
    };
  });
}

/** Подменяет title, description, canonical и OG в index.html. */
export function injectMeta(html: string, meta: PageMeta): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${e(meta.title)}</title>`)
    .replace(/(<meta name="description"\s+content=")[^"]*"/, `$1${e(meta.description)}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${e(meta.url)}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${e(meta.url)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${e(meta.title)}"`)
    .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${e(meta.title)}"`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${e(meta.description)}"`)
    .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${e(meta.description)}"`);
  if (meta.type) out = out.replace(/(<meta property="og:type" content=")[^"]*"/, `$1${meta.type}"`);
  if (meta.image) {
    out = out
      .replace(/(<meta property="og:image" content=")[^"]*"/, `$1${e(meta.image)}"`)
      .replace(/(<meta name="twitter:image" content=")[^"]*"/, `$1${e(meta.image)}"`)
      // размеры и alt относились к общей картинке
      .replace(/\s*<meta property="og:image:(width|height|alt)"[^>]*>/g, "");
  }
  return out;
}

/** Каталог собранного клиента: CLIENT_DIST или ../client/dist рядом с сервером. */
export function clientDist(): string | null {
  const dir = resolve(process.env.CLIENT_DIST ?? join(process.cwd(), "..", "client", "dist"));
  return existsSync(join(dir, "index.html")) ? dir : null;
}

/**
 * Раздача собранного SPA: хешированные ассеты — кэш на год, index.html — без кэша,
 * для страниц моделей — свои title/OG. Подключается, только если клиент собран.
 */
export function spaRouter(dir: string): Router {
  const router = Router();
  const template = () => readFileSync(join(dir, "index.html"), "utf8");
  router.use("/assets", express.static(join(dir, "assets"), { immutable: true, maxAge: "1y", index: false }));
  router.use(express.static(dir, { index: false, maxAge: "1d" }));
  router.get(/^\/(?!api\/|uploads\/).*/, async (req, res, next) => {
    try {
      let html = template();
      const m = req.path.match(/^\/product\/(\d+)$/);
      if (m) {
        const meta = await productMeta(req, Number(m[1]));
        if (meta) html = injectMeta(html, meta);
      }
      res.set("Cache-Control", "no-cache").type("html").send(html);
    } catch (e) {
      next(e);
    }
  });
  return router;
}
