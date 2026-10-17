import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { productHref } from "../../api";
import type { Product } from "../../types";
import SplitText from "../bits/SplitText";
import RotatingText from "../bits/RotatingText";
import Magnet from "../bits/Magnet";
import { introDelay } from "../Preloader";
import CircleGallery, { type GalleryItem } from "./CircleGallery";
import { ASSORTMENT, BRAND_CLASS, HeroLayout } from "./HeroLayout";

const RING_SIZE = 8;

/**
 * Первый экран: слева бренд, фраза с ассортиментом и CTA, справа — кольцо фото моделей
 * с витрины (CircleGallery). Без фото кольцо не показывается, остаётся текст на градиенте.
 */
export default function Hero({ products }: { products: Product[] }) {
  const [delay] = useState(introDelay);
  // буквы ASDEM запускаем, когда прелоадер уже уехал
  const [brandReady, setBrandReady] = useState(delay === 0);
  useEffect(() => {
    if (brandReady) return;
    const t = window.setTimeout(() => setBrandReady(true), delay * 1000);
    return () => window.clearTimeout(t);
  }, [brandReady, delay]);

  const ring = useMemo<GalleryItem[]>(
    () =>
      products
        .filter((p) => p.imageUrl)
        .slice(0, RING_SIZE)
        .map((p) => ({
          src: p.imageUrl,
          alt: `${p.name}, ${p.color}`,
          title: p.name,
          subtitle: [p.model, p.color].filter(Boolean).join(" · "),
          href: productHref(p.id, p.color),
        })),
    [products],
  );

  return (
    <HeroLayout
      delay={delay}
      brand={
        brandReady ? (
          <SplitText
            text="ASDEM"
            tag="p"
            splitType="chars"
            effect="rise"
            mask
            trigger="load"
            delay={70}
            duration={1.1}
            ease="power4.out"
            className={BRAND_CLASS}
          />
        ) : (
          <p className={`${BRAND_CLASS} invisible`}>ASDEM</p>
        )
      }
      accent={
        <RotatingText
          texts={ASSORTMENT}
          effect="slide"
          rotationInterval={2600}
          staggerDuration={0.02}
          staggerFrom="first"
          mainClassName="text-accent italic"
          splitLevelClassName="overflow-hidden pb-1"
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
        />
      }
      primaryCta={
        <Magnet padding={60} magnetStrength={4} maxOffset={10}>
          <Link to="/register" className="btn">
            Получить оптовые цены
          </Link>
        </Magnet>
      }
      aside={
        ring.length > 2 && (
          <CircleGallery items={ring} autoSpin={6} throwResistance={0.35} introDelay={delay + 0.3} />
        )
      }
    />
  );
}
