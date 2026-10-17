import { useEffect, useState } from "react";
import { api } from "../../api";

interface Registration {
  id: number;
  email: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  status: string;
  priceGroup: string | null;
  createdAt: string;
  /** клиенты CRM с тем же e-mail/телефоном — к ним аккаунт привяжется и увидит их заказы */
  crmMatches?: { branch: string; branchName: string; customerId: number; name: string; by: "email" | "phone" }[];
}

interface PriceGroup {
  id: number;
  name: string;
  multiplier: number;
}

const STATUS: Record<string, string> = {
  PENDING: "Ожидает",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
};

export default function RegistrationsPage() {
  const [users, setUsers] = useState<Registration[]>([]);
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Record<number, number>>({});
  const [message, setMessage] = useState("");

  const load = () =>
    api<{ users: Registration[] }>("/admin/registrations").then((d) => setUsers(d.users));

  useEffect(() => {
    load();
    api<{ groups: PriceGroup[] }>("/admin/price-groups").then((d) => setGroups(d.groups));
  }, []);

  async function act(id: number, action: "approve" | "reject") {
    const body = action === "approve" ? { priceGroupId: selectedGroup[id] ?? groups[0]?.id } : {};
    const d = await api<{ message: string }>(`/admin/registrations/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setMessage(d.message);
    load();
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const rest = users.filter((u) => u.status !== "PENDING");

  return (
    <div className="max-w-4xl">
      {message && (
        <p role="status" className="mb-6 border border-brand px-4 py-3 text-sm">
          {message}
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
                            {m.branchName}: {m.name} (#{m.customerId}), совпал {m.by === "email" ? "e-mail" : "телефон"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-dim">В CRM не найден — при первом заказе создастся новый клиент.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="label text-dim" htmlFor={`group-${u.id}`}>
                    Ценовая группа
                  </label>
                  <select
                    id={`group-${u.id}`}
                    className="min-h-11 cursor-pointer border border-line bg-transparent px-3 text-sm"
                    value={selectedGroup[u.id] ?? groups[0]?.id ?? ""}
                    onChange={(e) => setSelectedGroup({ ...selectedGroup, [u.id]: Number(e.target.value) })}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} (×{g.multiplier})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn" onClick={() => act(u.id, "approve")}>
                    Одобрить
                  </button>
                  <button type="button" className="btn-ghost border-red-700 text-red-700 hover:bg-red-700" onClick={() => act(u.id, "reject")}>
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
              <th className="label px-4 py-3 font-normal text-dim">Группа</th>
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
                <td className="px-4 py-3">{u.priceGroup ?? "—"}</td>
                <td className={`px-4 py-3 ${u.status === "REJECTED" ? "text-red-700" : ""}`}>{STATUS[u.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
