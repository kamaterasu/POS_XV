import { getAccessToken } from "../helper/getAccessToken";
import { getTenantId } from "../helper/getTenantId";
export async function getStore(store_id?: string) {
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/store?tenant_id=${tenant_id}&id=${store_id || ''}`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function createStore(names: string[]){
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
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

export async function updateStore( id: string, name: string){
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
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

export async function deleteStore( id: string){
  const token = await getAccessToken();
  const tenant_id = await getTenantId();
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