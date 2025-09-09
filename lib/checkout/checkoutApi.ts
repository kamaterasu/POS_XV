// lib/checkout/checkoutApi.ts
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import { getStoredID } from "@/lib/store/storeApi";

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`;

// ---------- Types ----------
export type PaymentInput = {
  method: string; // "CASH" | "CARD" | "BANK" | ...
  amount: number;
  ref?: string;
};

export type CreateOrderPayload = {
  tenant_id: string;
  store_id: string;
  items: Array<{
    variant_id: string;
    quantity: number;
    unit_price: number;
    discount?: number;
  }>;
  payments: Array<{ method: string; amount: number; ref?: string }>;
  discount?: number;
  tax?: number;
};

export type CheckoutOrder = {
  id: string;
  order_no?: string;
  tenant_id: string;
  store_id: string;
  status: string;
  cashier_id: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
};

export type CheckoutItem = {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
};

export type CheckoutPayment = {
  id: string;
  method: string;
  amount: number;
  paid_at: string;
};

export type CheckoutOrderDetail = {
  order: CheckoutOrder;
  items: CheckoutItem[];
  payments: CheckoutPayment[];
};

export type CheckoutOrdersList = {
  items: CheckoutOrder[];
  count: number;
  limit: number;
  offset: number;
};

// ---------- Payment method normalize ----------
const METHOD_ALIASES: Record<string, string> = {
  cash: "CASH",
  card: "CARD",
  bank: "BANK",
  bank_transfer: "BANK",
  qpay: "QPAY",
  pos: "POS",
  wallet: "WALLET",
};
export function normalizeMethod(m: string) {
  const key = m?.trim().toLowerCase().replace(/\s+/g, "_");
  return METHOD_ALIASES[key] ?? (key ? key.toUpperCase() : "CASH");
}

// ---------- Create Order ----------
/**
 * Cart-оос захиалга үүсгэнэ.
 * items: [{ variantId, qty, price }]
 */
  export async function createCheckoutOrder(
    items: Array<{ variantId: string; qty: number; price: number }>,
    payments: PaymentInput[],
    opts?: { discount?: number; tax?: number },
    store_id?: string
  ): Promise<any> {
    const token = await getAccessToken();
    if (!token) throw new Error("NOT_AUTHENTICATED");

    const tenant_id = await getTenantId();
    if (!tenant_id) throw new Error("tenant_id not found");

    const resolvedStoreId = store_id || (await getStoredID(token));
    if (!resolvedStoreId) throw new Error("store_id is required");

    if (!items?.length) throw new Error("Cart is empty");
    if (!payments?.length) throw new Error("payments is empty");

    const payload: CreateOrderPayload = {
      tenant_id,
      store_id: resolvedStoreId,
      items: items.map((it) => {
        if (!it.variantId) throw new Error("Some cart rows have no variantId");
        return {
          variant_id: it.variantId,
          quantity: Math.max(1, Math.round(it.qty)),
          unit_price: Math.round(it.price),
        };
      }),
      payments: payments.map((p) => ({
        method: normalizeMethod(p.method),
        amount: Math.round(p.amount),
        ref: p.ref,
      })),
      discount: Math.round(opts?.discount ?? 0),
      tax: Math.round(opts?.tax ?? 0),
    };
    

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Checkout failed with ${res.status}`);
    }
    return res.json();
  }

// ---------- Read APIs ----------
export async function getCheckoutOrders(
  store_id?: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckoutOrdersList | null> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();
    if (!tenant_id) throw new Error("No tenant ID found");

    const params = new URLSearchParams({
      tenant_id,
      limit: String(limit),
      offset: String(offset),
    });
    if (store_id) params.append("store_id", store_id);

    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Failed to fetch checkout orders:", res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (e) {
    console.error("Error fetching checkout orders:", e);
    return null;
  }
}

export async function getCheckoutOrder(orderId: string): Promise<CheckoutOrderDetail | null> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();
    if (!tenant_id) throw new Error("No tenant ID found");

    const params = new URLSearchParams({ tenant_id, id: orderId });
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Failed to fetch checkout order:", res.status, await res.text());
      return null;
    }
    return res.json();
  } catch (e) {
    console.error("Error fetching checkout order:", e);
    return null;
  }
}

// (optional) Legacy helper
export async function getCheckout(token: string, store_id: string) {
  const tenant_id = await getTenantId();
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout?tenant_id=${tenant_id}&store_id=${store_id}&limit=20`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("Failed to fetch checkout:", res.status, await res.text());
    return null;
  }
  return res.json();
}
