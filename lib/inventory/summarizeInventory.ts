// apps/web/src/lib/inventory/inventorySummary.ts
import type { Product } from '@/lib/inventory/inventoryTypes';

/* ===== Types (API response) ===== */
export type InventoryApiResponse = {
  items: InventoryItem[];
  count: number;
  limit: number;
  offset: number;
  scope: string; // 'store' гэх мэт
};

export type InventoryItem = {
  store_id: string;
  variant_id: string;
  qty: number;
  variant: {
    id: string;
    name: string; // ж: "Black / M"
    sku: string;
    attrs: Record<string, string>; // ж: { size:"M", color:"Black" }
    price: number;
    cost: number;
  };
  product: {
    id: string;
    name: string;
  };
};

/* ===== Output summary per product ===== */
export type ProductStockSummary = {
  productId: string;
  productName: string;
  totalQty: number; // бүх салбар, бүх вариантын нийлбэр
  variants: Array<{
    variantId: string;
    name: string;
    sku: string;
    attrs: Record<string, string>;
    price: number;
    qty: number; // тухайн вариантын нийлбэр (бүх салбараас)
  }>;
};

/**
 * API-ийн өгөгдлийг нэгтгэн, бараа бүрийн нийлбэр нөөц ба
 * вариант тус бүрийн нийлбэрийг гаргана.
 */
export function summarizeInventory(resp: InventoryApiResponse): ProductStockSummary[] {
  const productMap = new Map<
    string,
    { productName: string; totalQty: number; variants: Map<string, ProductStockSummary['variants'][number]> }
  >();

  for (const it of resp.items ?? []) {
    const pId = it.product.id;
    const vId = it.variant.id;

    // Барааны bucket
    let pBucket = productMap.get(pId);
    if (!pBucket) {
      pBucket = {
        productName: it.product.name,
        totalQty: 0,
        variants: new Map(),
      };
      productMap.set(pId, pBucket);
    }

    // Нийт барааны qty-д нэмэх
    pBucket.totalQty += it.qty;

    // Вариантын bucket
    let vBucket = pBucket.variants.get(vId);
    if (!vBucket) {
      vBucket = {
        variantId: it.variant.id,
        name: it.variant.name,
        sku: it.variant.sku,
        attrs: it.variant.attrs ?? {},
        price: it.variant.price,
        qty: 0,
      };
      pBucket.variants.set(vId, vBucket);
    }
    vBucket.qty += it.qty;
  }

  // Map -> массив болгон буцаах
  const result: ProductStockSummary[] = [];
  for (const [productId, { productName, totalQty, variants }] of productMap.entries()) {
    result.push({
      productId,
      productName,
      totalQty,
      variants: Array.from(variants.values()),
    });
  }
  return result;
}

