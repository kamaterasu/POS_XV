import { jwtDecode } from "jwt-decode";

export async function getUser(user_id: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const role = decoded.app_metadata.role;
  if (role !== 'OWNER' && role !== 'MANAGER') {
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}&user_id=${user_id || ''}`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();    
  } else{
    const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}`);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.json();
  }

}

export async function createUser(email: string, password: string, role: string, store_ids: string[], name: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
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

export async function updateUser(user_id: string, role: string, store_ids: string[], name: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
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

export async function deleteUser(user_id: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
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
