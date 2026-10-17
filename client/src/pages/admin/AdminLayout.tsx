import { NavLink, Outlet } from "react-router-dom";
import BranchSwitcher from "../../components/BranchSwitcher";
import { useBranch } from "../../store";
import { usePageMeta } from "../../usePageMeta";

const tabs = [
  { to: "/admin", label: "Аналитика", end: true },
  { to: "/admin/insights", label: "Выводы" },
  { to: "/admin/products", label: "Товары" },
  { to: "/admin/registrations", label: "Заявки на доступ" },
  { to: "/admin/orders", label: "Заказы" },
];

export default function AdminLayout() {
  usePageMeta({ title: "Админ-панель", noindex: true });
  const { branchName, pageKey } = useBranch();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl">
          Админ-панель{branchName && <span className="text-dim"> · {branchName}</span>}
        </h1>
        <BranchSwitcher />
      </div>
      <nav aria-label="Разделы админ-панели" className="mt-6 overflow-x-auto border-b border-line">
        <div className="flex gap-8 whitespace-nowrap">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `label border-b-2 pb-3 transition-colors duration-200 ${
                  isActive ? "border-brand-deep text-brand-deep" : "border-transparent text-dim hover:text-accent"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="py-8">
        <Outlet key={pageKey} />
      </div>
    </div>
  );
}
