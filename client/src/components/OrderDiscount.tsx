import { fmtMoney } from "../api";
import type { Order } from "../types";

/** Строки «сумма без скидки / скидка N% / к оплате» под позициями заказа. */
export default function OrderDiscount({ order, className = "border-t border-line" }: { order: Order; className?: string }) {
  if (!order.discount) return null;
  return (
    <div className={`space-y-1 px-4 py-3 text-sm ${className}`}>
      <div className="flex justify-between">
        <span className="text-dim">Сумма без скидки</span>
        <span className="tabular-nums">{fmtMoney(order.subtotal ?? order.total + order.discount)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-dim">Скидка{order.discountPercent ? ` ${order.discountPercent}%` : ""}</span>
        <span className="tabular-nums text-brand-deep">−{fmtMoney(order.discount)}</span>
      </div>
      <div className="flex justify-between font-medium">
        <span>Итого со скидкой</span>
        <span className="tabular-nums">{fmtMoney(order.total)}</span>
      </div>
    </div>
  );
}
