import { Link } from "react-router-dom";
import Magnet from "../bits/Magnet";
import { COMPANY } from "../../legal/company";
import { managerHref, managerLabel, Reveal, SectionHead, WhatsAppIcon } from "./shared";
import review1 from "../../assets/reviews/review-1.webp";
import review2 from "../../assets/reviews/review-2.webp";
import review3 from "../../assets/reviews/review-3.webp";
import review4 from "../../assets/reviews/review-4.webp";
import review5 from "../../assets/reviews/review-5.webp";
import review6 from "../../assets/reviews/review-6.webp";
import review7 from "../../assets/reviews/review-7.webp";
import review8 from "../../assets/reviews/review-8.webp";

const STEPS = [
  {
    title: "Получите доступ",
    text: "Оставьте заявку на регистрацию — после проверки менеджер откроет оптовые цены и остатки.",
  },
  { title: "Выберите товары", text: "Выберите филиал, добавьте модели, цвета и количество упаковок в корзину." },
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
    <section aria-labelledby="order-title" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <SectionHead id="order-title" eyebrow="Как оформить заказ" title="Четыре шага до первой поставки" />
        <Reveal className="mt-12 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" stagger={0.12}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative bg-paper p-6 md:p-8">
              <span className="font-display text-6xl leading-none text-brand">{i + 1}</span>
              <h3 className="label mt-6 text-ink">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-dim">{s.text}</p>
            </div>
          ))}
        </Reveal>
        <div className="mt-10 flex flex-wrap gap-3">
          <Magnet padding={50} magnetStrength={4} maxOffset={8}>
            <Link to="/register" className="btn">
              Получить доступ
            </Link>
          </Magnet>
          <a href="#catalog" className="btn-ghost">
            Перейти в каталог
          </a>
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  { src: review1, w: 416, h: 610, alt: "Отзыв: «Магазин ASDEM — моя находка для оптовых закупок нижнего белья и пижам…»" },
  { src: review2, w: 465, h: 234, alt: "Отзыв: «Я получила свой товар… ассортимент классный и качество шикарное»" },
  { src: review3, w: 291, h: 89, alt: "Отзыв: «У вас отличный вкус, качество на высоте. Заказы приходят быстро»" },
  { src: review4, w: 326, h: 233, alt: "Отзыв на кыргызском: бельё ASDEM очень качественное и мягкое, клиенты всегда довольны" },
  { src: review5, w: 301, h: 71, alt: "Отзыв: «Я ваш постоянный клиент, классный ассортимент»" },
  { src: review6, w: 366, h: 114, alt: "Отзыв на кыргызском: беру в основном у вас, качество отличное" },
  { src: review7, w: 338, h: 66, alt: "Отзыв на кыргызском: атласные бесшовные, купленные в прошлый раз, отличные" },
  { src: review8, w: 344, h: 67, alt: "Отзыв на кыргызском: качество товаров просто отличное" },
];

export function Reviews() {
  return (
    <section aria-labelledby="reviews-title" className="reviews relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <SectionHead id="reviews-title" eyebrow="Отзывы" title="Что говорят наши покупатели">
          <p>Настоящие сообщения оптовых покупателей ASDEM — как они пришли нам в WhatsApp.</p>
        </SectionHead>
        <ul className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {REVIEWS.map((r, i) => (
            <li key={r.src} className="mb-5 break-inside-avoid">
              <Reveal delay={(i % 3) * 0.08}>
                <figure className={`review-bubble ${i % 2 ? "review-bubble--tilt-r" : "review-bubble--tilt-l"}`}>
                  <img src={r.src} alt={r.alt} width={r.w} height={r.h} loading="lazy" decoding="async" className="block h-auto w-full" />
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Как увидеть оптовые цены?",
    a: "Оставьте заявку на доступ. После проверки менеджер одобрит аккаунт — цены и точные остатки откроются сразу во всём каталоге.",
  },
  {
    q: "Какой минимальный заказ?",
    a: "Одна упаковка: одна модель одного цвета в готовой размерной сетке. Моделей и цветов в заказе может быть сколько угодно.",
  },
  {
    q: "Можно купить поштучно или выбрать только нужные размеры?",
    a: "Нет, мы продаём только целыми упаковками — так сетка размеров всегда сбалансирована. Состав упаковки указан в карточке товара.",
  },
  {
    q: "Что такое Asdem 1 и Asdem 2?",
    a: "Это наши филиалы, у каждого свой склад и свои остатки. Филиал выбирается в шапке сайта: каталог, корзина и заказы показываются по нему. Аккаунт один на оба филиала.",
  },
  {
    q: "Как оплатить заказ?",
    a: "Порядок оплаты — предоплата, частичная оплата или отсрочка — согласуется с менеджером. Реквизиты он пришлёт после подтверждения заказа.",
  },
  {
    q: "Доставляете ли вы в мою страну?",
    a: "Отправляем по странам СНГ. Способ и стоимость доставки менеджер рассчитает под ваш заказ и город.",
  },
  {
    q: "Что делать, если пришёл брак или пересорт?",
    a: (
      <>
        Сообщите менеджеру в течение 5 рабочих дней после приёмки, приложите фото и номер заказа — решим вопрос заменой или
        корректировкой расчётов. Подробнее — в{" "}
        <Link to="/legal/returns" className="text-brand-deep underline underline-offset-2">
          политике возврата
        </Link>
        .
      </>
    ),
  },
];

/** Частые вопросы: нативные details/summary — работают без JS и с клавиатуры. */
export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionHead id="faq-title" eyebrow="Вопросы и ответы" title="Коротко о работе с нами" />
        </div>
        <Reveal className="divide-y divide-line border-y border-line md:col-span-8" stagger={0.05}>
          {FAQ.map((item) => (
            <details key={item.q} className="faq group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-xl text-ink transition-colors duration-200 hover:text-accent md:text-2xl [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  className="faq__icon relative h-4 w-4 shrink-0 before:absolute before:left-0 before:top-1/2 before:h-px before:w-4 before:bg-current after:absolute after:left-1/2 after:top-0 after:h-4 after:w-px after:bg-current"
                  aria-hidden
                />
              </summary>
              <div className="faq__body pb-6 pr-10 text-sm leading-relaxed text-dim md:text-base">{item.a}</div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function ContactCta() {
  return (
    <section aria-labelledby="contact-title" className="mx-auto max-w-7xl px-4 pb-20 md:px-8 md:pb-28">
      <Reveal>
        <div className="relative overflow-hidden border border-line bg-white px-6 py-14 text-center md:px-16 md:py-20">
          <div className="home-hero__plane opacity-70" aria-hidden />
          <div className="relative">
            <p className="label text-dim">Готовы к первой закупке?</p>
            <h2 id="contact-title" className="mx-auto mt-3 max-w-2xl font-display text-3xl font-medium leading-tight md:text-5xl">
              Откройте оптовые цены ASDEM
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-dim md:text-base">
              Оставьте заявку — или напишите менеджеру: поможем с выбором моделей, наличием и доставкой.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Magnet padding={50} magnetStrength={4} maxOffset={8}>
                <Link to="/register" className="btn">
                  Оставить заявку
                </Link>
              </Magnet>
              <a href={managerHref} target="_blank" rel="noreferrer" className="btn-ghost gap-2">
                {COMPANY.whatsapp && <WhatsAppIcon />}
                {managerLabel}
              </a>
            </div>
            {COMPANY.whatsapp && (
              <p className="mt-6 text-sm text-dim">
                WhatsApp менеджера:{" "}
                <a href={`tel:+${COMPANY.whatsapp}`} className="whitespace-nowrap text-brand-deep underline-offset-4 hover:underline">
                  {COMPANY.whatsappDisplay}
                </a>
              </p>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
