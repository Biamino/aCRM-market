/**
 * Размеры фото товаров. Сервер отдаёт две версии:
 * - загруженные в маркет `*.opt.webp` (1600 px) с превью `*.opt-640.webp`;
 * - фото CRM `/api/crm-photos/…` — оригинал JPEG, а с `?w=160|320|640|1280` сжатое WebP-превью.
 */
const CRM_PHOTO = /^\/api\/crm-photos\//;
const OPT_WEBP = /\.opt\.webp$/;
const CRM_WIDTHS = [160, 320, 640, 1280];

/** Фото не уже `width` px (для мест без srcSet). */
export function sizedImage(src: string, width: number): string {
  if (CRM_PHOTO.test(src)) return `${src}?w=${CRM_WIDTHS.find((w) => w >= width) ?? 1280}`;
  if (OPT_WEBP.test(src) && width <= 640) return src.replace(OPT_WEBP, ".opt-640.webp");
  return src;
}

/** srcSet для <img>; undefined — у фото одна версия. */
export function imageSrcSet(src: string): string | undefined {
  if (CRM_PHOTO.test(src)) return CRM_WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(", ");
  if (OPT_WEBP.test(src)) return `${src.replace(OPT_WEBP, ".opt-640.webp")} 640w, ${src} 1600w`;
  return undefined;
}
