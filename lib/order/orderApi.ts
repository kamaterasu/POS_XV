import { jwtDecode } from "jwt-decode";

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name?: string;
  variant_name?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  store_id: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  created_by: string;
  items: OrderItem[];
}

// Helper function to transform checkout/receipt data to Order format
function transformCheckoutToOrder(data: any, order_id: string): Order | null {
  if (!data) return null;

  // Handle different response formats
  const orderData = data.order || data;
  const itemsData = data.items || data.lines || [];

  return {
    id: orderData.id || order_id,
    tenant_id: orderData.tenant_id || "",
    store_id: orderData.store_id || "",
    status: orderData.status || "completed",
    subtotal: orderData.subtotal || 0,
    discount: orderData.discount || 0,
    tax: orderData.tax || 0,
    total: orderData.total || orderData.subtotal || 0,
    created_at: orderData.created_at || new Date().toISOString(),
    created_by: orderData.created_by || "",
    items: itemsData.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      order_id: item.order_id || order_id,
      variant_id: item.variant_id || "",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || item.price || 0,
      total_price: (item.quantity || 1) * (item.unit_price || item.price || 0),
      product_name: item.product_name || item.name || `Бараа ${index + 1}`,
      variant_name: item.variant_name || "",
    })),
  };
}

// Get order by ID using the receipt API (which provides order details)
export async function getOrderById(
  token: string,
  order_id: string
): Promise<Order | null> {
  try {
    const decoded: any = jwtDecode(token);
    const tenant_id = decoded?.app_metadata?.tenants?.[0];

    if (!tenant_id) {
      throw new Error("Tenant ID олдсонгүй");
    }

    // Try the Supabase Edge Function for receipt
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
    );

    url.searchParams.set("tenant_id", tenant_id);
    url.searchParams.set("kind", "order");
    url.searchParams.set("id", order_id);
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    });

    if (!response.ok) {
      // If receipt endpoint fails, try checkout endpoint to get order details
      const checkoutUrl = new URL(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`
      );
      checkoutUrl.searchParams.set("tenant_id", tenant_id);
      checkoutUrl.searchParams.set("order_id", order_id);

      const checkoutResponse = await fetch(checkoutUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        },
      });

      if (!checkoutResponse.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const checkoutResult = await checkoutResponse.json();
      return transformCheckoutToOrder(checkoutResult, order_id);
    }

    const result = await response.json();

    // Transform the receipt data into order format
    return transformCheckoutToOrder(result, order_id);
  } catch (error) {
    console.error("Error fetching order:", error);
    throw error;
  }
} // Search orders by document number (order_no)
export async function searchOrderByDocumentNumber(
  token: string,
  documentNumber: string
): Promise<Order | null> {
  try {
    const decoded: any = jwtDecode(token);
    const tenant_id = decoded?.app_metadata?.tenants?.[0];

    if (!tenant_id) {
      throw new Error("Tenant ID олдсонгүй");
    }

    // Extract order number from document number if it contains a prefix
    // Example: "POS-2025-08-12-1234" -> "1234"
    let orderNo = documentNumber;
    const orderNoMatch = documentNumber.match(/(\d+)$/);
    if (orderNoMatch) {
      orderNo = orderNoMatch[1];
    }

    // Use the receipt API endpoint to search by order_no
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
    );

    url.searchParams.set("tenant_id", tenant_id);
    url.searchParams.set("kind", "order");
    url.searchParams.set("order_no", orderNo);
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Order not found
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Transform the receipt data into order format
    if (!result.order) {
      return null;
    }

    const order = result.order;
    const lines = result.lines || [];

    return {
      id: order.id,
      tenant_id: order.tenant_id,
      store_id: order.store_id,
      status: order.status === "PAID" ? "completed" : order.status.toLowerCase(),
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      tax: order.tax || 0,
      total: order.total || 0,
      created_at: order.created_at,
      created_by: order.cashier_id || "",
      items: lines.map((line: any) => ({
        id: line.id,
        order_id: order.id,
        variant_id: line.variant_id,
        quantity: line.qty || line.quantity || 1,
        unit_price: line.unit_price || 0,
        total_price: line.line_total || (line.qty * line.unit_price) || 0,
        product_name: line.product_name || line.name || "Бараа",
        variant_name: line.name || line.variant_name || "",
      })),
    };
  } catch (error) {
    console.error("Error searching order:", error);
    throw error;
  }
}
