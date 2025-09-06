import { jwtDecode } from "jwt-decode";

function toCents(n: number) {
  return Math.max(0, Math.round(n * 100));
}

function makeIdemKey(prefix = 'co'): string {
  // cryptographically strong, works in browser
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return `${prefix}:${Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function getProducts(token:string, store_id:string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&search=&limit=20&offset=0`);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error('Failed to fetch products:', res.status, await res.text());
    return [];
  }
  const data = await res.json();
  console.log('Products:', data);
  return data;
}


// export async function apiInventoryCheck(token: string, store_id: string) {
//   const decoded: any = jwtDecode(token);
//   const tenant_id = decoded?.app_metadata?.tenants?.[0];
//   const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory-check`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
//     body: JSON.stringify({
//       store_id: store_id,
//       lines: params.lines,
//     }),
//   });
//   if (!res.ok) {
//     throw new Error(`inventory-check failed: ${res.status} ${await res.text()}`);
//   }
//   return res.json();
// }

export async function apiCheckout(token: string, store_id:string) {
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

