import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`;


import { jwtDecode } from "jwt-decode";

export type PaymentInput = {
  method: string;     // ж: "CASH" | "CARD" | "BANK"
  amount: number;     // төгрөгөөр
  ref?: string;       // (заавал биш) баримтын дугаар, POS slip, г.м.
};

export async function createCheckoutOrder(
  token: string,
  store_id: string,
  variant_id: string,
  quantity: number,
  unit_price: number,
  payments: PaymentInput[],
  opts?: { discount?: number; tax?: number }
): Promise<any> {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  if (!tenant_id) throw new Error("tenant_id not found");
  if (!store_id) throw new Error("store_id is required");
  if (!variant_id) throw new Error("variant_id is required");
  if (!payments?.length) throw new Error("payments is empty");

  const body = {
    tenant_id,
    store_id,
    items: [{ variant_id, quantity, unit_price }],
    payments: payments.map(p => ({ method: p.method, amount: p.amount, ref: p.ref })),
    discount: Math.round(opts?.discount ?? 0),
    tax: Math.round(opts?.tax ?? 0),
  };

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Checkout failed with ${res.status}`);
  }
  return res.json();
}


// ===== Types =====
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

export type CreateOrderPayload = {
  tenant_id: string;
  store_id: string;
  order_id?: string;
  items: Array<{
    variant_id: string;
    quantity: number;
    unit_price: number;
    discount?: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  discount?: number;
  tax?: number;
};

// ===== API Functions =====

/**
 * Get list of recent orders for a store
 */
export async function getCheckoutOrders(
  store_id?: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckoutOrdersList | null> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();

    if (!tenant_id) {
      throw new Error("No tenant ID found");
    }

    const params = new URLSearchParams({
      tenant_id,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (store_id) {
      params.append("store_id", store_id);
    }

    const url = `${BASE_URL}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(
        "Failed to fetch checkout orders:",
        res.status,
        await res.text()
      );
      return null;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching checkout orders:", error);
    return null;
  }
}

/**
 * Get a specific order with items and payments
 */
export async function getCheckoutOrder(
  orderId: string
): Promise<CheckoutOrderDetail | null> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();

    if (!tenant_id) {
      throw new Error("No tenant ID found");
    }

    const params = new URLSearchParams({
      tenant_id,
      id: orderId,
    });

    const url = `${BASE_URL}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(
        "Failed to fetch checkout order:",
        res.status,
        await res.text()
      );
      return null;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching checkout order:", error);
    return null;
  }
}

// Legacy function for backwards compatibility
export async function getCheckout(token: string, store_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
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
  const data = await res.json();
  console.log("Checkout:", data);
  return data;
}
