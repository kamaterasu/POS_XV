export type Product = {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  created_at: string;
  img: string | null;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  attrs: Record<string, any>;
  sku: string | null;
  price: number;
  cost: number | null;
  created_at: string;
  qty?: number;
};

export type ProductData = {
  product: Product;
  variants?: ProductVariant[];
};

export type Category = {
  id: string;
  name: string;
  children?: Category[];
};
