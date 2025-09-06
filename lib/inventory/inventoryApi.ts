// lib/inventoryApi.ts (эсвэл таны одоо байгаа файл)
'use client';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Category = { id: string; name: string; parent_id: string | null };
export type CreateProductPayload = {
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  price?: number;
  cost?: number;
  trackInventory: boolean;
  isActive: boolean;
  description?: string;
  images: string[];
  variants: Array<{
    id?: string;
    color?: string;
    size?: string;
    sku?: string;
    barcode?: string;
    price?: number;
  }>;
  initialStocks: Record<string, number>;
};


export async function listCategories({ limit = 1000 } = {}): Promise<Category[]> {
  let token: string;
  try { token = await getAccessToken(); } catch { return []; }

  const tenantId = await getTenantId();
  if (!tenantId) return [];

  const url = new URL(`${BASE}/functions/v1/category`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('tenant_id', tenantId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`listCategories failed: ${res.status} ${text}`);

  const json = text ? JSON.parse(text) : {};
  const rows: any[] = Array.isArray(json) ? json : (json.items ?? json.data ?? json.categories ?? []);
  return rows.map(r => ({ id: String(r.id), name: String(r.name), parent_id: r.parent_id ?? null }));
}

export type IncomingTransferLine = { lineId: string; productId: string; expectedQty: number; name: string };
export type IncomingTransfer = { id: string; fromStoreName: string; items: IncomingTransferLine[] };

export async function listIncomingTransfers(_toStoreId: string): Promise<IncomingTransfer[]> {
  return [];
}

/* ===== Write APIs — NO-OP (хоосон объект/хий ID) ===== */
export async function apiCountSubmit(_payload: {
  storeId: string;
  items: { id: string; counted: number }[];
}) {
  
  return {};
}

export async function apiTransferSubmit(_payload: {
  fromStoreId: string;
  toStoreId: string;
  items: { id: string; qty: number }[];
}) {
  return {};
}

export async function apiReceiveSubmit(_payload: {
  storeId: string;
  receipts: { transferId: string; lines: { lineId: string; productId: string; qty: number }[] }[];
}) {
  return {};
}

export async function apiCreateProduct(payload: CreateProductPayload) {
  const token = await getAccessToken();            // таны supabaseClient-ийнх
  // Хэрэв таны функц body-д tenant_id шаарддаг бол:
  // const tenantId = await getTenantId();

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const tenantId = await getTenantId();

  const body = {
    tenant_id: tenantId,                      // JWT-ээс авдаггүй бол нээгээд явуул
    name: payload.name,
    category_id: (payload as any).category_id ?? null,   // UI-гаас category_id ирдэг бол энд тавина
    variants: (payload.variants ?? []).map(v => ({
      name: [v.color, v.size].filter(Boolean).join(' / ') || payload.name,
      sku: v.sku,
      barcode: v.barcode,
      price: v.price ?? payload.price ?? 0,
      cost: payload.cost ?? null,
      attrs: { color: v.color ?? null, size: v.size ?? null },
    })),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Create product failed', res.status, text);
    throw new Error(`product create failed ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

export async function apiCategoryCreate(input: {
  tenantId: string;          //必
  name: string;              //必
  parentId?: string | null;  // optional
}): Promise<Category> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/functions/v1/category`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON,
    },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      name: input.name,
      parent_id: input.parentId ?? null,
    }),
  });

  if (!res.ok) {
    throw new Error(`category create failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const row = json.category ?? json; // backend янз бүр буцааж болдог тул normalize
  return {
    id: String(row.id),
    name: String(row.name),
    parent_id: row.parent_id ?? null,
  };
}

export async function apiSubcategoryCreateAuto(opts: {
  parentId: string;
  name: string;
}): Promise<Category> {
  const token = await getAccessToken();
  const tenantId = await getTenantId(); // таны in-memory кэштэй функц
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ tenant_id: tenantId, name: opts.name, parent_id: opts.parentId }),
  });
  if (!res.ok) throw new Error(`subcategory create failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const row = json.category ?? json;
  return { id: String(row.id), name: String(row.name), parent_id: row.parent_id ?? null };
}

/* ===== Helpers (ашиглагддаг тул хэвээр) ===== */
export function buildCategoryHelpers(cats: Category[]) {
  const byId = new Map<string, Category>();
  const children = new Map<string | null, Category[]>();

  for (const c of cats) {
    byId.set(c.id, c);
    const key = c.parent_id;
    const arr = children.get(key) ?? [];
    arr.push(c);
    children.set(key, arr);
  }
  for (const arr of children.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

  function getChildren(parentId: string | null) {
    return children.get(parentId) ?? [];
  }
  function getAncestors(id: string | null): Category[] {
    const out: Category[] = [];
    let cur = id ? byId.get(id) ?? null : null;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) ?? null : null;
    }
    return out;
  }
  function getDescendantIds(id: string): string[] {
    const acc: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      acc.push(cur);
      for (const ch of getChildren(cur)) stack.push(ch.id);
    }
    return acc;
  }

  return { byId, getChildren, getAncestors, getDescendantIds };
}
