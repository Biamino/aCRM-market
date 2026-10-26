import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, fmtMoney, ORDER_STATUS } from "../api";
import OrderDiscount from "../components/OrderDiscount";
import OrderSource from "../components/OrderSource";
import ProductImage from "../components/ProductImage";
import type { Order } from "../types";
import { usePageMeta } from "../usePageMeta";

export default function OrdersPage() {
  usePageMeta({ title: "Мои заказы", noindex: true });
  const location = useLocation();
  const created = Boolean((location.state as any)?.created);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ orders: Order[] }>("/orders")
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display mb-2 text-3xl">
        Мои заказы
      </h1>
      {created && (
        <p role="status" className="mb-6 border border-brand px-4 py-3 text-sm">
          Заявка создана и передана сотруднику на проверку.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {orders === null ? (
        <p className="py-10 text-sm text-dim">Загружаем…</p>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-dim">Заказов пока нет.</p>
          <Link to="/" className="btn-ghost mt-6 inline-flex">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <span className="label">Заказ №{o.id}</span>
                  <OrderSource source={o.source} />
                  <span className="ml-3 text-xs text-dim">
                    {new Date(o.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`label ${
                      o.status === "canceled"
                        ? "text-red-700"
                        : o.status === "new"
                          ? "text-dim"
                          : ""
                    }`}
                  >
                    {ORDER_STATUS[o.status] ?? o.status}
                  </span>
                  <span className="text-sm tabular-nums">{fmtMoney(o.total)}</span>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {o.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                    <ProductImage src={item.product.imageUrl} alt="" width={40} height={53} className="h-14 w-10 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.product.name}</p>
                      <p className="text-xs text-dim">
                        {item.product.model}
                        {item.product.color ? ` · ${item.product.color}` : ""}
                        {item.packs > 0 && ` · ${item.packs} пач.`}
                        {item.units > 0 && ` · ${item.units} шт.${item.size ? ` (${item.size})` : ""}`}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums">{fmtMoney(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <OrderDiscount order={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
