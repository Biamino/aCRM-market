import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SITE_CONTENT } from "../../siteContent";

export const BRAND_CLASS =
  "font-display text-[clamp(3.25rem,12vw,8.5rem)] font-medium leading-[0.9] tracking-[-0.04em] text-ink";

export const ASSORTMENT = SITE_CONTENT.assortment;

/**
 * Вёрстка первого экрана без анимаций. Сама по себе — заглушка, пока грузится чанк лендинга
 * (gsap/motion): текст и кнопки видны сразу, и при подмене на анимированный Hero ничего не сдвигается.
 */
export function HeroLayout({
  brand,
  accent,
  primaryCta,
  aside,
  delay = 0,
}: {
  brand?: ReactNode;
  accent?: ReactNode;
  primaryCta?: ReactNode;
  aside?: ReactNode;
  /** задержка CSS-появления текста (ждём прелоадер), с */
  delay?: number;
}) {
  return (
    <section className="home-hero relative w-full overflow-hidden" aria-label="ASDEM — главная">
      <div className="home-hero__plane" aria-hidden="true" />
      <div className="home-hero__grain" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-7.25rem)] max-w-7xl grid-cols-1 items-center gap-8 px-4 pb-12 pt-14 md:px-8 lg:grid-cols-12 lg:gap-6 lg:pb-16">
        <div className="flex min-w-0 flex-col items-start gap-6 md:gap-8 lg:col-span-6">
          {/* имя бренда для скринридеров — текстом, визуальные буквы скрыты */}
          <span className="sr-only">ASDEM</span>
          <div aria-hidden="true">{brand ?? <p className={BRAND_CLASS}>ASDEM</p>}</div>

          <div className="home-hero__copy max-w-xl" style={{ animationDelay: `${delay + 0.35}s` }}>
            <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-4xl">
              <span className="sr-only">{SITE_CONTENT.heroHeading}</span>
              <span aria-hidden="true" className="flex flex-wrap items-baseline gap-x-2">
                Оптовые поставки
                {accent ?? <span className="text-accent italic">{ASSORTMENT[0]}</span>}
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-dim md:text-base">
              Производим и отгружаем оптом для магазинов и маркетплейсов. Заказ от одной упаковки, оптовые цены —
              после одобрения заявки.
            </p>
          </div>

          <div className="home-hero__cta flex flex-wrap items-center gap-3 md:gap-4" style={{ animationDelay: `${delay + 0.5}s` }}>
            {primaryCta ?? (
              <Link to="/register" className="btn">
                Получить оптовые цены
              </Link>
            )}
            <a href="#catalog" className="btn-ghost">
              Смотреть коллекцию
            </a>
          </div>
        </div>

        <div className="h-[24rem] min-w-0 sm:h-[30rem] lg:col-span-6 lg:h-[min(42rem,calc(100dvh-10rem))]">{aside}</div>
      </div>
    </section>
  );
}
