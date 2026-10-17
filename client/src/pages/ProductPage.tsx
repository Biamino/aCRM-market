import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, fmtMoney, productHref } from "../api";
import ColorSwatches from "../components/ColorSwatches";
import ProductImage from "../components/ProductImage";
import { useAuth, useCart } from "../store";
import type { Product } from "../types";

export default function ProductPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const color = params.get("color") ?? "";
  const { user } = useAuth();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [packs, setPacks] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    api<{ product: Product }>(`/catalog/products/${id}${color ? `?color=${encodeURIComponent(color)}` : ""}`)
      .then((d) => {
        setProduct(d.product);
        setPacks(d.product.stockPacks && d.product.stockPacks > 0 ? 1 : 0);
        setActiveImage(0);
        setAdded(false);
      })
      .catch((e) => setError(e.message));
  }, [id, color]);

  if (error) return <p className="py-16 text-center text-sm text-red-700">{error}</p>;
  if (!product)
    return (
      <div className="grid animate-pulse gap-10 md:grid-cols-2">
        <div className="aspect-[3/4] bg-muted" />
        <div className="space-y-4 pt-4">
          <div className="h-4 w-1/4 bg-muted" />
          <div className="h-8 w-2/3 bg-muted" />
          <div className="h-4 w-1/3 bg-muted" />
        </div>
      </div>
    );

  const priceVisible = product.price !== null;
  const maxPacks = product.stockPacks ?? 0;
  const canOrder = user && priceVisible && product.inStock;
  const colors = product.colors?.length
    ? product.colors
    : [{ color: product.color, hex: product.colorHex ?? null, imageUrl: product.imageUrl, inStock: product.inStock }];

  const attrs: [string, string | null | undefined][] = [
    ["Ткань", product.fabric],
    ["Состав", product.composition],
    ["Сезон", product.season],
    ["Страна производства", product.country],
    ["Посадка", product.fitNotes],
  ];
  const gallery = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
  const currentSrc = gallery[activeImage] ?? gallery[0] ?? "";

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div>
        <div className="aspect-[3/4] overflow-hidden bg-muted">
          <ProductImage
            src={currentSrc}
            alt={product.color ? `${product.name}, цвет ${product.color}` : product.name}
            width={600}
            height={800}
            className="h-full w-full object-cover"
          />
        </div>
        {gallery.length > 1 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Фотографии товара">
            {gallery.map((src, i) => (
              <li key={`${src}-${i}`}>
                <button
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-pressed={activeImage === i}
                  aria-label={`Фото ${i + 1}`}
                  className={`h-16 w-12 cursor-pointer overflow-hidden border ${
                    activeImage === i ? "border-brand-deep" : "border-line hover:border-brand"
                  }`}
                >
                  <ProductImage src={src} alt="" className="h-full w-full object-cover" width={48} height={64} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-w-lg">
        <p className="label text-dim">
          {product.category} · {product.model}
        </p>
        <h1 className="font-display mt-2 text-3xl">{product.name}</h1>
        <div className="mt-3">
          {product.color && <p className="text-sm text-dim">Цвет: {product.color}</p>}
          <ColorSwatches colors={colors} selected={product.color} hrefFor={(c) => productHref(product.id, c.color)} />
        </div>

        <p className="mt-5 text-xl tabular-nums">
          {priceVisible ? (
            <>
              {fmtMoney(product.price!)} <span className="text-sm text-dim">за единицу</span>
            </>
          ) : (
            <span className="text-base text-dim">
              Цена доступна после входа.{" "}
              <Link to="/login" className="text-brand-deep underline">
                Войти
              </Link>
            </span>
          )}
        </p>
        {priceVisible && (
          <p className="mt-1 text-sm tabular-nums text-dim">
            Пачка ({product.packSize} шт.) — {fmtMoney(product.price! * product.packSize)}
          </p>
        )}

        <div className="mt-6 border-t border-line pt-6">
          <h2 className="label mb-3">Состав пачки</h2>
          <div className="flex gap-2">
            {Object.entries(product.packComposition).map(([s, n]) => (
              <span key={s} className="border border-line px-3 py-2 text-xs">
                {s} × {n}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-dim">
            {product.stockPacks !== null
              ? product.stockPacks > 0
                ? `В наличии ${product.stockPacks} пачек`
                : "Нет в наличии"
              : product.inStock
                ? "В наличии (точный остаток виден после входа)"
                : "Нет в наличии"}
          </p>
        </div>

        {canOrder && (
          <div className="mt-6 border-t border-line pt-6">
            <div>
              <label htmlFor="packs" className="label mb-2 block">
                Пачки
              </label>
              <div className="inline-flex items-center border border-line">
                <button type="button" className="min-h-11 min-w-11 cursor-pointer hover:bg-muted" aria-label="Меньше пачек" onClick={() => setPacks(Math.max(1, packs - 1))}>
                  −
                </button>
                <input
                  id="packs"
                  type="number"
                  min={1}
                  max={maxPacks}
                  value={packs}
                  onChange={(e) => setPacks(Math.min(maxPacks, Math.max(1, Number(e.target.value))))}
                  className="w-14 border-0 py-3 text-center text-sm tabular-nums outline-none"
                />
                <button type="button" className="min-h-11 min-w-11 cursor-pointer hover:bg-muted" aria-label="Больше пачек" onClick={() => setPacks(Math.min(maxPacks, packs + 1))}>
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn mt-6 w-full"
              disabled={packs < 1}
              onClick={() => {
                add({
                  productId: product.id,
                  name: product.name,
                  model: product.model,
                  color: product.color || undefined,
                  imageUrl: product.imageUrl,
                  price: product.price!,
                  packSize: product.packSize,
                  allowUnits: false,
                  stockPacks: product.stockPacks ?? 0,
                  packs,
                  units: 0,
                });
                setAdded(true);
                setTimeout(() => setAdded(false), 2500);
              }}
            >
              {added ? "Добавлено в корзину" : "В корзину"}
            </button>
            <p className="mt-2 text-xs text-dim">Модель продаётся только полными пачками.</p>
          </div>
        )}

        {!user && (
          <div className="mt-6 border-t border-line pt-6">
            <Link to="/register" className="btn-ghost w-full">
              Оставить заявку на доступ
            </Link>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-6">
          {product.description && <p className="text-sm leading-relaxed">{product.description}</p>}
          <dl className="mt-4 space-y-2">
            {attrs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-3 text-sm">
                  <dt className="w-44 shrink-0 text-dim">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
