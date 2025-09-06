'use client';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getTenantId } from '@/lib/helper/getTenantId';

import type { Item, QuickActions, PaymentRow } from '@/lib/sales/salesType';

const BASE_FUN = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

function toCents(n: number) {
  return Math.max(0, Math.round(n * 100));
}

function makeIdemKey(prefix = 'co'): string {
  // cryptographically strong, works in browser
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return `${prefix}:${Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function listProducts(params: { storeId: string }): Promise<Item[]> {
  const token = await getAccessToken();
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  const url = new URL(`${BASE_FUN}/functions/v1/inventory?tenant_id=${tenantId}`);
  url.searchParams.set('store_id', params.storeId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('Failed to fetch products:', res.status, await res.text());
    return [];
  }
  const data = await res.json();
  console.log('Products:', data);
  return data;
}


/** Optional: call inventory-check before committing payment */
export async function apiInventoryCheck(params: {
  storeId: string;
  lines: { variant_id: string; qty: number }[];
}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_FUN}/inventory-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      store_id: params.storeId,
      lines: params.lines,
    }),
  });
  if (!res.ok) {
    throw new Error(`inventory-check failed: ${res.status} ${await res.text()}`);
  }
  return res.json(); // expected: { ok: true, shortages?: [{variant_id, requested, available}] }
}

/** Main checkout */
export async function apiCheckout(params: {
  tenantId: string;
  storeId: string;
  items: Item[];
  qa: QuickActions;
  payments: PaymentRow[]; // total must cover grand
  idempotencyKey?: string;
}) {
  const token = await getAccessToken();

  // Pro-rate discount to lines so backend can keep accounting per line
  const subtotal = params.items.reduce((s, it) => s + it.qty * it.price, 0);
  const discountTotal = Math.round(subtotal * (Math.max(0, Math.min(100, params.qa.discountPercent)) / 100));
  const linesRaw = params.items.map((it) => ({
    variant_id: it.id, // if this is product_id in your DB, rename to product_id
    qty: it.qty,
    unit_price_cents: toCents(it.price),
  }));

  // Allocate line discounts proportionally (integer-cents safe)
  let remaining = discountTotal * 100; // cents
  const lines = linesRaw.map((ln, i) => {
    if (discountTotal <= 0 || subtotal <= 0) return { ...ln, discount_cents: 0 };
    const lineGross = (params.items[i].qty * params.items[i].price);
    let share = Math.floor((lineGross / subtotal) * remaining);
    // last line gets remainder to keep sum exact
    if (i === linesRaw.length - 1) share = remaining;
    remaining -= share;
    return { ...ln, discount_cents: share };
  });

  const payload = {
    tenant_id: params.tenantId,
    store_id: params.storeId,
    items: lines,
    delivery_fee_cents: toCents(params.qa.deliveryFee || 0),
    include_vat: !!params.qa.includeVAT, // backend will compute 10%
    discount_percent: Math.max(0, Math.min(100, params.qa.discountPercent)),
    payments: params.payments.map(p => ({
      method: p.method,
      amount_cents: toCents(p.amount),
      ref: p.ref || null,
    })),
    idempotency_key: params.idempotencyKey || makeIdemKey(),
  };

  const res = await fetch(`${BASE_FUN}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      // helpful for servers that de-dupe by header
      'Idempotency-Key': payload.idempotency_key,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`checkout failed: ${res.status} ${txt}`);
  }
  // expected: { order_id, receipt_id, receipt_number, change_cents, printable_html_url? }
  return res.json();
}

