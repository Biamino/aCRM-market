import type { Product } from "../../types";
import { AssortmentTips, FabricGuide, PackGuide } from "./Guides";
import { ContactCta, Faq, HowToOrder, Reviews } from "./Process";

/** Лендинг после каталога: гиды, процесс, отзывы, вопросы. */
export default function LandingBottom({ products }: { products: Product[] }) {
  return (
    <>
      <PackGuide products={products} />
      <FabricGuide />
      <AssortmentTips />
      <HowToOrder />
      <Reviews />
      <Faq />
      <ContactCta />
    </>
  );
}
