import type { Order } from "../types";

/** Пометка, где оформлен заказ: на сайте или менеджером в CRM. */
export default function OrderSource({ source }: { source: Order["source"] }) {
  if (!source) return null;
  const web = source === "web";
  return (
    <span
      className={`ml-3 inline-block border px-2 py-0.5 align-middle text-[11px] leading-none ${
        web ? "border-brand-deep text-brand-deep" : "border-line text-dim"
      }`}
      title={web ? "Заказ оформлен на сайте" : "Заказ заведён менеджером в CRM"}
    >
      {web ? "С сайта" : "Из CRM"}
    </span>
  );
}
