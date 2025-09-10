import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "../helper/getAccessToken";
import type { Item } from "../sales/salesTypes";

export interface DraftItem {
  variant_id: string;
  quantity: number;
  unit_price: number;
  product_name: string;
  variant_name?: string;
}

export interface DraftData {
  id?: string;
  name: string;
  notes?: string;
  items: DraftItem[];
  total_amount: number;
  total_quantity: number;
  store_id: string;
}

export interface Draft {
  id: string;
  name: string;
  notes?: string;
  items: DraftItem[];
  total_amount: number;
  total_quantity: number;
  store_id: string;
  tenant_id: string;
  created_at: string;
  created_by: string;
}

// Transform checkout items to draft items
export function transformItemsToDraft(items: Item[]): DraftItem[] {
  return items.map((item) => ({
    variant_id: item.variant_id || item.id,
    quantity: item.qty,
    unit_price: item.price,
    product_name: item.name,
    variant_name:
      item.color && item.size ? `${item.color} / ${item.size}` : undefined,
  }));
}

// Save draft to backend
export async function saveDraftToBackend(draftData: DraftData): Promise<Draft> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available");

  const decoded: any = jwtDecode(token);
  const tenantId = decoded?.app_metadata?.tenants?.[0];

  if (!tenantId) throw new Error("No tenant ID found");

  // Add timeout to the fetch request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/draft`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          ...draftData,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "Draft API endpoint not found - using localStorage fallback"
        );
      }
      const error = await response.text();
      throw new Error(`Failed to save draft: ${response.status} ${error}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - server taking too long to respond");
    }
    throw error;
  }
}

// Load drafts from backend
export async function loadDraftsFromBackend(): Promise<Draft[]> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available");

  const decoded: any = jwtDecode(token);
  const tenantId = decoded?.app_metadata?.tenants?.[0];

  if (!tenantId) throw new Error("No tenant ID found");

  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_SUPABASE_URL
    }/functions/v1/draft?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to load drafts: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.drafts || data.items || data || [];
}

// Delete draft from backend
export async function deleteDraftFromBackend(draftId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token available");

  const decoded: any = jwtDecode(token);
  const tenantId = decoded?.app_metadata?.tenants?.[0];

  if (!tenantId) throw new Error("No tenant ID found");

  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_SUPABASE_URL
    }/functions/v1/draft/${draftId}?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete draft: ${response.status} ${error}`);
  }
}
