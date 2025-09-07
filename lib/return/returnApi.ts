import { jwtDecode } from "jwt-decode";

export interface ReturnItem {
  order_item_id?: string;
  variant_id?: string;
  quantity: number;
  unit_refund?: number;
}

export interface Refund {
  method: "CASH" | "CARD" | "ORIGINAL";
  amount: number;
}

export interface CreateReturnRequest {
  tenant_id: string;
  order_id: string;
  return_id?: string;
  items: ReturnItem[];
  refunds: Refund[];
  note?: string;
}

export interface ReturnResponse {
  return: {
    id: string;
    tenant_id: string;
    order_id: string;
    store_id: string;
    created_by: string;
    note: string | null;
    created_at: string;
  };
  items: Array<{
    id: string;
    order_item_id: string;
    variant_id: string;
    quantity: number;
    unit_refund: number;
    created_at: string;
  }>;
  refunds: Array<{
    id: string;
    method: string;
    amount: number;
    refunded_at: string;
  }>;
  totals?: {
    refund: number;
  };
}

export interface GetReturnsParams {
  tenant_id: string;
  id?: string;
  order_id?: string;
  store_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// Create a new return
export async function createReturn(
  request: CreateReturnRequest,
  token: string
): Promise<ReturnResponse> {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/return`
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify(request),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return result;
}

// Get returns (list or single)
export async function getReturns(
  params: GetReturnsParams,
  token: string
): Promise<
  | ReturnResponse
  | { items: any[]; count: number; limit: number; offset: number }
> {
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/return`
  );

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return result;
}

// Get single return by ID
export async function getReturnById(
  tenant_id: string,
  return_id: string,
  token: string
): Promise<ReturnResponse> {
  return getReturns(
    { tenant_id, id: return_id },
    token
  ) as Promise<ReturnResponse>;
}

// Get returns by order ID
export async function getReturnsByOrder(
  tenant_id: string,
  order_id: string,
  token: string
): Promise<{ items: any[]; count: number; limit: number; offset: number }> {
  return getReturns({ tenant_id, order_id }, token) as Promise<{
    items: any[];
    count: number;
    limit: number;
    offset: number;
  }>;
}

// Helper function to get tenant_id from token
export function getTenantIdFromToken(token: string): string {
  const decoded: any = jwtDecode(token);
  return decoded?.app_metadata?.tenants?.[0] || "";
}

// Map payment method from frontend to backend
export function mapPaymentMethod(method: string): "CASH" | "CARD" | "ORIGINAL" {
  switch (method) {
    case "cash":
      return "CASH";
    case "card":
      return "CARD";
    case "original":
    default:
      return "ORIGINAL";
  }
}

// Map return reason to note
export function mapReturnReason(reason: string, customReason?: string): string {
  const reasonMap: Record<string, string> = {
    size: "Хэмжээ таараагүй",
    damaged: "Эвдэрсэн",
    wrong: "Буруу бараа",
    unsatisfied: "Сэтгэл ханамжгүй",
    other: customReason || "Бусад",
  };

  return reasonMap[reason] || reason;
}
