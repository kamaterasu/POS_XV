// lib/count/countApi.ts
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";

const BASE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/count`;

// ---------- Types ----------
export type CountItem = {
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  product_id: string | null;
  product_name: string | null;
  system_qty: number;
};

export type CountComparisonItem = {
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  product_id: string | null;
  product_name: string | null;
  system_qty: number;
  physical_qty: number;
  delta: number;
  status: "MATCH" | "SHORT" | "OVER";
};

export type CountComparisonSummary = {
  matched: number;
  short: number;
  over: number;
  delta_total: number;
};

export type CountComparisonResponse = {
  summary: CountComparisonSummary;
  items: CountComparisonItem[];
};

export type GetCountParams = {
  store_id: string;
  product_id?: string;
  variant_ids?: string[];
  search?: string;
  limit?: number;
  offset?: number;
};

export type CompareCountPayload = {
  store_id: string;
  items: Array<{
    variant_id: string;
    physical_qty: number;
  }>;
};

// ---------- API Functions ----------

/**
 * Get system quantities for variants in a store
 * GET /functions/v1/count
 */
export async function getSystemCount(params: GetCountParams) {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();

    if (!tenant_id) {
      throw new Error("Tenant ID not found");
    }

    const url = new URL(BASE_URL);
    url.searchParams.set("tenant_id", tenant_id);
    url.searchParams.set("store_id", params.store_id);

    if (params.product_id) {
      url.searchParams.set("product_id", params.product_id);
    }

    if (params.variant_ids && params.variant_ids.length > 0) {
      url.searchParams.set("variant_ids", params.variant_ids.join(","));
    }

    if (params.search) {
      url.searchParams.set("search", params.search);
    }

    if (params.limit) {
      url.searchParams.set("limit", params.limit.toString());
    }

    if (params.offset) {
      url.searchParams.set("offset", params.offset.toString());
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return (await response.json()) as {
      items: CountItem[];
      count: number;
      limit: number;
      offset: number;
    };
  } catch (error) {
    console.error("Error fetching system count:", error);
    throw error;
  }
}

/**
 * Compare physical counts vs system quantities
 * POST /functions/v1/count
 */
export async function compareCount(
  payload: CompareCountPayload
): Promise<CountComparisonResponse> {
  try {
    const token = await getAccessToken();
    const tenant_id = await getTenantId();

    if (!tenant_id) {
      throw new Error("Tenant ID not found");
    }

    const requestPayload = {
      tenant_id,
      store_id: payload.store_id,
      items: payload.items,
    };

    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error comparing count:", error);
    throw error;
  }
}

/**
 * Get filtered count items for easy management
 */
export async function getCountItemsBySearch(
  store_id: string,
  search: string,
  limit: number = 50
): Promise<CountItem[]> {
  try {
    const result = await getSystemCount({
      store_id,
      search,
      limit,
    });
    return result.items;
  } catch (error) {
    console.error("Error searching count items:", error);
    return [];
  }
}

/**
 * Get count items by product
 */
export async function getCountItemsByProduct(
  store_id: string,
  product_id: string
): Promise<CountItem[]> {
  try {
    const result = await getSystemCount({
      store_id,
      product_id,
    });
    return result.items;
  } catch (error) {
    console.error("Error getting count items by product:", error);
    return [];
  }
}

/**
 * Utility function to validate count data
 */
export function validateCountData(
  items: Array<{ variant_id: string; physical_qty: number }>
): boolean {
  if (!Array.isArray(items) || items.length === 0) {
    return false;
  }

  return items.every(
    (item) =>
      item.variant_id &&
      typeof item.variant_id === "string" &&
      typeof item.physical_qty === "number" &&
      item.physical_qty >= 0
  );
}

/**
 * Helper function to format count comparison status
 */
export function getStatusColor(status: "MATCH" | "SHORT" | "OVER"): string {
  switch (status) {
    case "MATCH":
      return "text-green-600 bg-green-50";
    case "SHORT":
      return "text-red-600 bg-red-50";
    case "OVER":
      return "text-blue-600 bg-blue-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

/**
 * Helper function to format status text
 */
export function getStatusText(status: "MATCH" | "SHORT" | "OVER"): string {
  switch (status) {
    case "MATCH":
      return "Тохирч байна";
    case "SHORT":
      return "Дутуу";
    case "OVER":
      return "Илүү";
    default:
      return "Тодорхойгүй";
  }
}
