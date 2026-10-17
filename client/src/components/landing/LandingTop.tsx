import type { Product } from "../../types";
import Hero from "./Hero";
import { About, Advantages, CategoryTiles, Facts, type CategoryTile } from "./Story";

/** Лендинг до каталога. Грузится отдельным чанком вместе с gsap/motion. */
export default function LandingTop({
  categories,
  products,
  models,
  branches,
}: {
  categories: CategoryTile[];
  products: Product[];
  /** null — каталог ещё грузится */
  models: number | null;
  branches: number;
}) {
  return (
    <>
      <Hero products={products} />
      <CategoryTiles categories={categories} />
      {models !== null && <Facts models={models} categories={categories.length} branches={branches} />}
      <About />
      <Advantages />
    </>
  );
}
