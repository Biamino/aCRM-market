import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { q } from "./db.js";

export const UPLOAD_DIR = join(process.cwd(), "uploads");
export const MAX_IMAGES_PER_COLOR = 8;

/** Папка с фото CRM (CRM_UPLOAD_DIR бэкенда + /products). Пусто — отдаём фото через сам бэкенд CRM. */
export const CRM_PHOTO_DIR = process.env.CRM_UPLOAD_DIR ? join(process.env.CRM_UPLOAD_DIR, "products") : "";
export const CRM_API_ORIGIN = (process.env.CRM_API_ORIGIN ?? "http://localhost:8080").replace(/\/+$/, "");

export function ensureUploadDir(...segments: string[]) {
  const dir = join(UPLOAD_DIR, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function toPublicUrl(filePath: string) {
  if (!filePath) return "";
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return filePath.startsWith("/") ? filePath : `/${filePath}`;
}

export function diskPathFromUrl(filePath: string) {
  const relative = filePath.replace(/^\/+/, "").replace(/^uploads\/?/, "");
  return join(UPLOAD_DIR, relative);
}

/** Имя файла фото CRM безопасно для пути (как safe_photo_filename в бэкенде). */
export const safeCrmPhotoName = (name: string) => /^[A-Za-z0-9._-]{1,180}$/.test(name) && !name.includes("..");

export interface ProductImage {
  id: number;
  url: string;
}

/** Ключ цвета: фото маркета без цвета — общие для модели. */
export const colorKey = (color: string | null | undefined) => (color ?? "").trim().toLowerCase();

export interface ProductMedia {
  /** фото маркета по цветам (ключ colorKey; "" — общие для модели) */
  web: Map<string, ProductImage[]>;
  /** фото, загруженные в CRM (product_photos) */
  crm: string[];
}

export async function mediaByProduct(productIds: number[]): Promise<Map<number, ProductMedia>> {
  const map = new Map<number, ProductMedia>();
  if (productIds.length === 0) return map;
  const ph = productIds.map(() => "?").join(",");
  const [web, crm] = await Promise.all([
    q(
      `SELECT id, product_id, color, file_path FROM web_product_images
       WHERE product_id IN (${ph}) ORDER BY sort_order, id`,
      productIds,
    ),
    q(
      `SELECT product_id, filename FROM product_photos
       WHERE product_id IN (${ph}) ORDER BY product_id, sort_order, id`,
      productIds,
    ),
  ]);
  const entry = (pid: number) => {
    let m = map.get(pid);
    if (!m) map.set(pid, (m = { web: new Map(), crm: [] }));
    return m;
  };
  for (const r of web) {
    const m = entry(Number(r.product_id)).web;
    const key = colorKey(r.color);
    m.set(key, [...(m.get(key) ?? []), { id: Number(r.id), url: toPublicUrl(r.file_path) }]);
  }
  for (const r of crm) entry(Number(r.product_id)).crm.push(`/api/crm-photos/${encodeURIComponent(r.filename)}`);
  return map;
}

/**
 * Галерея цвета: фото маркета этого цвета → общие фото маркета → фото из CRM →
 * старая обложка web_product_details.image_url.
 */
export function galleryUrls(media: ProductMedia | undefined, color: string | null, fallbackUrl: string | null) {
  const own = media?.web.get(colorKey(color));
  if (own?.length) return own.map((i) => i.url);
  const common = media?.web.get("");
  if (common?.length) return common.map((i) => i.url);
  if (media?.crm.length) return media.crm;
  return fallbackUrl ? [fallbackUrl] : [];
}
