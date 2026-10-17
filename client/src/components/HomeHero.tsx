import { Link } from "react-router-dom";

/**
 * Zara-style campaign hero: brand as hero signal, one headline,
 * one line, one CTA group. Palette №4504. Full-bleed first viewport.
 */
export default function HomeHero() {
  return (
    <section
      className="home-hero relative flex min-h-[calc(100dvh-7.25rem)] w-full flex-col justify-end overflow-hidden"
      aria-label="ASDEM — главная"
    >
      <div className="home-hero__plane" aria-hidden="true" />
      <div className="home-hero__grain" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 pb-16 pt-28 md:gap-8 md:px-8 md:pb-24">
        <p className="home-hero__brand font-display text-[clamp(3.25rem,14vw,9.5rem)] font-medium leading-[0.9] tracking-[-0.04em] text-ink">
          ASDEM
        </p>

        <div className="home-hero__copy max-w-xl">
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink md:text-4xl">
            Женское нижнее бельё и домашняя одежда оптом
          </h1>
          <p className="label mt-4 flex flex-wrap gap-x-3 gap-y-1 text-brand-deep">
            <span>Собственное производство</span>
            <span aria-hidden>·</span>
            <span>Заказ от 1 упаковки</span>
            <span aria-hidden>·</span>
            <span>Доставка по СНГ</span>
          </p>
        </div>

        <div className="home-hero__cta flex flex-wrap items-center gap-3 md:gap-4">
          <a href="#catalog" className="btn">
            Смотреть коллекцию
          </a>
          <Link to="/register" className="btn-ghost">
            Стать партнёром
          </Link>
        </div>
      </div>

      <a
        href="#catalog"
        className="home-hero__scroll label absolute bottom-6 right-4 z-10 text-dim transition-colors duration-200 hover:text-ink md:right-8"
        aria-label="Перейти к каталогу"
      >
        Scroll
      </a>
    </section>
  );
}
