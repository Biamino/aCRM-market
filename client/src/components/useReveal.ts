import { useEffect } from "react";

/** Плавное появление блоков `.reveal` при прокрутке (без библиотек, уважает reduced-motion через CSS). */
export function useReveal(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const nodes = document.querySelectorAll<HTMLElement>(".reveal:not(.reveal--in)");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("reveal--in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [enabled]);
}
