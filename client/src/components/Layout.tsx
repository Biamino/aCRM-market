import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth, useBranch, useCart } from "../store";
import wordmark from "../assets/logo-wordmark.webp";
import mark from "../assets/logo-mark.webp";
import CookieBanner from "./CookieBanner";
import Preloader from "./Preloader";
import { LEGAL_NAV } from "../legal/documents";
import { COMPANY } from "../legal/company";
import { SITE_CONTENT } from "../siteContent";

interface Category {
  id: number;
  name: string;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { pageKey } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const isHome = location.pathname === "/";

  // категории — только после входа (гостю сервер отдаёт пустой список); перезапрос при входе/выходе
  useEffect(() => {
    if (!user) return setCategories([]);
    api<{ categories: Category[] }>("/catalog/categories")
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, [pageKey, user]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Preloader />

      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3.5 md:px-8 md:py-4">
          <nav aria-label="Аккаунт" className="flex items-center gap-4 md:gap-6">
            {user?.role === "ADMIN" && (
              <NavLink to="/admin" className="label hidden hover:text-accent md:block">
                Админ
              </NavLink>
            )}
            {user && user.role !== "ADMIN" && (
              <NavLink to="/orders" className="label hidden hover:text-accent md:block">
                Заказы
              </NavLink>
            )}
            {user ? (
              <button
                type="button"
                className="label cursor-pointer hover:text-accent"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Выйти
              </button>
            ) : (
              <NavLink to="/login" className="label hover:text-accent">
                Войти
              </NavLink>
            )}
          </nav>

          <Link to="/" className="justify-self-center" aria-label="ASDEM — на главную">
            <img src={mark} alt="" width={36} height={31} className="h-8 w-auto md:hidden" />
            <img
              src={wordmark}
              alt="ASDEM"
              width={160}
              height={33}
              className="hidden h-7 w-auto md:block lg:h-8"
            />
          </Link>

          <nav aria-label="Основная навигация" className="flex items-center justify-end gap-4 md:gap-7">
            {!user && (
              <NavLink to="/register" className="label hidden hover:text-accent sm:block">
                Партнёрам
              </NavLink>
            )}
            <NavLink
              to="/cart"
              className="label relative hover:text-accent"
              aria-label={`Корзина, позиций: ${count}`}
            >
              Корзина
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="ml-1.5 inline-flex min-h-5 min-w-5 items-center justify-center bg-brand-deep px-1.5 text-[10px] text-on-brand"
                >
                  {count}
                </span>
              )}
            </NavLink>
          </nav>
        </div>

        {user && (
        <div className="mx-auto max-w-7xl overflow-x-auto border-t border-line/60 px-4 md:px-8">
          <nav aria-label="Категории" className="flex min-h-14 items-center gap-6 whitespace-nowrap py-3">
            <NavLink
              to="/"
              end
              className={() => {
                const active = isHome && !new URLSearchParams(location.search).get("category");
                return `label hover:text-accent ${active ? "text-brand-deep underline decoration-brand underline-offset-4" : "text-dim"}`;
              }}
            >
              Все
            </NavLink>
            {categories.map((c) => {
              const active = new URLSearchParams(location.search).get("category") === c.name;
              return (
                <NavLink
                  key={c.id}
                  to={`/?category=${encodeURIComponent(c.name)}`}
                  className={`label hover:text-accent ${active ? "text-brand-deep underline decoration-brand underline-offset-4" : "text-dim"}`}
                >
                  {c.name}
                </NavLink>
              );
            })}
          </nav>
        </div>
        )}
      </header>

      {!user && !isHome && (
        <div className="border-b border-line bg-brand-soft/70">
          <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
            <p className="text-xs text-ink">
              Закрытый оптовый шоурум ASDEM. Цены и наличие доступны после одобрения заявки.{" "}
              <Link to="/register" className="text-brand-deep underline">
                Оставить заявку
              </Link>
            </p>
          </div>
        </div>
      )}

      <main id="main" className={isHome ? "w-full flex-1" : "mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8"}>
        {/* смена филиала перезагружает страницу: товары и заказы у филиалов свои */}
        <Outlet key={pageKey} />
      </main>

      <footer className="border-t border-line bg-ink text-brand">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Link to="/" aria-label="ASDEM">
                <img src={wordmark} alt="ASDEM" width={140} height={29} loading="lazy" className="h-6 w-auto brightness-110" />
              </Link>
              <p className="mt-3 max-w-md text-xs text-brand">
                {SITE_CONTENT.footer}
              </p>
              {COMPANY.whatsapp && (
                <a
                  href={`https://wa.me/${COMPANY.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm text-brand transition-colors hover:text-paper"
                >
                  WhatsApp: {COMPANY.whatsappDisplay}
                </a>
              )}
            </div>
            <nav aria-label="Юридическая информация" className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_NAV.map((item) => (
                <Link
                  key={item.slug}
                  to={`/legal/${item.slug}`}
                  className="text-xs text-brand/80 underline-offset-2 transition-colors hover:text-brand hover:underline"
                >
                  {item.shortTitle}
                </Link>
              ))}
            </nav>
          </div>
          <p className="text-[11px] text-paper/60">
            © {new Date().getFullYear()} ASDEM. Закрытый B2B-сайт. Использование означает согласие с
            условиями документов.
          </p>
        </div>
      </footer>
      <CookieBanner />
    </div>
  );
}
