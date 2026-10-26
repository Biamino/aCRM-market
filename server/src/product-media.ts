import { existsSync, mkdirSync } from "node:fs";
import { readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import sharp from "sharp";

// без файлового кэша libvips: иначе на Windows удаление только что прочитанного фото падает с EBUSY
sharp.cache(false);
import { branch, q } from "./db.js";

// у каждого сайта своя папка (UPLOAD_DIR в env), по умолчанию — uploads рядом с сервером
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
export const MAX_IMAGES_PER_COLOR = 8;


export function ensureUploadDir(...segments: string[]) {
  const dir = join(UPLOAD_DIR, ...segments);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ширина превью для сетки каталога; полное фото — не больше FULL_SIZE по длинной стороне. */
export const THUMB_WIDTH = 640;
const FULL_SIZE = 1600;

/** Превью сжатого фото: `<uuid>.opt.webp` → `<uuid>.opt-640.webp` (у старых загрузок превью нет). */
export const thumbPath = (filePath: string) =>
  /\.opt\.webp$/.test(filePath) ? filePath.replace(/\.opt\.webp$/, `.opt-${THUMB_WIDTH}.webp`) : null;

/**
 * Сжимает загруженное фото: WebP до 1600 px и превью 640 px, ориентация по EXIF, оригинал удаляется.
 * Фото с телефона на 5–6 МБ превращается примерно в 150–300 КБ. Возвращает имя нового файла.
 */
export async function optimizeUpload(path: string): Promise<string> {
  const input = await readFile(path); // читаем целиком: выходной файл может совпасть с входным
  const base = path.replace(/\.[^.\/]+$/, "");
  const image = sharp(input, { failOn: "error" }).rotate();
  await Promise.all([
    image
      .clone()
      .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(`${base}.opt.webp`),
    image
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(`${base}.opt-${THUMB_WIDTH}.webp`),
  ]);
  await unlink(path);
  return `${basename(base)}.opt.webp`;
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

/** Ширины превью фото CRM (`/api/crm-photos/…?w=`): миниатюры, сетка каталога, карточка товара. */
export const CRM_PHOTO_WIDTHS = [160, 320, 640, 1280] as const;

const variantJobs = new Map<string, Promise<string>>();

/**
 * Превью фото CRM в WebP нужной ширины. Оригиналы CRM — JPEG ~1280 px по 200–500 КБ,
 * превью 320 px весит ~15 КБ. Делается один раз и лежит в UPLOAD_DIR/.cache (express.static
 * точечные папки не отдаёт); имя файла CRM уникально, поэтому кэш не устаревает.
 */
export function crmPhotoVariant(source: string, branchId: string, file: string, width: number): Promise<string> {
  const target = join(UPLOAD_DIR, ".cache", "crm", branchId, String(width), `${file}.webp`);
  if (existsSync(target)) return Promise.resolve(target);
  let job = variantJobs.get(target);
  if (!job) {
    job = (async () => {
      mkdirSync(dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      await sharp(await readFile(source), { failOn: "error" })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(tmp);
      await rename(tmp, target);
      return target;
    })().finally(() => variantJobs.delete(target));
    variantJobs.set(target, job);
  }
  return job;
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
  // у каждого филиала своя CRM со своими файлами фото
  const prefix = `/api/crm-photos/${branch().id}`;
  for (const r of crm) entry(Number(r.product_id)).crm.push(`${prefix}/${encodeURIComponent(r.filename)}`);
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
