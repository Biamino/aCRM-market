import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, fmtMoney } from "../../api";

const PERIODS = [
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
];

const GRANULARITY = [
  { value: "day", label: "Дни" },
  { value: "week", label: "Недели" },
  { value: "month", label: "Месяцы" },
];

function rangeParams(days: number) {
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 3600 * 1000);
  return `from=${from.toISOString()}&to=${to.toISOString()}`;
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const thCls = "label px-3 py-2.5 text-left font-normal text-dim";
const tdCls = "px-3 py-2.5";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState("day");
  const [dynamics, setDynamics] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [models, setModels] = useState<{ category: string; list: any[] } | null>(null);
  const [staleDays, setStaleDays] = useState(30);
  const [stale, setStale] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [debts, setDebts] = useState<any>(null);
  const [consignments, setConsignments] = useState<any[]>([]);

  const range = useMemo(() => rangeParams(days), [days]);

  useEffect(() => {
    api(`/analytics/dynamics?granularity=${granularity}&${range}`).then(setDynamics);
  }, [granularity, range]);

  useEffect(() => {
    api<{ products: any[] }>(`/analytics/top?${range}`).then((d) => setTop(d.products));
    api<{ categories: any[] }>(`/analytics/categories?${range}`).then((d) => setCategories(d.categories));
    setModels(null);
  }, [range]);

  useEffect(() => {
    const t = setTimeout(
      () => api<{ products: any[] }>(`/analytics/stale?days=${staleDays}`).then((d) => setStale(d.products)),
      300,
    );
    return () => clearTimeout(t);
  }, [staleDays]);

  useEffect(() => {
    api<{ suppliers: any[] }>(`/analytics/suppliers?${rangeParams(90)}`).then((d) => setSuppliers(d.suppliers));
    api("/analytics/debts").then(setDebts);
    api<{ consignments: any[] }>("/analytics/consignment").then((d) => setConsignments(d.consignments));
  }, []);

  async function drill(categoryId: number, name: string) {
    const d = await api<{ models: any[] }>(`/analytics/categories?categoryId=${categoryId}&${range}`);
    setModels({ category: name, list: d.models });
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-2 text-dim">Период:</span>
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            aria-pressed={days === p.days}
            className={`label min-h-11 cursor-pointer border px-4 transition-colors duration-200 ${
              days === p.days ? "border-brand-deep bg-brand-deep text-on-brand" : "border-line hover:border-brand-deep"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* V2-AN03: динамика */}
      <Section
        title="Динамика продаж"
        aside={
          <div className="flex gap-2">
            {GRANULARITY.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGranularity(g.value)}
                aria-pressed={granularity === g.value}
                className={`label min-h-9 cursor-pointer border px-3 transition-colors duration-200 ${
                  granularity === g.value ? "border-brand-deep bg-brand-deep text-on-brand" : "border-line hover:border-brand-deep"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        }
      >
        {dynamics && (
          <>
            <div className="mb-5 flex flex-wrap gap-8">
              <div>
                <p className="label text-dim">Выручка за период</p>
                <p className="mt-1 text-2xl tabular-nums">{fmtMoney(dynamics.comparison.currentRevenue)}</p>
              </div>
              <div>
                <p className="label text-dim">Прошлый период</p>
                <p className="mt-1 text-2xl tabular-nums text-dim">{fmtMoney(dynamics.comparison.previousRevenue)}</p>
              </div>
              {dynamics.comparison.changePct !== null && (
                <div>
                  <p className="label text-dim">Изменение</p>
                  <p className={`mt-1 text-2xl tabular-nums ${dynamics.comparison.changePct >= 0 ? "" : "text-red-700"}`}>
                    {dynamics.comparison.changePct >= 0 ? "+" : ""}
                    {dynamics.comparison.changePct}%
                  </p>
                </div>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dynamics.series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#eeeeee" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#767676" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#767676" tickFormatter={(v) => `${Math.round(v / 1000)}т`} width={40} />
                  <Tooltip formatter={(v: any) => fmtMoney(Number(v))} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, border: "1px solid #e5e5e5", borderRadius: 0 }} />
                  <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#534d73" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Section>

      {/* V2-AN01: лучшие товары */}
      <Section title="Лучшие товары">
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={thCls}>Товар</th>
                <th className={thCls}>Категория</th>
                <th className={`${thCls} text-right`}>Продано, ед.</th>
                <th className={`${thCls} text-right`}>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {top.slice(0, 10).map((p, i) => (
                <tr key={p.productId} className="border-b border-line last:border-0">
                  <td className={tdCls}>
                    <span className="mr-2 text-dim">{i + 1}.</span>
                    {p.name} <span className="text-xs text-dim">({p.model})</span>
                  </td>
                  <td className={`${tdCls} text-dim`}>{p.category}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{p.quantity}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(p.revenue)}</td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-dim">
                    Нет продаж за выбранный период.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* V2-AN04: категории с переходом к моделям */}
      <Section title="Продажи по категориям">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eeeeee" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="#767676" />
              <YAxis tick={{ fontSize: 11 }} stroke="#767676" tickFormatter={(v) => `${Math.round(v / 1000)}т`} width={40} />
              <Tooltip formatter={(v: any) => fmtMoney(Number(v))} contentStyle={{ fontSize: 12, border: "1px solid #e5e5e5", borderRadius: 0 }} />
              <Bar dataKey="revenue" name="Выручка" fill="#534d73" maxBarSize={48} cursor="pointer" onClick={(d: any) => drill(d.categoryId, d.category)} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.categoryId}
              type="button"
              onClick={() => drill(c.categoryId, c.category)}
              className={`label min-h-9 cursor-pointer border px-3 transition-colors duration-200 ${
                models?.category === c.category ? "border-brand-deep bg-brand-deep text-on-brand" : "border-line hover:border-brand-deep"
              }`}
            >
              {c.category}: {c.quantity} ед.
            </button>
          ))}
        </div>
        {models && (
          <div className="mt-4 overflow-x-auto border border-line">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="label px-3 py-2.5 text-left text-dim">Модели категории «{models.category}»</caption>
              <thead>
                <tr className="border-b border-line">
                  <th className={thCls}>Модель</th>
                  <th className={`${thCls} text-right`}>Продано, ед.</th>
                  <th className={`${thCls} text-right`}>Выручка</th>
                </tr>
              </thead>
              <tbody>
                {models.list.map((m) => (
                  <tr key={m.productId} className="border-b border-line last:border-0">
                    <td className={tdCls}>
                      {m.name} <span className="text-xs text-dim">({m.model})</span>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>{m.quantity}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* V2-AN02: залежавшиеся */}
      <Section
        title="Залежавшиеся товары"
        aside={
          <label className="flex items-center gap-2 text-sm">
            <span className="label text-dim">Нет продаж более</span>
            <input
              type="number"
              min={1}
              value={staleDays}
              onChange={(e) => setStaleDays(Math.max(1, Number(e.target.value)))}
              className="min-h-9 w-20 border border-line px-2 text-center tabular-nums"
              aria-label="Порог в днях"
            />
            <span className="label text-dim">дн.</span>
          </label>
        }
      >
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={thCls}>Товар</th>
                <th className={thCls}>Поставщик</th>
                <th className={`${thCls} text-right`}>Без продаж, дн.</th>
                <th className={`${thCls} text-right`}>Остаток, пач.</th>
                <th className={`${thCls} text-right`}>Заморожено (закуп)</th>
              </tr>
            </thead>
            <tbody>
              {stale.map((p) => (
                <tr key={p.productId} className="border-b border-line last:border-0">
                  <td className={tdCls}>
                    {p.name} <span className="text-xs text-dim">({p.model})</span>
                  </td>
                  <td className={`${tdCls} text-dim`}>{p.supplier}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{p.daysWithoutSales ?? "не продавался"}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{p.stockPacks}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(p.stockValue)}</td>
                </tr>
              ))}
              {stale.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-dim">
                    Залежавшихся товаров с таким порогом нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* V2-AN05: поставщики */}
      <Section title="Поставщики (за 90 дней)">
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={thCls}>Поставщик</th>
                <th className={`${thCls} text-right`}>Продажи</th>
                <th className={`${thCls} text-right`}>Остаток, ед.</th>
                <th className={`${thCls} text-right`}>Закуп на складе</th>
                <th className={`${thCls} text-right`}>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.supplierId} className="border-b border-line last:border-0">
                  <td className={tdCls}>{s.supplier}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(s.revenue)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{s.stockUnits}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(s.stockValue)}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>
                    {fmtMoney(s.margin)} <span className="text-xs text-dim">({s.marginPct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* V2-AN06: долги */}
      <Section title="Долги клиентов">
        {debts && (
          <>
            <div className="mb-5 flex flex-wrap gap-8">
              <div>
                <p className="label text-dim">Общий долг</p>
                <p className="mt-1 text-2xl tabular-nums">{fmtMoney(debts.total)}</p>
              </div>
              <div>
                <p className="label text-dim">Просроченный</p>
                <p className="mt-1 text-2xl tabular-nums text-red-700">{fmtMoney(debts.overdueTotal)}</p>
              </div>
            </div>
            <div className="overflow-x-auto border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thCls}>Клиент</th>
                    <th className={`${thCls} text-right`}>Долг</th>
                    <th className={`${thCls} text-right`}>Просрочено</th>
                    <th className={`${thCls} text-right`}>Макс. просрочка, дн.</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.debtors.map((d: any) => (
                    <tr key={d.userId} className="border-b border-line last:border-0">
                      <td className={tdCls}>
                        {d.name}
                        {d.company && <span className="block text-xs text-dim">{d.company}</span>}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums`}>{fmtMoney(d.total)}</td>
                      <td className={`${tdCls} text-right tabular-nums ${d.overdue > 0 ? "text-red-700" : ""}`}>
                        {d.overdue > 0 ? fmtMoney(d.overdue) : "—"}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums`}>{d.maxOverdueDays || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* V2-AN07: реализация */}
      <Section title="Реализация (товар у клиентов)">
        <ul className="space-y-4">
          {consignments.map((c) => (
            <li key={c.id} className="border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  {c.client}
                  {c.company && <span className="text-dim"> · {c.company}</span>}
                </p>
                <p className="text-xs text-dim">
                  Передано {new Date(c.createdAt).toLocaleDateString("ru-RU")} ({c.ageDays} дн. назад)
                  {c.ageDays > 90 && <span className="ml-2 text-red-700">давний документ</span>}
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {c.items.map((i: any, idx: number) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span>
                      {i.product} <span className="text-xs text-dim">({i.model})</span> — {i.quantity} ед.
                    </span>
                    <span className="tabular-nums">{fmtMoney(i.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-2 text-right text-sm tabular-nums">Итого: {fmtMoney(c.amount)}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
