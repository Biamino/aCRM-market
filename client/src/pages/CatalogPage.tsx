import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../store";
import type { Product } from "../types";
import { usePageMeta } from "../usePageMeta";
import type { CategoryTile } from "../components/landing/Story";
import { HeroLayout } from "../components/landing/HeroLayout";

// лендинг с анимациями (gsap, motion, WebGL) — отдельными чанками, каталогу и корзине они не нужны
const LandingTop = lazy(() => import("../components/landing/LandingTop"));
const LandingBottom = lazy(() => import("../components/landing/LandingBottom"));

interface CatalogResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export default function CatalogPage() {
  const { user, ready } = useAuth();
  // каталог (сетка, категории, поиск) — только после входа; гость видит лендинг
  const guest = ready && !user;
  const [params, setParams] = useSearchParams();
  const category = guest ? "" : (params.get("category") ?? "");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CategoryTile[]>([]);

  function query(pageNum: number) {
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    const search = guest ? "" : params.get("q");
    if (search) query.set("q", search);
    query.set("page", String(pageNum));
    return api<CatalogResponse>(`/catalog/products?${query}`);
  }

  useEffect(() => {
    setProducts(null);
    setPage(1);
    query(1)
      .then((d) => {
        setProducts(d.products);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, params, guest]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await query(page + 1);
      setProducts((prev) => [...(prev ?? []), ...d.products]);
      setPage(page + 1);
      setTotal(d.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const showHero = guest || (!category && !params.get("q"));
  usePageMeta(
    category
      ? {
          title: `${category} оптом`,
          description: `${category} ASDEM оптом от производителя: заказ от одной упаковки, доставка по СНГ.`,
        }
      : params.get("q")
        ? { title: `Поиск «${params.get("q")}»`, noindex: true }
        : {},
  );

  useEffect(() => {
    if (!showHero) return;
    api<{ categories: CategoryTile[] }>("/catalog/categories")
      .then((d) => setCategories(d.categories.filter((c) => c.name)))
      .catch(() => {});
  }, [showHero]);

  return (
    <div>
      {showHero && (
        <Suspense fallback={<HeroLayout />}>
          <LandingTop
            categories={categories}
            products={products ?? []}
          />
        </Suspense>
      )}

      {guest ? (
        <section id="catalog" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-10 md:px-8 md:py-14">
          <div className="border border-line bg-brand-soft/50 px-6 py-14 text-center md:py-20">
            <p className="label text-dim">Каталог</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Каталог открыт только для партнёров</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-dim">
              Войдите, чтобы увидеть модели, цены и наличие. Нет доступа — оставьте заявку, менеджер её рассмотрит.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login" className="btn">
                Войти
              </Link>
              <Link to="/register" className="btn-ghost">
                Получить доступ
              </Link>
            </div>
          </div>
        </section>
      ) : (
      <div id="catalog" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-10 md:px-8 md:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label text-dim">{showHero ? "New in" : "Каталог"}</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">{category || "Коллекция"}</h2>
          </div>
          <form
            className="w-full max-w-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const next = new URLSearchParams(params);
              if (q) next.set("q", q);
              else next.delete("q");
              setParams(next);
            }}
          >
            <label htmlFor="search" className="label mb-1 block text-dim">
              Поиск
            </label>
            <input
              id="search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Артикул, название, цвет"
              className="input"
            />
          </form>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {products === null ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-muted" />
                <div className="mt-3 h-3 w-2/3 bg-muted" />
                <div className="mt-2 h-3 w-1/3 bg-muted" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-sm text-dim">Ничего не найдено. Попробуйте изменить запрос.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.productId ?? p.id} product={p} />
              ))}
            </div>
            {products.length < total && (
              <div className="mt-12 text-center">
                <button type="button" className="btn-ghost min-w-64" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? "Загружаем…" : "Показать ещё"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {showHero && (
        <Suspense fallback={null}>
          <LandingBottom products={products ?? []} />
        </Suspense>
      )}
    </div>
  );
}
