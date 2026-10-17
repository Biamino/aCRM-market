import { Link } from "react-router-dom";
import { COMPANY } from "../legal/company";
import review1 from "../assets/reviews/review-1.png";
import review2 from "../assets/reviews/review-2.png";
import review3 from "../assets/reviews/review-3.png";
import review4 from "../assets/reviews/review-4.png";
import review5 from "../assets/reviews/review-5.png";
import review6 from "../assets/reviews/review-6.png";
import review7 from "../assets/reviews/review-7.png";
import review8 from "../assets/reviews/review-8.png";

/** Ссылка на менеджера: WhatsApp, если номер задан в реквизитах, иначе e-mail поддержки. */
export const managerHref = COMPANY.whatsapp
  ? `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent("Здравствуйте! Хочу узнать про опт ASDEM.")}`
  : `mailto:${COMPANY.supportEmail}`;
const managerLabel = COMPANY.whatsapp ? "Написать в WhatsApp" : "Написать менеджеру";

function SectionHead({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="label text-dim">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">{title}</h2>
      {children && <div className="mt-5 space-y-3 text-sm leading-relaxed text-dim md:text-base">{children}</div>}
    </div>
  );
}

const ADVANTAGES = [
  { title: "Собственное производство", text: "Разрабатываем и выпускаем модели женского белья и домашней одежды." },
  { title: "Заказ от 1 упаковки", text: "Удобно как для первой закупки, так и для регулярного пополнения ассортимента." },
  { title: "Регулярные новинки", text: "Постоянно обновляем модели и ассортимент с учётом спроса." },
  { title: "Доставка по СНГ", text: "Стоимость и условия доставки рассчитываются индивидуально." },
];

/** Преимущества — сразу под первым экраном. */
export function Advantages() {
  return (
    <section aria-labelledby="advantages-title" className="border-y border-line">
      <h2 id="advantages-title" className="sr-only">
        Оптовые поставки ASDEM
      </h2>
      <ul className="mx-auto grid max-w-7xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {ADVANTAGES.map((a, i) => (
          <li key={a.title} className="reveal flex gap-4 bg-paper px-4 py-8 md:px-8 md:py-10">
            <span className="font-display text-2xl leading-none text-brand" aria-hidden>
              0{i + 1}
            </span>
            <div>
              <h3 className="label text-ink">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{a.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** О бренде: кто мы и «от идеи до готовой коллекции». */
export function About() {
  return (
    <section aria-labelledby="about-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
      <div className="grid gap-12 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <p className="label text-dim">О бренде</p>
          <h2 id="about-title" className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
            ASDEM — производитель и оптовый поставщик женской одежды
          </h2>
          <div className="mt-6 max-w-xl space-y-4 text-sm leading-relaxed text-dim md:text-base">
            <p>
              Мы производим женское бельё, пижамы и домашнюю одежду и работаем с оптовыми покупателями по странам СНГ.
            </p>
            <p>
              Регулярно обновляем ассортимент и предлагаем модели для магазинов, онлайн-магазинов и других оптовых
              покупателей.
            </p>
          </div>
        </div>
        <aside className="relative md:col-span-5 md:pt-10">
          <div className="about-card relative overflow-hidden border border-line bg-brand-soft/60 p-8 md:p-10">
            <span
              className="pointer-events-none absolute -right-4 -top-8 font-display text-[9rem] leading-none text-brand/25"
              aria-hidden
            >
              A
            </span>
            <p className="label text-brand-deep">От идеи до готовой коллекции</p>
            <p className="relative mt-4 font-display text-xl leading-snug text-ink md:text-2xl">
              Мы разрабатываем модели ASDEM и работаем напрямую с производством.
            </p>
            <p className="relative mt-4 text-sm leading-relaxed text-dim">
              Регулярно обновляем ассортимент и отбираем модели с учётом спроса оптовых покупателей.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Получите доступ",
    text: "Оставьте заявку на регистрацию — после проверки менеджер откроет оптовые цены и остатки.",
  },
  { title: "Выберите товары", text: "Добавьте нужные модели, цвета и количество упаковок в корзину." },
  {
    title: "Отправьте заявку",
    text: "Оформите заказ на сайте — менеджер проверит наличие и свяжется с вами для подтверждения.",
  },
  {
    title: "Оплата и доставка",
    text: "После подтверждения заказ собирают на складе, менеджер рассчитает доставку и сообщит детали оплаты.",
  },
];

export function HowToOrder() {
  return (
    <section aria-labelledby="order-title" className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <p className="label text-brand">Как оформить заказ</p>
        <h2 id="order-title" className="mt-3 max-w-2xl font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
          Четыре шага до первой поставки
        </h2>
        <ol className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal bg-ink p-6 md:p-8">
              <span className="font-display text-5xl leading-none text-brand">{i + 1}</span>
              <h3 className="label mt-6 text-paper">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-paper/70">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="#catalog" className="btn btn--on-dark">
            Перейти в каталог →
          </a>
          <Link to="/register" className="btn-ghost btn-ghost--on-dark">
            Получить доступ
          </Link>
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  { src: review1, alt: "Отзыв: «Магазин ASDEM — моя находка для оптовых закупок нижнего белья и пижам…»" },
  { src: review2, alt: "Отзыв: «Я получила свой товар… ассортимент классный и качество шикарное»" },
  { src: review3, alt: "Отзыв: «У вас отличный вкус, качество на высоте. Заказы приходят быстро»" },
  { src: review4, alt: "Отзыв на кыргызском: бельё ASDEM очень качественное и мягкое, клиенты всегда довольны" },
  { src: review5, alt: "Отзыв: «Я ваш постоянный клиент, классный ассортимент»" },
  { src: review6, alt: "Отзыв на кыргызском: беру в основном у вас, качество отличное" },
  { src: review7, alt: "Отзыв на кыргызском: атласные бесшовные, купленные в прошлый раз, отличные" },
  { src: review8, alt: "Отзыв на кыргызском: качество товаров просто отличное" },
];

export function Reviews() {
  return (
    <section aria-labelledby="reviews-title" className="reviews relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead id="reviews-title" eyebrow="Отзывы" title="Что говорят наши покупатели">
            <p>Настоящие сообщения оптовых покупателей ASDEM — как они пришли нам в WhatsApp.</p>
          </SectionHead>
          <p className="font-display text-6xl leading-none text-brand md:text-8xl" aria-hidden>
            ♡
          </p>
        </div>
        <ul className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {REVIEWS.map((r, i) => (
            <li key={r.src} className="reveal mb-5 break-inside-avoid">
              <figure className={`review-bubble ${i % 2 ? "review-bubble--tilt-r" : "review-bubble--tilt-l"}`}>
                <img src={r.src} alt={r.alt} loading="lazy" className="block h-auto w-full" />
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ContactCta() {
  return (
    <section aria-labelledby="contact-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
      <div className="relative overflow-hidden border border-line bg-white px-6 py-12 text-center md:px-16 md:py-16">
        <div className="home-hero__plane opacity-70" aria-hidden />
        <div className="relative">
          <p className="label text-dim">Остались вопросы?</p>
          <h2 id="contact-title" className="mx-auto mt-3 max-w-2xl font-display text-3xl font-medium leading-tight md:text-5xl">
            Свяжитесь с менеджером ASDEM
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-dim md:text-base">
            Поможем с выбором моделей, наличием и доставкой.
          </p>
          <a href={managerHref} target="_blank" rel="noreferrer" className="btn mt-8 gap-2">
            {COMPANY.whatsapp && (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
              </svg>
            )}
            {managerLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
