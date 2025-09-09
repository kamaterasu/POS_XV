

// =============================================
// FILE: lib/product/productApi.ts
// Product/Inventory Edge Function helpers (Supabase)
// =============================================

import { jwtDecode } from 'jwt-decode';

export type VariantInput = {
  name: string;
  sku: string;
  price: number;
  cost: number;
  attrs?: Record<string, string>;
};

export type ProductInput = {
  name: string;
  category_id: string;
  variants: VariantInput[];
  img?: string;
};

export type UpdateProductInput = {
  id: string;
  name?: string;
  description?: string | null;
  category_id?: string | null;
  img?: string | null;
  upsert_variants?: Array<{
    id?: string;
    name: string;
    sku: string;
    price: number;
    cost: number | null;
    attrs?: Record<string, string>;
  }>;
  remove_variant_ids?: string[];
};

function getTenantIdFromToken(token: string): string {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  if (!tenant_id) throw new Error('No tenant_id found in JWT token');
  return tenant_id;
}

function assertOk(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function getProductByStore(token: string, storeId: string, limit = 500) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('scope', 'store');
  url.searchParams.set('store_id', storeId);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  assertOk(res);
  return res.json();
}

export async function getInventoryGlobal(token: string, limit = 500) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('scope', 'global');
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  assertOk(res);
  return res.json();
}

export async function getProduct(token: string, params?: { search?: string; limit?: number; offset?: number }) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('limit', String(params?.limit ?? 20));
  url.searchParams.set('offset', String(params?.offset ?? 0));
  url.searchParams.set('search', params?.search ?? '');
  const res = await fetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assertOk(res);
  return res.json();
}

export async function getProductById(
  token: string,
  product_id: string,
  opts?: { withVariants?: boolean; withStock?: boolean; storeId?: string }
) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('id', product_id); // IMPORTANT: id=
  url.searchParams.set('withVariants', String(opts?.withVariants ?? true));
  if (opts?.withStock && opts.storeId) {
    url.searchParams.set('withStock', 'true');
    url.searchParams.set('store_id', opts.storeId);
  }
  const res = await fetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assertOk(res);
  return res.json();
}

export async function getProductByCategory(token: string, category_id: string) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('category_id', category_id);
  url.searchParams.set('subtree', 'true');
  const res = await fetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assertOk(res);
  return res.json();
}

export async function createProduct(token: string, product: ProductInput) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { ...product, tenant_id };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function updateProduct(token: string, product: UpdateProductInput) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { ...product, tenant_id };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function deleteProduct(token: string, productId: string) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { tenant_id, id: productId, confirm: 'DELETE' };
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}
