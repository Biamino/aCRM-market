import { SITE } from "../site";

/** Контакты сайта; телефон, WhatsApp и адрес — свои у каждого сайта (client/site-profiles.ts). */
export const COMPANY = {
  brand: "ASDEM",
  city: "Бишкек",
  country: "Кыргызская Республика",
  email: "asemaidinova.asdem@gmail.com",
  phone: SITE.phone,
  siteUrl: SITE.siteUrl,
  whatsapp: SITE.whatsapp,
  whatsappDisplay: SITE.whatsappDisplay,
  timezone: "Asia/Bishkek (UTC+6)",
  docsUpdatedAt: "26 октября 2026 г.",
} as const;
