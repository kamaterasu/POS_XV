'use client';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Product = { id: string; name: string; qty: number; price: number; imgPath?: string };

export async function listProducts(_opts: {
  storeId?: string;
  categoryId?: string;
  categoryIds?: string[];
  q?: string;
}): Promise<Product[]> {
  let token: string;
  try { token = await getAccessToken(); } catch { return []; }

  const tenantId = await getTenantId();
  if (!tenantId) return [];

  const url = new URL(`${BASE}/functions/v1/product?tenant_id=${tenantId}&search=&limit=20&offset=0`);
  url.searchParams.set('tenant_id', tenantId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`listProducts failed: ${res.status} ${text}`);

  const json = text ? JSON.parse(text) : {};
  const rows: any[] = Array.isArray(json) ? json : (json.items ?? json.data ?? []);
  return rows.map(r => ({ id: String(r.id), name: String(r.name), qty: r.qty, price: r.price, imgPath: r.imgPath }));
}