import { useEffect, useState } from "react";
import { api } from "../../api";

interface Registration {
  id: number;
  email: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  status: string;
  /** персональная скидка, % — пишется в каждый новый заказ клиента */
  discountPercent: number;
  createdAt: string;
  /** клиенты CRM с тем же e-mail/телефоном — к ним аккаунт привяжется и увидит их заказы */
  crmMatches?: { branch: string; branchName: string; customerId: number; name: string; by: "email" | "phone" }[];
}

const STATUS: Record<string, string> = {
  PENDING: "Ожидает",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
};

export default function RegistrationsPage() {
  const [users, setUsers] = useState<Registration[]>([]);
  /** вводимые, ещё не сохранённые значения скидки по id клиента */
  const [discounts, setDiscounts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    api<{ users: Registration[] }>("/admin/registrations").then((d) => {
      setUsers(d.users);
      setDiscounts({});
    });

  useEffect(() => {
    load();
  }, []);

  const discountOf = (u: Registration) => discounts[u.id] ?? String(u.discountPercent);

  async function run(request: Promise<{ message: string }>) {
    setError("");
    try {
      setMessage((await request).message);
      load();
    } catch (e: any) {
      setMessage("");
      setError(e.message);
    }
  }

  const act = (u: Registration, action: "approve" | "reject") =>
    run(
      api(`/admin/registrations/${u.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "approve" ? { discountPercent: Number(discountOf(u)) || 0 } : {}),
      }),
    );

  const saveDiscount = (u: Registration) =>
    run(
      api(`/admin/registrations/${u.id}/discount`, {
        method: "PUT",
        body: JSON.stringify({ discountPercent: Number(discountOf(u)) || 0 }),
      }),
    );

  const discountInput = (u: Registration) => (
    <span className="inline-flex items-center border border-line">
      <input
        id={`discount-${u.id}`}
        type="number"
        min={0}
        max={100}
        step={0.5}
        inputMode="decimal"
        className="min-h-11 w-20 bg-transparent px-3 text-sm tabular-nums outline-none"
        value={discountOf(u)}
        onChange={(e) => setDiscounts({ ...discounts, [u.id]: e.target.value })}
      />
      <span className="pr-3 text-sm text-dim">%</span>
    </span>
  );

  const pending = users.filter((u) => u.status === "PENDING");
  const rest = users.filter((u) => u.status !== "PENDING");

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

      <h2 className="label mb-4">Новые заявки ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-dim">Новых заявок нет.</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((u) => (
            <li key={u.id} className="border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="mt-1 text-xs text-dim">
                    {u.company && <>{u.company} · </>}
                    {u.email}
                    {u.phone && <> · {u.phone}</>}
                  </p>
                  <p className="mt-1 text-xs text-dim">
                    Заявка от {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                  {u.crmMatches?.length ? (
                    <div className="mt-3 border-l-2 border-accent bg-brand-soft/50 px-3 py-2 text-xs text-ink">
                      <p className="font-medium">Уже есть в CRM — после одобрения увидит заказы и долги этих клиентов:</p>
                      <ul className="mt-1 space-y-0.5">
                        {u.crmMatches.map((m) => (
                          <li key={m.branch}>
                            {m.name} (#{m.customerId}), совпал {m.by === "email" ? "e-mail" : "телефон"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-dim">В CRM не найден — при первом заказе создастся новый клиент.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="label text-dim" htmlFor={`discount-${u.id}`}>
                    Скидка
                  </label>
                  {discountInput(u)}
                  <button type="button" className="btn" onClick={() => act(u, "approve")}>
                    Одобрить
                  </button>
                  <button type="button" className="btn-ghost border-red-700 text-red-700 hover:bg-red-700" onClick={() => act(u, "reject")}>
                    Отклонить
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="label mb-4 mt-10">Все клиенты</h2>
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-4 py-3 font-normal text-dim">Клиент</th>
              <th className="label px-4 py-3 font-normal text-dim">E-mail</th>
              <th className="label px-4 py-3 font-normal text-dim">Скидка</th>
              <th className="label px-4 py-3 font-normal text-dim">Статус</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  {u.name}
                  {u.company && <span className="block text-xs text-dim">{u.company}</span>}
                </td>
                <td className="px-4 py-3 text-dim">{u.email}</td>
                <td className="px-4 py-3">
                  {u.status === "APPROVED" ? (
                    <div className="flex items-center gap-2">
                      {discountInput(u)}
                      {discounts[u.id] !== undefined && Number(discounts[u.id]) !== u.discountPercent && (
                        <button type="button" className="btn px-3 py-2" onClick={() => saveDiscount(u)}>
                          Сохранить
                        </button>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`px-4 py-3 ${u.status === "REJECTED" ? "text-red-700" : ""}`}>{STATUS[u.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
