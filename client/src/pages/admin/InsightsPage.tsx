import { useEffect, useState } from "react";
import { api } from "../../api";

interface Insight {
  type: string;
  severity: "info" | "warning" | "positive";
  text: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  positive: "Рост",
  warning: "Внимание",
  info: "Наблюдение",
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    api<{ insights: Insight[]; generatedAt: string }>("/insights").then((d) => {
      setInsights(d.insights);
      setGeneratedAt(d.generatedAt);
    });
  }, []);

  return (
    <div className="max-w-3xl">
      <p className="mb-6 text-sm leading-relaxed text-dim">
        Выводы формируются автоматически на основе правил и простой статистики. Модуль только объясняет
        данные — он не списывает товар, не меняет цены и не подтверждает операции.
      </p>

      {insights === null ? (
        <p className="py-10 text-sm text-dim">Анализируем данные…</p>
      ) : insights.length === 0 ? (
        <p className="py-10 text-sm text-dim">Пока нет значимых наблюдений.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((ins, idx) => (
            <li
              key={idx}
              className={`border-l-2 py-3 pl-4 pr-2 ${
                ins.severity === "warning"
                  ? "border-red-700"
                  : ins.severity === "positive"
                    ? "border-brand-deep"
                    : "border-line"
              }`}
            >
              <span
                className={`label ${
                  ins.severity === "warning" ? "text-red-700" : ins.severity === "positive" ? "" : "text-dim"
                }`}
              >
                {SEVERITY_LABEL[ins.severity]}
              </span>
              <p className="mt-1 text-sm leading-relaxed">{ins.text}</p>
            </li>
          ))}
        </ul>
      )}

      {generatedAt && (
        <p className="mt-8 text-xs text-dim">
          Сформировано {new Date(generatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}
