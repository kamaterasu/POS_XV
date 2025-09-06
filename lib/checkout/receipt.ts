import { jwtDecode } from "jwt-decode";

export async function getReceipt(token: string, order_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt?tenant_id=${tenant_id}&kind=order&id=${order_id}&format=json`);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
