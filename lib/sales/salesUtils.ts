import { Draft, Item, QuickActions } from '@/lib/sales/salesType';

export const fmt = (n: number) => `₮${(n || 0).toLocaleString('mn-MN')}`;

export function calcTotals(items: Item[], qa: QuickActions) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const discount = Math.round(subtotal * (qa.discountPercent / 100));
  const afterDiscount = Math.max(0, subtotal - discount);
  const vat = qa.includeVAT ? Math.round(afterDiscount * 0.1) : 0;
  const grand = afterDiscount + vat + (qa.deliveryFee || 0);
  return { subtotal, discount, afterDiscount, vat, deliveryFee: qa.deliveryFee || 0, grand };
}

// LocalStorage helpers
const KEY = 'pos_drafts_v1';

export function loadDrafts(): Draft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveDraft(d: Draft) {
  const list = loadDrafts();
  list.unshift(d);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}
