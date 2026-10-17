import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** Публичный адрес маркета для canonical/OG/JSON-LD в index.html (тот же SITE_URL, что у сервера). */
const SITE_URL = (process.env.SITE_URL ?? "https://asdem.kg").replace(/\/+$/, "");

const siteUrl = (): Plugin => ({
  name: "asdem-site-url",
  transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL),
});

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
      "/robots.txt": "http://localhost:4000",
      "/sitemap.xml": "http://localhost:4000",
    },
  },
});
