import type { Product } from "../../types";
import Hero from "./Hero";
import { About, Advantages, CategoryTiles, type CategoryTile } from "./Story";

/** Лендинг до каталога. Грузится отдельным чанком вместе с gsap/motion. */
export default function LandingTop({
  categories,
  products,
}: {
  categories: CategoryTile[];
  products: Product[];
}) {
  return (
    <>
      <Hero products={products} />
      <CategoryTiles categories={categories} />
      <About />
      <Advantages />
    </>
  );
}
