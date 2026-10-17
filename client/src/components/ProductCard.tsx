import { useState } from "react";
import { Link } from "react-router-dom";
import { fmtMoney, productHref } from "../api";
import type { Product } from "../types";
import ColorSwatches from "./ColorSwatches";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  const colors = product.colors?.length
    ? product.colors
    : [{ color: product.color, hex: product.colorHex ?? null, imageUrl: product.imageUrl, inStock: product.inStock }];
  const [selectedColor, setSelectedColor] = useState(product.color);
  const selected = colors.find((c) => c.color === selectedColor) ?? colors[0];
  const href = productHref(product.id, selected.color);
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-deep";

  return (
    <article>
      <Link to={href} className={`group block ${focus}`}>
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <ProductImage
            src={selected.imageUrl || product.imageUrl}
            alt={selected.color ? `${product.name}, цвет ${selected.color}` : product.name}
            loading="lazy"
            width={600}
            height={800}
            className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-85"
          />
          {!selected.inStock && (
            <span className="label absolute left-0 top-3 bg-brand-deep px-3 py-1 text-on-brand">Нет в наличии</span>
          )}
        </div>
      </Link>
      <div className="pt-3">
        <ColorSwatches colors={colors} selected={selected.color} onSelect={(c) => setSelectedColor(c.color)} className="" />
        <h3 className={`label ${colors.length > 1 ? "mt-1.5" : ""}`}>
          <Link to={href} className={focus}>
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-dim">
          {product.model}
          {selected.color && ` · ${selected.color}`}
        </p>
        <p className="mt-1.5 text-sm tabular-nums">
          {product.price !== null ? (
            <>
              {fmtMoney(product.price)} <span className="text-xs text-dim">/ ед. · пачка {product.packSize} шт.</span>
            </>
          ) : (
            <span className="text-dim">Цена после входа</span>
          )}
        </p>
      </div>
    </article>
  );
}
