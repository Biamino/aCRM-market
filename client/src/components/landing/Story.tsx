import { Link } from "react-router-dom";
import CountUp from "../bits/CountUp";
import ScrollReveal from "../bits/ScrollReveal";
import SpotlightCard from "../bits/SpotlightCard";
import { Reveal, SectionHead } from "./shared";

export interface CategoryTile {
  name: string;
  count: number;
  imageUrl: string;
}

const modelsLabel = (n: number) => {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return `${n} модель`;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} модели`;
  return `${n} моделей`;
};

/**
 * «Категории» как у fashion-магазинов (Zara, Uniqlo, COS): крупные фото-плитки,
 * подпись под фото, на телефоне — горизонтальная лента со скролл-снапом.
 */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="categories-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
      <div className="flex items-end justify-between gap-4">
        <h2 id="categories-title" className="font-display text-3xl font-medium tracking-tight md:text-5xl">
          Категории
        </h2>
        <a href="#catalog" className="label text-dim transition-colors hover:text-accent">
          Весь каталог →
        </a>
      </div>
      <Reveal
        className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5"
        stagger={0.07}
      >
        {categories.map((c) => (
          <Link
            key={c.name}
            to={`/?category=${encodeURIComponent(c.name)}`}
            className="group w-[62vw] shrink-0 snap-start focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-deep sm:w-[40vw] md:w-auto"
          >
            <div className="aspect-[3/4] overflow-hidden bg-muted">
              {c.imageUrl && (
                <img
                  src={c.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                />
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="label text-ink transition-colors group-hover:text-accent">{c.name}</span>
              <span className="text-xs text-dim">{modelsLabel(c.count)}</span>
            </div>
          </Link>
        ))}
      </Reveal>
    </section>
  );
}

interface Fact {
  value: number;
  suffix?: string;
  label: string;
  note: string;
}

/** Цифры витрины — живые, из каталога; без выдуманной статистики. */
export function Facts({ models, categories, branches }: { models: number; categories: number; branches: number }) {
  const facts: Fact[] = [
    { value: models, label: "моделей на витрине", note: "Каталог обновляется вместе со складом" },
    { value: categories, label: "категорий", note: "Бельё, пижамы, халаты и домашняя одежда" },
    { value: 1, label: "упаковка — минимальный заказ", note: "Можно начать с небольшой пробной закупки" },
    { value: branches, label: branches === 1 ? "склад" : "склада-филиала", note: "Свои остатки — выбирайте в шапке сайта" },
  ].filter((f) => f.value > 0);

  return (
    <section id="facts" aria-label="ASDEM в цифрах" className="scroll-mt-28">
      <Reveal className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-line lg:grid-cols-4" stagger={0.08}>
        {facts.map((f) => (
          <div key={f.label} className="bg-paper px-4 py-8 md:px-8 md:py-12">
            <p className="font-display text-5xl leading-none text-accent md:text-7xl">
              <CountUp to={f.value} duration={1.6} separator=" " className="proportional-nums" />
              {f.suffix}
            </p>
            <p className="label mt-4 text-ink">{f.label}</p>
            <p className="mt-2 text-xs leading-relaxed text-dim md:text-sm">{f.note}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

/** О бренде: манифест проявляется по словам при прокрутке (React Bits ScrollReveal). */
export function About() {
  return (
    <section aria-labelledby="about-title" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-32">
      <p className="label text-dim">О бренде</p>
      <h2 id="about-title" className="sr-only">
        ASDEM — производитель и оптовый поставщик женской одежды
      </h2>
      <ScrollReveal
        enableBlur
        baseOpacity={0.12}
        baseRotation={2}
        blurStrength={5}
        containerClassName="mt-6 max-w-5xl"
        textClassName="font-display text-3xl font-medium leading-[1.15] tracking-tight text-ink md:text-6xl"
      >
        Мы сами разрабатываем модели ASDEM и работаем напрямую с производством — поэтому знаем, из чего сшита каждая
        вещь, и держим оптовую цену без посредников.
      </ScrollReveal>

      <Reveal className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8" stagger={0.1}>
        {[
          ["Для кого", "Магазины белья и домашней одежды, онлайн-магазины, продавцы маркетплейсов и оптовые покупатели СНГ."],
          ["Что делаем", "Женское бельё, пижамы, сорочки, халаты и домашние костюмы — базовые модели и сезонные коллекции."],
          ["Как работаем", "Закрытый оптовый кабинет: цены и остатки видны после одобрения, заказ подтверждает менеджер."],
        ].map(([title, text]) => (
          <div key={title} className="border-t border-line pt-5">
            <h3 className="label text-brand-deep">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-dim md:text-base">{text}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

const ADVANTAGES = [
  {
    title: "Цена производителя",
    text: "Без посредников: вы закупаете у тех, кто разрабатывает и шьёт модели. Постоянным партнёрам — особые ценовые группы.",
  },
  {
    title: "Готовая размерная сетка",
    text: "Упаковка собрана по ходовым размерам — не нужно угадывать пропорции и держать на полке неликвид.",
  },
  {
    title: "Остатки онлайн",
    text: "Каталог берёт наличие прямо со склада филиала: видно, сколько упаковок можно заказать сейчас.",
  },
  {
    title: "Новинки каждый сезон",
    text: "Обновляем модели с учётом спроса оптовых покупателей — есть чем освежить витрину.",
  },
];

/** Почему с ASDEM выгодно — карточки с лавандовой подсветкой за курсором (React Bits SpotlightCard). */
export function Advantages() {
  return (
    <section aria-labelledby="advantages-title" className="bg-brand-soft/50">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <SectionHead id="advantages-title" eyebrow="Почему ASDEM" title="Закупка, на которой магазин зарабатывает">
          <p>Мы думаем о том, как товар будет продаваться у вас, а не только о том, как его отгрузить.</p>
        </SectionHead>
        <Reveal className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
          {ADVANTAGES.map((a, i) => (
            <SpotlightCard key={a.title} theme="light" spotlightColor="#b0a0c8" className="h-full p-7 md:p-8">
              <span className="font-display text-4xl leading-none text-brand" aria-hidden>
                0{i + 1}
              </span>
              <h3 className="label mt-8 text-ink">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-dim">{a.text}</p>
            </SpotlightCard>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
