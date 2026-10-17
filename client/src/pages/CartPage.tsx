import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtMoney } from "../api";
import ProductImage from "../components/ProductImage";
import { useAuth, useBranch, useCart } from "../store";
import { usePageMeta } from "../usePageMeta";

export default function CartPage() {
  usePageMeta({ title: "Корзина", noindex: true });
  const { user } = useAuth();
  const { items, update, remove, clear, total } = useCart();
  const { branchName } = useBranch();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    setError("");
    try {
      await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          comment,
          items: items.map((i) => ({ productId: i.productId, color: i.color, packs: i.packs })),
        }),
      });
      clear();
      navigate("/orders", { state: { created: true } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (items.length === 0)
    return (
      <div className="py-20 text-center">
        <h1 className="font-display text-3xl">Корзина{branchName ? ` ${branchName}` : ""} пуста</h1>
        <p className="mt-3 text-sm text-dim">Добавьте товары из каталога, чтобы оформить заявку.</p>
        <Link to="/" className="btn mt-8 inline-flex">
          Перейти в каталог
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl">Корзина</h1>
        {branchName && <p className="mt-2 text-sm text-dim">Заявка уйдёт в филиал {branchName}</p>}
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {items.map((item, idx) => {
          const qty = item.packs * item.packSize;
          return (
            <li key={`${item.productId}-${item.color ?? ""}`} className="flex gap-4 py-5">
              <ProductImage src={item.imageUrl} alt={item.name} width={72} height={96} className="h-24 w-18 shrink-0 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="label">{item.name}</p>
                <p className="mt-1 text-xs text-dim">
                  {item.model}
                  {item.color ? ` · ${item.color}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex items-center border border-line" aria-label="Количество пачек">
                    <button type="button" className="min-h-9 min-w-9 cursor-pointer hover:bg-muted" aria-label="Меньше пачек" onClick={() => update(idx, { packs: Math.max(1, item.packs - 1) })}>
                      −
                    </button>
                    <span className="w-20 text-center text-xs tabular-nums">{item.packs} пач.</span>
                    <button
                      type="button"
                      className="min-h-9 min-w-9 cursor-pointer hover:bg-muted disabled:opacity-40"
                      aria-label="Больше пачек"
                      disabled={item.packs >= item.stockPacks}
                      onClick={() => update(idx, { packs: Math.min(item.stockPacks, item.packs + 1) })}
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="label cursor-pointer text-dim underline hover:text-ink" onClick={() => remove(idx)}>
                    Удалить
                  </button>
                </div>
              </div>
              <p className="shrink-0 text-sm tabular-nums">{fmtMoney(item.price * qty)}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <label htmlFor="comment" className="label mb-2 block text-dim">
          Комментарий к заявке
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full border border-line p-3 text-sm outline-none focus:border-brand-deep"
          placeholder="Пожелания по отгрузке, срокам, замене размеров…"
        />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
        <span className="label">Итого</span>
        <span className="text-xl tabular-nums">{fmtMoney(total)}</span>
      </div>
      <p className="mt-2 text-xs text-dim">
        Заявка будет передана сотруднику на проверку. Итоговая сумма подтверждается менеджером. Оформляя
        заявку, вы принимаете{" "}
        <Link to="/legal/offer" className="text-brand-deep underline">
          Публичную оферту
        </Link>{" "}
        и условия{" "}
        <Link to="/legal/returns" className="text-brand-deep underline">
          возврата и обмена
        </Link>
        .
      </p>

      {error && (
        <p role="alert" className="mt-4 border border-red-700 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {user ? (
        <button type="button" className="btn mt-6 w-full" disabled={sending} onClick={submit}>
          {sending ? "Отправляем…" : "Оформить заявку"}
        </button>
      ) : (
        <Link to="/login" className="btn mt-6 w-full">
          Войдите, чтобы оформить заявку
        </Link>
      )}
    </div>
  );
}
