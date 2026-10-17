import { useEffect, useState } from "react";
import { api, fmtMoney, ORDER_STATUS } from "../../api";
import ProductImage from "../../components/ProductImage";
import type { Order } from "../../types";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = () => api<{ orders: Order[] }>("/admin/orders").then((d) => setOrders(d.orders));

  useEffect(() => {
    load();
  }, []);

  const [error, setError] = useState("");

  async function setStatus(id: number, status: string) {
    if (status === "canceled" && !window.confirm(`Отменить заказ №${id}? Резерв снимется.`)) return;
    setError("");
    try {
      const d = await api<{ message: string }>(`/admin/orders/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setMessage(d.message);
    } catch (e: any) {
      setError(e.message);
    }
    load();
  }

  return (
    <div className="max-w-4xl">
      {message && (
        <p role="status" className="mb-6 border border-brand px-4 py-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-6 border border-red-700 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-dim">
        Заказы общие с CRM: подтверждённый заказ резервирует пачки и уходит на склад, сборку отмечают в CRM, после
        неё заказ можно отгрузить здесь или в CRM.
      </p>
      <ul className="space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="border border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <button
                  type="button"
                  className="label cursor-pointer underline-offset-2 hover:underline"
                  aria-expanded={open === o.id}
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                >
                  Заказ №{o.id}
                </button>
                <span className="ml-3 text-xs text-dim">
                  {o.user?.name}
                  {o.user?.company && ` · ${o.user.company}`} ·{" "}
                  {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`label ${
                    o.status === "new"
                      ? "text-dim"
                      : o.status === "canceled"
                        ? "text-red-700"
                        : ""
                  }`}
                >
                  {ORDER_STATUS[o.status] ?? o.status}
                </span>
                <span className="text-sm tabular-nums">{fmtMoney(o.total)}</span>
                {o.status === "new" && (
                  <button type="button" className="btn px-4 py-2" onClick={() => setStatus(o.id, "warehouse")}>
                    Подтвердить и передать на склад
                  </button>
                )}
                {o.status === "ready" && (
                  <button type="button" className="btn px-4 py-2" onClick={() => setStatus(o.id, "completed")}>
                    Отгрузить
                  </button>
                )}
                {["new", "warehouse", "ready"].includes(o.status) && (
                  <button
                    type="button"
                    className="label cursor-pointer text-red-700 underline-offset-2 hover:underline"
                    onClick={() => setStatus(o.id, "canceled")}
                  >
                    Отменить
                  </button>
                )}
              </div>
            </div>
            {open === o.id && (
              <ul className="divide-y divide-line border-t border-line">
                {o.comment && <li className="px-4 py-3 text-xs text-dim">Комментарий клиента: {o.comment}</li>}
                {o.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                    <ProductImage src={item.product.imageUrl} alt="" width={40} height={53} className="h-14 w-10 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.product.name}</p>
                      <p className="text-xs text-dim">
                        {item.product.model}
                        {item.product.color ? ` · ${item.product.color}` : ""}
                        {item.packs > 0 && ` · ${item.packs} пач. (${item.packs * item.product.packSize} шт.)`}
                        {item.units > 0 && ` · ${item.units} шт.${item.size ? ` (${item.size})` : ""}`}
                        {" · "}
                        {fmtMoney(item.unitPrice)}/ед.
                      </p>
                    </div>
                    <span className="text-sm tabular-nums">{fmtMoney(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
