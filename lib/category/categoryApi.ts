import { jwtDecode } from "jwt-decode"


export async function getCategories(token: string){
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category?tenant_id=${tenant_id}`);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
export async function createCategory(name: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id, name }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Category create failed: ${res.status} ${err}`);
  }

  return res.json();
}
export async function createSubcategory(parent_id: string, name: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id, name, parent_id }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Subcategory create failed: ${res.status} ${err}`);
  }

  return res.json();
}