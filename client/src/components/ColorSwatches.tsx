import { Link } from "react-router-dom";
import type { ProductColor } from "../types";

const NAMED: Record<string, string> = {
  белый: "#f4f1ea",
  молочный: "#f3ead8",
  крем: "#efe4cc",
  кремовый: "#efe4cc",
  пудра: "#e4c4c0",
  розовый: "#e8a0b0",
  персик: "#efc4a8",
  телесный: "#e0c4ae",
  нюд: "#d4b8a0",
  бежевый: "#d4c4a8",
  мята: "#9dccc0",
  мятный: "#9dccc0",
  изумруд: "#2d6a4f",
  голубой: "#7ba3c9",
  синий: "#1e3a5f",
  лаванда: "#b0a0c8",
  лавандовый: "#b0a0c8",
  фиолетовый: "#5c4d73",
  бордо: "#6b1c2a",
  красный: "#b42318",
  коралл: "#e07060",
  чёрный: "#1c1c1c",
  черный: "#1c1c1c",
  графит: "#4a4a4a",
  серый: "#8a8a8a",
  серебро: "#c0c0c0",
  серебряный: "#c0c0c0",
  коричневый: "#6b4423",
  шоколад: "#4a2c1a",
  хаки: "#6b6b43",
  оливковый: "#6b7040",
  горчичный: "#c4a035",
  золотой: "#c9a227",
};

/** Цвет кружка: hex из CRM (product_colors.color_hex), иначе по названию. */
export function hexFor(name: string, hex?: string | null): string {
  if (hex && /^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const key = name.trim().toLowerCase();
  if (NAMED[key]) return NAMED[key];
  const first = key.split(/[\s,/]+/)[0];
  if (NAMED[first]) return NAMED[first];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 28% 52%)`;
}

function isLight(color: string): boolean {
  if (color.startsWith("hsl")) return false;
  const c = color.replace("#", "");
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 210;
}

export default function ColorSwatches({
  colors,
  selected: selectedColor,
  onSelect,
  hrefFor,
  className = "mt-2",
}: {
  colors: ProductColor[];
  selected: string;
  onSelect?: (color: ProductColor) => void;
  hrefFor?: (color: ProductColor) => string;
  className?: string;
}) {
  if (colors.length <= 1) return null;

  return (
    <ul className={`flex flex-wrap gap-1 ${className}`} aria-label="Цвета">
      {colors.map((c) => {
        const selected = c.color === selectedColor;
        const fill = hexFor(c.color, c.hex);
        const className = `flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-deep ${
          onSelect || hrefFor ? "cursor-pointer" : ""
        }`;
        const dot = (
          <span
            className={`block h-5 w-5 rounded-full border ${
              selected ? "border-brand-deep ring-1 ring-brand-deep ring-offset-1 ring-offset-paper" : isLight(fill) ? "border-line" : "border-transparent"
            } ${c.inStock ? "" : "opacity-40"}`}
            style={{ background: fill }}
            aria-hidden
          />
        );
        return (
          <li key={c.color}>
            {hrefFor ? (
              <Link to={hrefFor(c)} className={className} aria-label={`Цвет ${c.color}`} aria-current={selected ? "true" : undefined} title={c.color}>
                {dot}
              </Link>
            ) : (
              <button
                type="button"
                className={className}
                aria-label={`Цвет ${c.color}`}
                aria-pressed={selected}
                title={c.color}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect?.(c);
                }}
              >
                {dot}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
