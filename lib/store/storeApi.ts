'use client';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type StoreRow = { id: string; name: string };

function pickRows(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  return json.items ?? json.data ?? json.rows ?? [];
}

/** ---------- READ: Stores (массив буцаана) ---------- */
export async function listStores(): Promise<StoreRow[]> {
  const token = await getAccessToken().catch(() => null);
  if (!token) return [];

  const tenantId = await getTenantId().catch(() => null);
  if (!tenantId) return [];

  const url = new URL(`${BASE}/functions/v1/store`);
  url.searchParams.set('tenant_id', tenantId);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`listStores failed: ${res.status} ${text}`);

  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  const rows = pickRows(json);
  return rows.map((r: any) => ({ id: String(r.id), name: String(r.name) }));
}

/** ---------- CREATE: Store (нэг мөр буцаана) ---------- */
export async function createStore(name: string): Promise<StoreRow> {
  if (!name?.trim()) throw new Error('STORE_NAME_REQUIRED');

  const token = await getAccessToken();
  const tenantId = await getTenantId();

  const res = await fetch(`${BASE}/functions/v1/store`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name, tenant_id: tenantId }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`createStore failed: ${res.status} ${text}`);

  const json = text ? JSON.parse(text) : {};
  const row = json.store ?? json.item ?? json.data ?? json;
  return { id: String(row.id), name: String(row.name ?? name) };
}
