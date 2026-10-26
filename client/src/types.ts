/** Цвет модели из CRM (product_colors). Остаток общий на модель. */
export interface ProductColor {
  color: string;
  hex: string | null;
  imageUrl: string;
  inStock: boolean;
}

export interface Product {
  id: number; // id модели (products) в общей базе CRM
  productId?: number;
  model: string;
  name: string;
  color: string;
  colorHex?: string | null;
  colors?: ProductColor[];
  imageUrl: string;
  imageUrls?: string[];
  category: string;
  sizes: string[];
  packComposition: Record<string, number>;
  packSize: number;
  allowUnits: boolean;
  price: number | null;
  stockPacks: number | null;
  inStock: boolean;
  fabric?: string | null;
  composition?: string | null;
  season?: string | null;
  country?: string | null;
  fitNotes?: string | null;
  description?: string | null;
}

export interface Branch {
  id: string;
  name: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  status?: string;
  /** персональная скидка клиента, % — применяется ко всему заказу */
  discountPercent?: number;
}

export interface CartItem {
  /** id модели (products) в общей базе CRM */
  productId: number;
  name: string;
  model: string;
  color?: string;
  imageUrl: string;
  price: number;
  packSize: number;
  allowUnits: boolean;
  stockPacks: number;
  packs: number;
  units: number;
  size?: string;
}

export interface Order {
  id: number;
  status: string;
  /** к оплате, со скидкой */
  total: number;
  /** сумма без скидки */
  subtotal?: number;
  discount?: number;
  discountPercent?: number;
  /** web — оформлен на сайте, crm — заведён сотрудником в CRM */
  source?: "web" | "crm";
  comment?: string | null;
  createdAt: string;
  user?: { name: string; company?: string | null; email: string };
  items: {
    id: number;
    packs: number;
    units: number;
    size?: string | null;
    unitPrice: number;
    lineTotal: number;
    product: { name: string; model: string; color?: string; imageUrl: string; packSize: number };
  }[];
}
