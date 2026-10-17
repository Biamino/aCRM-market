# Home — overrides

> Overrides `design-system/asdem/MASTER.md` for the storefront index.

## Pattern

Editorial landing that sells and teaches: preloader → full-bleed hero → proof → catalog → buyer guides → process → FAQ.
Shown only when there is no `category` / `q` query; code in `client/src/components/landing/`.

## Section order

1. **Hero** — two columns. Left: `ASDEM` wordmark (React Bits SplitText), H1 with rotating assortment
   (RotatingText), one line, CTA «Получить оптовые цены» (Magnet) + «Смотреть коллекцию».
   Right: `landing/CircleGallery` — our own take on React Bits Pro «Circle Gallery» (Pro code is licensed,
   not copied): ring of up to 10 showcase product photos, cards face outward and are numbered 001…;
   flies out from the centre on load, slowly auto-spins, drag/throw with inertia (also touch),
   click opens the full photo with «Смотреть модель». Lavender gradient behind.
2. **Categories** — fashion-store tiles (Zara / Uniqlo / COS): 3:4 photo, name + model count under it,
   slow zoom on hover; horizontal snap row on mobile. Data: `/catalog/categories` (`count`, `imageUrl`).
3. **Facts** — CountUp on live numbers only (models, categories, min order, branches). Never invent stats.
4. **About** — manifesto revealed word by word (ScrollReveal) + three columns: для кого / что делаем / как работаем.
5. **Advantages** — four SpotlightCards (white, lavender spotlight, square corners).
6. **Catalog «New in»** — product grid.
7. **Pack guide** — real pack composition of a showcase product as a size bar chart.
8. **Fabric guide** — dark section, accessible tabs: feel / season / how it sells / care.
9. **Assortment tips** — 50 / 30 / 20 starter mix (approximate, framed as advice).
10. **How to order** — four steps + CTA.
11. **Reviews** — WhatsApp screenshots.
12. **FAQ** — native `details/summary`; answers must match `legal/documents.ts`.
13. **Contact CTA** — application + manager.

## Rules

- Brand typography (`ASDEM`) leads the first viewport; product photos only in the reel — no cards, badges or stats.
- Motion comes from React Bits (`client/src/components/bits/`, local copies, MIT + Commons Clause);
  scroll reveals via `landing/shared.tsx` `Reveal` (AnimatedContent). Every effect must respect
  `prefers-reduced-motion` (ring stands still, no intro or inertia; others render final state).
- Landing code is lazy-loaded (`LandingTop`, `LandingBottom`) so catalog/cart pages don't ship gsap/motion.
- First-visit animations wait for the preloader (`introDelay()` in `Preloader.tsx`).
- Lavender-first tokens (logo `#B0A0C8` + Lavender Glass). Do not reintroduce peach/teal palette №4504.
