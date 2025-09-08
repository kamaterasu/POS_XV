// lib/inventoryApi.ts
import { jwtDecode } from "jwt-decode";

type Reason =
  | "INITIAL"
  | "ADJUST"
  | "SALE"
  | "RETURN"
  | "TRANSFER"
  | "COUNT";

type AddToInventoryArgs = {
  store_id: string;
  variant_id: string;
  delta?: number;           // default: 1
  reason?: Reason;          // default: 'INITIAL'
  note?: string;            // default: 'SEEDING'
  tenant_id?: string;       // заавал биш — токеноос уншиж чадна
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
