import { useState } from "react";
import { imageSrcSet, sizedImage } from "../images";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  /** ширина картинки в вёрстке — для выбора превью из srcSet */
  sizes?: string;
  fetchPriority?: "high" | "low" | "auto";
}

export default function ProductImage({ src, alt, className = "", width, height, loading, sizes, fetchPriority }: Props) {
  const [broken, setBroken] = useState(false);
  const empty = !src || broken;

  if (empty) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`}
        role="img"
        aria-label={alt ? `${alt}. Фото нет` : "Фото нет"}
      >
        <span className="label px-2 text-center text-dim">Нет фото</span>
      </div>
    );
  }

  return (
    <img
      src={sizedImage(src, 640)}
      srcSet={imageSrcSet(src)}
      // миниатюры (корзина, заказы, галерея) — по их ширине, иначе браузер возьмёт превью для сетки
      sizes={sizes ?? (width && width <= 120 ? `${width}px` : "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw")}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
