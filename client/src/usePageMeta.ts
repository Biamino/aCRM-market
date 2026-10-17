import { useEffect } from "react";

const DEFAULT_TITLE = "ASDEM — женское бельё, пижамы и домашняя одежда оптом";

interface PageMeta {
  /** заголовок страницы; к нему добавится « | ASDEM» */
  title?: string;
  description?: string;
  /** картинка для превью ссылки (абсолютный или корневой адрес) */
  image?: string;
  /** закрыть страницу от индексации (корзина, кабинет, админка) */
  noindex?: boolean;
  /** schema.org разметка страницы */
  jsonLd?: object;
}

function setMeta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Title, description, canonical, OG и JSON-LD текущей страницы SPA. Поисковики рендерят JS и
 * видят их; превью в мессенджерах для карточек моделей подставляет сервер (server/src/seo.ts).
 */
export function usePageMeta({ title, description, image, noindex, jsonLd }: PageMeta) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    const head = document.head;
    const prev = {
      title: document.title,
      description: head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? null,
      image: head.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? null,
    };
    const fullTitle = title ? `${title} | ASDEM` : DEFAULT_TITLE;
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;

    document.title = fullTitle;
    setMeta("property", "og:title", fullTitle);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("property", "og:url", url);
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    if (image) {
      const abs = new URL(image, window.location.origin).href;
      setMeta("property", "og:image", abs);
      setMeta("name", "twitter:image", abs);
    }
    setMeta("name", "robots", noindex ? "noindex, nofollow" : null);
    const canonical = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanonical = canonical?.href;
    if (canonical) canonical.href = url;

    let script: HTMLScriptElement | null = null;
    if (ld) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.page = "1";
      script.textContent = ld;
      head.appendChild(script);
    }

    return () => {
      document.title = prev.title;
      if (prev.description !== null) {
        setMeta("name", "description", prev.description);
        setMeta("property", "og:description", prev.description);
      }
      if (prev.image !== null) {
        setMeta("property", "og:image", prev.image);
        setMeta("name", "twitter:image", prev.image);
      }
      setMeta("name", "robots", null);
      if (canonical && prevCanonical) canonical.href = prevCanonical;
      script?.remove();
    };
  }, [title, description, image, noindex, ld]);
}
