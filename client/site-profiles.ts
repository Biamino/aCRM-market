/**
 * Профили сайтов: один код — два домена. Сайт выбирается режимом сборки
 * (`vite build --mode pijamy`, см. client/.env.pijamy). Отсюда берут тексты index.html
 * (vite.config.ts), заголовки страниц и контакты (src/site.ts).
 */
export interface SiteProfile {
  /** название в title, превью ссылок и разметке */
  name: string;
  /** телефон для документов и schema.org */
  phone: string;
  /** WhatsApp менеджера: только цифры в международном формате (пусто — кнопки ведут на e-mail) и для показа */
  whatsapp: string;
  whatsappDisplay: string;
  siteUrl: string;
  /** title главной (до 60–65 знаков) */
  title: string;
  /** description главной (120–160 знаков) */
  description: string;
  /** заголовок и описание превью ссылки в мессенджерах */
  ogTitle: string;
  ogDescription: string;
  /** название иконки на телефоне (site.webmanifest) */
  appName: string;
  /** описание организации в schema.org */
  orgDescription: string;
  /** текст для роботов без JavaScript */
  noscript: string;
  registerDescription: string;
}

export const SITE_PROFILES = {
  asdem: {
    name: "ASDEM",
    phone: "+996 500 622 622",
    whatsapp: "996501595411",
    whatsappDisplay: "+996 501 595 411",
    siteUrl: "https://asdem.shop",
    title: "Женское нижнее бельё оптом от производителя — ASDEM",
    description:
      "Женское нижнее бельё ASDEM оптом от производителя: бюстгальтеры, трусы, комплекты, майки, бельё для школьниц. Заказ от одной упаковки, доставка по СНГ.",
    ogTitle: "ASDEM — женское нижнее бельё оптом",
    ogDescription: "Бюстгальтеры, трусы, комплекты, майки и бельё для школьниц от производителя. Заказ от одной упаковки.",
    appName: "ASDEM — бельё оптом",
    orgDescription:
      "Производитель и оптовый поставщик женского нижнего белья: бюстгальтеры, лифчики, трусы, комплекты, майки, бельё для школьниц.",
    noscript:
      "ASDEM — женское нижнее бельё оптом от производителя: бюстгальтеры, трусы, комплекты, майки, бельё для школьниц. Для работы сайта включите JavaScript.",
    registerDescription:
      "Заявка на доступ к оптовому шоуруму женского белья ASDEM: после одобрения — цены, наличие и заказ от одной упаковки.",
  },
  pijamy: {
    name: "ASDEM Пижамы",
    phone: "+996 772 17 95 59",
    whatsapp: "996772179559",
    whatsappDisplay: "+996 772 17 95 59",
    siteUrl: "https://asdem-pijamy.shop",
    title: "Пижамы и пеньюары оптом от производителя — ASDEM Пижамы",
    description:
      "Пижамы оптом, пеньюары, комплекты, корсеты, секси-бельё, утяжки, купальники и спортивная одежда от производителя. Заказ от одной упаковки, доставка по СНГ.",
    ogTitle: "ASDEM Пижамы — пижамы и пеньюары оптом",
    ogDescription: "Пижамы, пеньюары, корсеты, утяжки, купальники и накидки от производителя. Заказ от одной упаковки.",
    appName: "ASDEM Пижамы — опт",
    orgDescription:
      "Производитель и оптовый поставщик пижам, пеньюаров, комплектов, корсетов, секси-белья, утяжек, спортивной одежды, трусов, купальников и накидок.",
    noscript:
      "ASDEM Пижамы — пижамы, пеньюары, комплекты, корсеты, утяжки, купальники и спортивная одежда оптом от производителя. Для работы сайта включите JavaScript.",
    registerDescription:
      "Заявка на доступ к оптовому шоуруму ASDEM Пижамы: после одобрения — цены, наличие и заказ от одной упаковки.",
  },
} satisfies Record<string, SiteProfile>;

export type SiteId = keyof typeof SITE_PROFILES;

export const siteIdOf = (value: string | undefined): SiteId => (value === "pijamy" ? "pijamy" : "asdem");
