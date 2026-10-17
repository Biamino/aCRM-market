import { Link, Navigate, useParams } from "react-router-dom";
import { COMPANY } from "../legal/company";
import { LEGAL_BY_SLUG, LEGAL_NAV } from "../legal/documents";

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = slug ? LEGAL_BY_SLUG[slug] : undefined;
  if (!doc) return <Navigate to="/legal/terms" replace />;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="label mb-4 text-dim">Документы</p>
        <nav aria-label="Юридические документы" className="flex flex-col gap-2">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.slug}
              to={`/legal/${item.slug}`}
              className={`text-sm transition-colors duration-200 ${
                item.slug === doc.slug ? "text-brand-deep underline underline-offset-4" : "text-dim hover:text-brand-deep"
              }`}
            >
              {item.shortTitle}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-dim">
          Редакция от {COMPANY.docsUpdatedAt}. Перед продакшеном заполните реквизиты в{" "}
          <code className="text-[11px]">client/src/legal/company.ts</code>.
        </p>
      </aside>

      <article>
        <p className="label text-dim">{COMPANY.brand}</p>
        <h1 className="font-display mt-2 text-3xl md:text-4xl">{doc.title}</h1>
        <p className="mt-3 text-sm text-dim">{doc.description}</p>

        <div className="mt-10 space-y-8">
          {doc.sections.map((section, idx) => (
            <section key={idx}>
              {section.title && <h2 className="font-display text-xl">{section.title}</h2>}
              <div className={section.title ? "mt-3 space-y-3" : "space-y-3"}>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink/90">
                    {p}
                  </p>
                ))}
                {section.list && section.list.length > 0 && (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/90">
                    {section.list.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-line pt-6 text-xs text-dim">
          Документы носят информационный характер шаблона под модель закрытого B2B-сайта. Перед
          коммерческим запуском их должен проверить юрист Оператора с учётом актуальных реквизитов и
          договоров.
        </p>
      </article>
    </div>
  );
}
