import { getAccessToken } from "../helper/getAccessToken";
import { getTenantId } from "../helper/getTenantId";

export async function getUser(user_id?: string) {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}&user_id=${user_id || ''}`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function createUser(email: string, password: string, role: string, store_ids: string[], name: string) {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, password, tenant_id, role, store_ids, invite: "false", display_name: name }),
  });
  return res.json();
}

export async function updateUser(user_id: string, role?: string, store_ids?: string[], name?: string) {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`);
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id, user_id, role, store_ids, display_name: name }),
  });
  return res.json();
}

export async function deleteUser(user_id: string) {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`);
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id, user_id, hard: true }),
  });
  return res.json();
}
