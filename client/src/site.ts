import { SITE_PROFILES, siteIdOf, type SiteProfile } from "../site-profiles";

/** Сайт этой сборки: asdem.shop или asdem-pijamy.shop (VITE_SITE, см. client/.env.pijamy). */
export const SITE_ID = siteIdOf(import.meta.env.VITE_SITE);

export const SITE: SiteProfile = SITE_PROFILES[SITE_ID];
