import { jwtDecode } from "jwt-decode";

export async function getStoredID(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant?id=${tenant_id}&withStores=true`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const response = await res.json();
  const store_id = response?.stores?.[0]?.id;

  return store_id;
}

export async function getStore(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded.app_metadata.tenants?.[0];
  const role = decoded.app_metadata.role;
  if (role !== 'OWNER' && role !== 'MANAGER') {
    const store_id = await getStoredID(token);
    const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store?tenant_id=${tenant_id}&id=${store_id}`);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  } else {
    const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store?tenant_id=${tenant_id}`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
  }
}
export async function createStore(names: string[],token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded.app_metadata.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`);
  const res = await fetch(url.toString(),{
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({tenant_id, names})
  });
  return res.json();
}

export async function updateStore( id: string, name: string,token: string){
    const decoded: any = jwtDecode(token);
  const tenant_id = decoded.app_metadata.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`);
  const res = await fetch(url.toString(),{
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({tenant_id, id, name})
  });
  return res.json();
}

export async function deleteStore( id: string,token: string){
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded.app_metadata.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store`);
  const res = await fetch(url.toString(),{
    method: "DELETE",
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({tenant_id, id, confirm: "DELETE"})
  });
  return res.json();
}