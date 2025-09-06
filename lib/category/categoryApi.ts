'use client';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Category = { id: string; name: string; parent_id: string | null };

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