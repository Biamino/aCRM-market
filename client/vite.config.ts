import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { SITE_PROFILES, siteIdOf, type SiteProfile } from "./site-profiles.ts";

/** Публичный адрес маркета для canonical/OG/JSON-LD в index.html (тот же SITE_URL, что у сервера). */
const siteUrl = (site: SiteProfile) => (process.env.SITE_URL ?? site.siteUrl).replace(/\/+$/, "");

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Тексты сайта в index.html (%SITE_NAME%, %SEO_TITLE%…) и site.webmanifest — из профиля сборки. */
const siteProfile = (site: SiteProfile): Plugin => {
  const manifest = JSON.stringify(
    {
      name: site.appName,
      short_name: site.name,
      lang: "ru",
      start_url: "/",
      display: "standalone",
      background_color: "#fafafb",
      theme_color: "#2e2939",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  );
  const values: Record<string, string> = {
    SITE_URL: siteUrl(site),
    SITE_NAME: site.name,
    SITE_PHONE: site.phone.replace(/\s/g, ""),
    SEO_TITLE: site.title,
    SEO_DESCRIPTION: site.description,
    OG_TITLE: site.ogTitle,
    OG_DESCRIPTION: site.ogDescription,
    ORG_DESCRIPTION: site.orgDescription,
    NOSCRIPT: site.noscript,
  };
  return {
    name: "asdem-site-profile",
    transformIndexHtml: (html) => html.replace(/%([A-Z_]+)%/g, (m, key: string) => (key in values ? attr(values[key]) : m)),
    configureServer(server) {
      server.middlewares.use("/site.webmanifest", (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json");
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "site.webmanifest", source: manifest });
    },
  };
};

export default defineConfig(({ mode }) => {
  // режим сборки = сайт: --mode pijamy → asdem-pijamy.shop, иначе asdem.shop
  const site = SITE_PROFILES[siteIdOf(mode)];
  // бэкенд для dev-прокси: у каждого сайта свой (API_ORIGIN=http://localhost:4001 для pijamy)
  const api = process.env.API_ORIGIN ?? "http://localhost:4000";
  return {
    plugins: [react(), tailwindcss(), siteProfile(site)],
    server: {
      proxy: {
        "/api": api,
        "/uploads": api,
        "/robots.txt": api,
        "/sitemap.xml": api,
      },
    },
  };
});
