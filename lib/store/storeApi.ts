// /lib/store/storeApi.ts
import { jwtDecode } from "jwt-decode";

/** ==== Types ==== */
export type StoreRow = {
  id: string;
  name: string;
  // нэмэл мэдээлэл байж болно
  [k: string]: any;
};

type TenantResp = {
  id: string;
  name?: string;
  stores?: StoreRow[];
  [k: string]: any;
};

/** ==== Helpers ==== */
function getTenantIdFromToken(token: string): string | undefined {
  try {
    const decoded: any = jwtDecode(token);
    return decoded?.app_metadata?.tenants?.[0];
  } catch {
    return undefined;
  }
}

async function fetchJson<T>(
  url: string | URL,
  init: RequestInit
): Promise<T> {
  const res = await fetch(typeof url === "string" ? url : url.toString(), {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      // apikey нэмэх нь browser-оос edge functions дуудах үед найдвартай
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      ...(init.headers || {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** ==== Tenant → Stores авагч (edge function: /functions/v1/tenant) ==== */
async function getTenantWithStores(
  token: string,
  tenant_id?: string
): Promise<TenantResp> {
  const tid = tenant_id || getTenantIdFromToken(token);
  if (!tid) throw new Error("tenant_id олдсонгүй (JWT).");

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`
  );
  url.searchParams.set("id", tid);
  url.searchParams.set("withStores", "true");

  return await fetchJson<TenantResp>(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** ==== Public API ==== */

/** Нэг сарын ‘default’ store ID (stores[0]) буцаана */
export async function getStoredID(token: string): Promise<string | undefined> {
  const resp = await getTenantWithStores(token);
  return resp?.stores?.[0]?.id;
}

/** Stores массивийг буцаана */
export async function getStore(token: string): Promise<StoreRow[]> {
  const resp = await getTenantWithStores(token);
  return resp?.stores ?? [];
}

/** Stores name -> id map (эхлээд нэрээр seed хийхэд хэрэгтэй) */
export async function getStoreMapByName(
  token: string
): Promise<Map<string, string>> {
  const stores = await getStore(token);
  return new Map(stores.map((s) => [String(s.name ?? ""), String(s.id)]));
}

/** Stores жагсаалтыг шууд авах alias (нэр нь илүү ойлгомжтой) */
export async function listStores(token: string): Promise<StoreRow[]> {
  return await getStore(token);
}

/** Store олон нэрээр үүсгэх */
export async function createStore(names: string[], token: string) {
  const tenant_id = getTenantIdFromToken(token);
  if (!tenant_id) throw new Error("tenant_id олдсонгүй (JWT).");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`;
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenant_id, names }),
  });
}

/** Нэг store-ийг шинэчлэх */
export async function updateStore(id: string, name: string, token: string) {
  const tenant_id = getTenantIdFromToken(token);
  if (!tenant_id) throw new Error("tenant_id олдсонгүй (JWT).");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`;
  return await fetchJson<any>(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenant_id, id, name }),
  });
}

/** Нэг store-ийг устгах */
export async function deleteStore(id: string, token: string) {
  const tenant_id = getTenantIdFromToken(token);
  if (!tenant_id) throw new Error("tenant_id олдсонгүй (JWT).");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`;
  return await fetchJson<any>(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenant_id, id, confirm: "DELETE" }),
  });
}
