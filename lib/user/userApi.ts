'use client';
import { supabase } from '@/lib/supabaseClient';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Role = 'Admin' | 'Manager' | 'Cashier';
export type UserRow = { id: string; name: string; email: string; role: Role; store_ids: string[] };

const ROLE_TO_API = { Admin: 'OWNER', Manager: 'MANAGER', Cashier: 'CASHIER' } as const;
const API_TO_ROLE: Record<string, Role> = {
  owner: 'Admin', OWNER: 'Admin',
  manager: 'Manager', MANAGER: 'Manager',
  cashier: 'Cashier', CASHIER: 'Cashier',
};

async function requireSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('NOT_AUTHENTICATED');
  return session.access_token;
}

function pick<T = any>(v: any, keys: string[]): T | null {
  for (const k of keys) {
    const parts = k.split('.');
    let cur: any = v;
    for (const p of parts) cur = cur?.[p];
    if (cur !== undefined && cur !== null) return cur as T;
  }
  return null;
}

/** ---------- READ: Users list ---------- */
export async function listUsers(tenantId: string): Promise<UserRow[]> {
  const token = await requireSession();
  if (!tenantId) return [];

  // Postman screenshot-д GET {{project_url}}/user?tenant_id=... гэж харагдсан.
  // Supabase Edge Function нэр нь 'user' гэж авлаа. (Хэрвээ танайд өөр бол энд path-аа солиорой.)
  const url = new URL(`${BASE}/functions/v1/user?tenant_id=${tenantId}`);
  url.searchParams.set('tenant_id', tenantId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`listUsers failed: ${res.status} ${text}`);

  const json = text ? JSON.parse(text) : {};
  const rows: any[] = Array.isArray(json) ? json : (json.items ?? json.data ?? []);

const mapped: UserRow[] = rows.map((r) => {
  const id = String(
    pick(r, ['id', 'user_id', 'user.id', 'account_id']) ?? ''
  );

  const email = String(
    pick(r, ['email', 'user_email', 'user.email', 'profile.email']) ?? ''
  );

  const display = String(
    pick(r, [
      'display_name',
      'name',
      'user.user_metadata.full_name',
      'user.raw_user_meta_data.full_name',
      'profile.full_name',
    ]) ?? (email ? email.split('@')[0] : '—')
  );

  const roleApi = String(pick(r, ['role']) ?? '').toUpperCase();
  const role: Role = API_TO_ROLE[roleApi] ?? 'Cashier';

  // ---- store_ids: nullish coalescing(??) хэрэглэхгүйгээр аюулгүй задлая
  let store_ids: string[] = [];
  const arr = pick<any>(r, ['store_ids', 'stores', 'user.store_ids']);
  if (Array.isArray(arr)) store_ids = arr.map((x: any) => String(x));
  else {
    const one = pick<any>(r, ['store_id', 'store.id']);
    if (one != null && one !== '') store_ids = [String(one)];
  }

  return { id, name: display, email, role, store_ids };
});

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[users raw]', rows);
  }

  return mapped;
}

/** ---------- CREATE: User ---------- */
export async function createUser(args: {
  tenantId: string;
  email: string;
  password: string;
  name?: string;
  role: Role;
  storeIds?: string[];
  invite?: boolean; // true бол email invite явуулна, default=false
}) {
  const token = await requireSession();
  const url = new URL(`${BASE}/functions/v1/user`);

  const body = {
    email: args.email,
    password: args.password,
    tenant_id: args.tenantId,
    role: ROLE_TO_API[args.role],
    store_ids: args.storeIds ?? [],
    invite: !!args.invite,
    ...(args.name ? { display_name: args.name } : {}),
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`createUser failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

/** ---------- UPDATE: User ---------- */
export async function updateUser(args: {
  tenantId: string;
  userId: string;
  role?: Role;
  storeIds?: string[];
  name?: string;
}) {
  const token = await requireSession();
  const url = new URL(`${BASE}/functions/v1/user`);
  const body = {
    tenant_id: args.tenantId,
    user_id: args.userId,
    ...(args.role ? { role: ROLE_TO_API[args.role] } : {}),
    ...(args.storeIds ? { store_ids: args.storeIds } : {}),
    ...(args.name ? { display_name: args.name } : {}),
  };

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`updateUser failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

/** ---------- DELETE: User ---------- */
export async function deleteUser(args: { tenantId: string; userId: string; hard?: boolean }) {
  const token = await requireSession();
  const url = new URL(`${BASE}/functions/v1/user`);
  const body = {
    tenant_id: args.tenantId,
    user_id: args.userId,
    hard: !!args.hard,
  };

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`deleteUser failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}