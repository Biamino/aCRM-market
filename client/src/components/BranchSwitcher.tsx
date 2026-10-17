import { useBranch } from "../store";

/** Переключатель филиала: каталог, корзина и заказы показываются по выбранному. */
export default function BranchSwitcher({ className = "" }: { className?: string }) {
  const { branches, branch, setBranch } = useBranch();
  if (branches.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Филиал" className={`inline-flex shrink-0 border border-line ${className}`}>
      {branches.map((b) => {
        const active = b.id === branch;
        return (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`label min-h-8 cursor-pointer px-3 transition-colors duration-200 ${
              active ? "bg-brand-deep text-on-brand" : "text-dim hover:text-accent"
            }`}
            onClick={() => setBranch(b.id)}
          >
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
