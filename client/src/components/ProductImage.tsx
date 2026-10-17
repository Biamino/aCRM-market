import { useState } from "react";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}

export default function ProductImage({ src, alt, className = "", width, height, loading }: Props) {
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
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      onError={() => setBroken(true)}
      className={className}
    />
  );
}
