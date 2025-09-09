export interface ProductStockSummary {
  id: string;
  name: string;
  sku?: string;
  qty?: number;
  price?: number;
  cost?: number;
  category?: string;
  description?: string;
  image?: string;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    cost: number;
    stock: number;
    attrs?: Record<string, string>;
  }>;
  totalStock?: number;
}
