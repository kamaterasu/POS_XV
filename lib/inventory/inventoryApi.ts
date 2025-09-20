// lib/inventoryApi.ts
import { jwtDecode } from "jwt-decode";

type Reason = "INITIAL" | "PURCHASE" | "ADJUSTMENT";

type AddToInventoryArgs = {
  store_id: string;
  variant_id: string;
  delta?: number; // default: 1
  reason?: Reason; // default: 'INITIAL'
  note?: string; // default: 'SEEDING'
  tenant_id?: string; // заавал биш — токеноос уншиж чадна
  ref_table?: string; // optional reference table
  ref_id?: string; // optional reference id
};

export async function productAddToInventory(
  token: string,
  args: AddToInventoryArgs
) {
  const {
    store_id,
    variant_id,
    delta = 1,
    reason = "INITIAL",
    note = "SEEDING",
    ref_table,
    ref_id,
  } = args;

  // tenant_id-г параметрээр ирээгүй бол JWT-с унших
  let tenant_id = args.tenant_id;
  if (!tenant_id) {
    try {
      const decoded: any = jwtDecode(token);
      tenant_id = decoded?.app_metadata?.tenants?.[0];
    } catch {
      // noop
    }
  }
  if (!tenant_id) {
    throw new Error("No tenant_id (JWT эсвэл параметрээс олдсонгүй).");
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      // fetch-ийг шууд хэрэглэхэд Supabase ихэнхдээ apikey шаардана:
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      action: "adjust",
      tenant_id,
      store_id,
      variant_id,
      delta,
      reason,
      note,
      ref_table: ref_table ?? null,
      ref_id: ref_id ?? null,
    }),
  });

  // Амжилт/алдааг илүү ойлгомжтой буцаая
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(`Failed to add product to inventory: ${msg}`);
  }
  return data as {
    movement: {
      id: string;
      tenant_id: string;
      store_id: string;
      variant_id: string;
      delta: number;
      reason: Reason;
      created_at: string;
      // ... бусад талбар байж болно
    };
  };
}

import { getAccessToken } from "@/lib/helper/getAccessToken";

export type InventoryItem = {
  store_id: string;
  variant_id: string;
  qty: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    attrs: Record<string, any>;
    price: number;
    cost: number | null;
  };
  product: {
    id: string;
    name: string;
    description: string | null;
    img: string | null;
  };
};

export async function getInventory(
  token: string,
  tenantId: string,
  storeId?: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

    // Build URL with query parameters
    const params = new URLSearchParams({
      tenant_id: tenantId,
      scope: "store&store_id",
    });

    if (storeId) {
      params.append("store_id", storeId);
    }

    const url = `${baseUrl}/inventory?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error fetching inventory:", error);
    throw error;
  }
}

export async function getInventoryForProduct(
  token: string,
  tenantId: string,
  productId: string
): Promise<InventoryItem[]> {
  try {
    const allInventory = await getInventory(token, tenantId);
    return allInventory.filter(
      (item: InventoryItem) => item.product.id === productId
    );
  } catch (error) {
    console.error("Error fetching product inventory:", error);
    return [];
  }
}
