import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { productHref } from "../../api";
import type { Product } from "../../types";
import { Reveal, SectionHead } from "./shared";

const EXAMPLE_PACK: Record<string, number> = { S: 1, M: 2, L: 2, XL: 1 };

/**
 * «Как устроена упаковка»: берём размерную сетку реального товара с витрины,
 * чтобы покупатель понял, что именно приедет в одной упаковке.
 */
export function PackGuide({ products }: { products: Product[] }) {
  // лучше всего видна идея «ходовых размеров больше» на упаковке с неравной сеткой
  const withPack = products.filter((p) => p.packSize > 0 && Object.keys(p.packComposition).length > 1);
  const uneven = (p: Product) => new Set(Object.values(p.packComposition)).size > 1;
  const sample = withPack.find(uneven) ?? withPack[0];
  const pack = sample?.packComposition ?? EXAMPLE_PACK;
  const total = Object.values(pack).reduce((s, n) => s + n, 0);
  const max = Math.max(...Object.values(pack));

  return (
    <section aria-labelledby="pack-title" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 md:grid-cols-12 md:items-center md:gap-10">
        <div className="md:col-span-5">
          <SectionHead id="pack-title" eyebrow="Полезно знать" title="Что такое оптовая упаковка">
            <p>
              Мы продаём модели упаковками — это несколько штук одного цвета в готовой размерной сетке. Ходовых размеров
              в ней больше, крайних — меньше, как обычно и покупают в магазине.
            </p>
            <p>
              Поэтому первая закупка не требует расчётов: берёте упаковку — и у вас сразу полный ряд размеров на
              полке. Цена на сайте указана за штуку, в корзине считается за всю упаковку.
            </p>
          </SectionHead>
        </div>

        <Reveal className="md:col-span-7" delay={0.1}>
          <figure className="border border-line bg-white p-6 md:p-10">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="label text-dim">{sample ? "Пример с витрины" : "Пример упаковки"}</span>
              {sample && (
                <Link to={productHref(sample.id, sample.color)} className="text-sm text-brand-deep underline-offset-4 hover:underline">
                  {sample.name} · {sample.model}
                </Link>
              )}
            </figcaption>
            <ul className="mt-8 flex items-end gap-3 md:gap-5" aria-label="Состав упаковки по размерам">
              {Object.entries(pack).map(([size, qty]) => (
                <li key={size} className="flex flex-1 flex-col items-center gap-3">
                  <span className="text-sm tabular-nums text-dim">×{qty}</span>
                  <span
                    className="pack-bar w-full bg-brand"
                    style={{ height: `${Math.max(28, (qty / max) * 140)}px` }}
                    aria-hidden
                  />
                  <span className="label text-ink">{size}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-line pt-5 text-sm text-dim">
              В одной упаковке —{" "}
              <strong className="font-display text-2xl font-medium text-ink">{total} шт.</strong> одного цвета
            </p>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

const FABRICS = [
  {
    name: "Атлас",
    feel: "Гладкий, с мягким блеском, приятно холодит кожу.",
    season: "Всесезон",
    sells: "Пижамы и сорочки в подарок — особенно перед праздниками.",
    care: "Деликатная стирка при 30°, гладить с изнанки.",
  },
  {
    name: "Хлопок",
    feel: "Кулирка, интерлок, батист — дышит, не электризуется, мягкий к телу.",
    season: "Лето и межсезонье",
    sells: "Базовые пижамы, футболки и сорочки на каждый день — стабильный повторный спрос.",
    care: "Стирка при 30–40°, не сушить на батарее.",
  },
  {
    name: "Кружево",
    feel: "Эластичное, облегающее, с декоративным рисунком.",
    season: "Всесезон",
    sells: "Комплекты белья — высокий чек и импульсные покупки.",
    care: "Ручная или деликатная стирка в мешке, без отжима.",
  },
  {
    name: "Бесшовный трикотаж",
    feel: "Без швов и резинок, не видно под одеждой.",
    season: "Круглый год",
    sells: "База полки: берут регулярно и сразу по несколько штук.",
    care: "Деликатная стирка при 30°, без кондиционера.",
  },
  {
    name: "Вафля и махра",
    feel: "Вафля — лёгкая и впитывающая, махра — плотная и тёплая.",
    season: "Вафля — лето, махра — зима",
    sells: "Халаты: спа-подарки, сезонные распродажи, наборы.",
    care: "Стирка при 40°, махру сушить в расправленном виде.",
  },
  {
    name: "Футер",
    feel: "Плотный трикотаж, часто с начёсом — держит тепло.",
    season: "Осень — зима",
    sells: "Тёплые пижамы и домашние костюмы — пик спроса с первыми холодами.",
    care: "Стирка при 30° наизнанку, не отжимать сильно.",
  },
];

/** Гид по тканям: доступные вкладки (roving tabindex, стрелки). */
export function FabricGuide() {
  const [active, setActive] = useState(0);
  const base = useId();
  const fabric = FABRICS[active];

  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + FABRICS.length) % FABRICS.length;
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <section aria-labelledby="fabric-title" className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <SectionHead id="fabric-title" eyebrow="Гид по тканям" title="Из чего мы шьём и кому это продавать" dark>
          <p>Короткая шпаргалка для закупщика и продавца: как ткань ощущается, в какой сезон берут и как ухаживать.</p>
        </SectionHead>

        <Reveal className="mt-12 grid gap-8 md:grid-cols-12" delay={0.1}>
          <div role="tablist" aria-label="Ткани" aria-orientation="vertical" className="flex flex-wrap gap-2 md:col-span-4 md:flex-col md:gap-0">
            {FABRICS.map((f, i) => {
              const selected = i === active;
              return (
                <button
                  key={f.name}
                  id={`${base}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${base}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={`cursor-pointer border px-4 py-2 text-left font-display text-xl transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:border-0 md:border-l-2 md:px-6 md:py-3 md:text-3xl ${
                    selected ? "border-brand text-paper" : "border-white/15 text-paper/45 hover:text-paper/80"
                  }`}
                >
                  {f.name}
                </button>
              );
            })}
          </div>

          <div
            id={`${base}-panel`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${active}`}
            className="md:col-span-8"
          >
            <div key={fabric.name} className="fabric-panel grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2">
              {[
                ["На ощупь", fabric.feel],
                ["Сезон", fabric.season],
                ["Как продаётся", fabric.sells],
                ["Уход", fabric.care],
              ].map(([k, v]) => (
                <div key={k} className="bg-ink p-6 md:p-8">
                  <p className="label text-brand">{k}</p>
                  <p className="mt-3 text-sm leading-relaxed text-paper/80 md:text-base">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-paper/50">Точный состав и уход для каждой модели — в её карточке.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const SHELVES = [
  {
    share: "≈ 50%",
    title: "Базовая полка",
    text: "Бесшовные и хлопковые комплекты, базовые пижамы — продаются круглый год и обеспечивают повторные покупки.",
  },
  {
    share: "≈ 30%",
    title: "Сезон",
    text: "Лёгкий хлопок и вафля к лету, футер и махра к холодам. Закупайте за 4–6 недель до начала сезона.",
  },
  {
    share: "≈ 20%",
    title: "Подарок и витрина",
    text: "Атлас, кружево, халаты — поднимают средний чек и делают витрину заметной перед праздниками.",
  },
];

/** Советы по структуре закупки — ориентир, а не правило. */
export function AssortmentTips() {
  return (
    <section aria-labelledby="shelf-title" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <SectionHead id="shelf-title" eyebrow="Совет закупщику" title="Как собрать первую закупку">
        <p>
          Ориентир для магазина, который только начинает работать с ASDEM. Пропорции — примерные: менеджер поможет
          подстроить их под ваш город и аудиторию.
        </p>
      </SectionHead>
      <Reveal className="mt-12 grid gap-px border border-line bg-line md:grid-cols-3" stagger={0.1}>
        {SHELVES.map((s) => (
          <div key={s.title} className="bg-paper p-6 md:p-8">
            <p className="font-display text-5xl leading-none text-accent">{s.share}</p>
            <h3 className="label mt-6 text-ink">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-dim">{s.text}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
