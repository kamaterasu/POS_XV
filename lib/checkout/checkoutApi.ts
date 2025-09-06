import { jwtDecode } from "jwt-decode";

export async function getCheckout(token: string, store_id:string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
    const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout?tenant_id=${tenant_id}&store_id=${store_id}&limit=20`
  );

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('Failed to fetch checkout:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  console.log('Checkout:', data);
  return data;
}