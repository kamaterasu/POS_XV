// apps/web/src/lib/inventory/inventorySummary.ts
'use client';

import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;



export type Product = { id: string; name: string; qty: number; price: number; imgPath?: string };
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

/* ===== listProducts → ProductStockSummary[] буцаана ===== */
export type ListProductsOpts = {
  storeId?: string;          // 'all' бол шүүхгүй
  categoryId?: string;       // ганц id
  categoryIds?: string[];    // олон id
  q?: string;                // хайлт (нэр/sku гэх мэт)
  limit?: number;            // хүсвэл page size
  offset?: number;           // хүсвэл page offset
};

export async function listProducts(opts: ListProductsOpts = {}): Promise<ProductStockSummary[]> {
  // Auth
  let token: string;
  try { token = await getAccessToken(); } catch { return []; }

  const tenantId = await getTenantId();
  if (!tenantId) return [];

  // Query params бэлдэнэ
  const {
    storeId,
    categoryId,
    categoryIds,
    q,
    limit = 50,
    offset = 0,
  } = opts;

  const url = new URL(`${BASE}/functions/v1/inventory`);
  url.searchParams.set('tenant_id', tenantId);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  if (storeId && storeId !== 'all') url.searchParams.set('store_id', storeId);

  const cats = Array.from(
    new Set([categoryId, ...(categoryIds ?? [])].filter(Boolean))
  ) as string[];
  if (cats.length) url.searchParams.set('category_ids', cats.join(','));

  if (q?.trim()) url.searchParams.set('q', q.trim());

  // Fetch
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`listProducts (inventory) failed: ${res.status} ${text}`);

  // Summarize
  const json: InventoryApiResponse = text ? JSON.parse(text) : { items: [], count: 0, limit, offset, scope: 'store' };
  return summarizeInventory(json); // ⬅️ { productId, productName, totalQty, variants: [...] }
}

export function toProducts(arr: ProductStockSummary[]): Product[] {
  return arr.map(p => ({
    id: p.productId,
    name: p.productName,
    qty: p.totalQty,
    price: p.variants[0]?.price ?? 0,
    imgPath: undefined,
  }));
}

export async function getProductById(
  id: string,
  opts?: { storeId?: string; categoryIds?: string[]; q?: string }
): Promise<ProductStockSummary | null> {
  const all = await listProducts(opts ?? {}); // танай already-ашиглаж байгаа listProducts (summary буцаадаг)
  return all.find(p => p.productId === id) ?? null;
}