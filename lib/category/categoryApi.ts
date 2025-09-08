import { jwtDecode } from "jwt-decode";

export async function getCategories(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category?tenant_id=${tenant_id}&tree=true`
  );

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
export async function createSubcategory(
  parent_id: string,
  name: string,
  token: string
) {
  console.log("🔧 createSubcategory API called with:", {
    parent_id,
    name,
    token: token ? "present" : "missing",
  });

  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  console.log("🔧 Decoded tenant_id:", tenant_id);

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/category`;
  const requestBody = { tenant_id, name, parent_id };

  console.log("🔧 Request URL:", url);
  console.log("🔧 Request body:", requestBody);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  console.log("🔧 Response status:", res.status, res.statusText);
  console.log("🔧 Response ok:", res.ok);

  if (!res.ok) {
    const err = await res.text();
    console.error("🔧 Response error text:", err);
    throw new Error(`Subcategory create failed: ${res.status} ${err}`);
  }

  const result = await res.json();
  console.log("🔧 Response JSON:", result);
  return result;
}
