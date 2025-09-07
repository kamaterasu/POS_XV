import { jwtDecode } from "jwt-decode";

export async function getStoreId(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/helper?tenant_id=${tenant_id}&expand=false&include_names=false`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const response = await res.json();
  const store_id = response?.stores?.[0]?.id;

  return store_id;
}