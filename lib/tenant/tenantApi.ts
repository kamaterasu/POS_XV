import { getAccessToken } from "../helper/getAccessToken";

export async function getTenant() {
  const token = await getAccessToken();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function getTenantWithStore(tenantId: string) {
  const token = await getAccessToken();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant?id=${tenantId}&withStores=true`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function createTenant(name: string) {
  const token = await getAccessToken();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function updateTenant(id: string, name: string) {
  const token = await getAccessToken();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, name }),
  });
  return res.json();
}

export async function deleteTenant(id: string) {
  const token = await getAccessToken();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`);
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, confirm: "DELETE" }),
  });
  return res.json();
}
