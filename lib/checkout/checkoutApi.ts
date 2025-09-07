import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import { getStoreId } from "@/lib/store/storeId";
import type { Item, PaymentRow } from "@/lib/sales/salesTypes";

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`;

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

/**
 * Create a new order with items and payments
 */
export async function createCheckoutOrder(
  items: Item[],
  payments: PaymentRow[],
  options: {
    discount?: number;
    tax?: number;
    order_id?: string;
  } = {}
): Promise<CheckoutOrderDetail | null> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();

    // Try to get store_id with better error handling
    let store_id: string | null = null;
    try {
      store_id = await getStoreId(token);
    } catch (storeError) {
      console.error("Error getting store_id:", storeError);

      // Check if this is a "no stores" error - we can provide a more helpful message
      if (
        storeError instanceof Error &&
        storeError.message.includes("No stores are set up")
      ) {
        throw new Error(
          "No stores have been created yet. Please go to Store Management to create a store first."
        );
      } else if (
        storeError instanceof Error &&
        storeError.message.includes("don't have access")
      ) {
        throw new Error(
          "You don't have access to any stores. Please contact your administrator."
        );
      } else {
        throw new Error(
          "Failed to get store information - please try again or contact support"
        );
      }
    }

    if (!tenant_id) {
      throw new Error(
        "Missing tenant_id - please ensure you are logged in and have tenant access"
      );
    }

    if (!store_id) {
      throw new Error(
        "Missing store_id - please ensure you have access to a store"
      );
    }

    // Convert frontend items to backend format
    const backendItems = items.map((item) => ({
      variant_id: item.id, // Assuming item.id is the variant_id
      quantity: item.qty,
      unit_price: item.price,
      discount: 0, // Could be per-item discount if needed
    }));

    // Convert frontend payments to backend format
    const backendPayments = payments.map((payment) => ({
      method: payment.method.toUpperCase(),
      amount: payment.amount,
    }));

    const payload: CreateOrderPayload = {
      tenant_id,
      store_id,
      items: backendItems,
      payments: backendPayments,
      discount: options.discount || 0,
      tax: options.tax || 0,
    };

    if (options.order_id) {
      payload.order_id = options.order_id;
    }

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to create checkout order:", res.status, errorText);
      throw new Error(`Failed to create order: ${errorText}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error creating checkout order:", error);
    throw error;
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
