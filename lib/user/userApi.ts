import { jwtDecode } from "jwt-decode";

export async function getUser(user_id: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const role = decoded.app_metadata.role;

  if (role !== "OWNER" && role !== "MANAGER") {
    // For non-OWNER/MANAGER users, get single user
    const url = new URL(
      `${
        process.env.NEXT_PUBLIC_SUPABASE_URL
      }/functions/v1/user?tenant_id=${tenant_id}&user_id=${user_id || ""}`
    );
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();

    // Backend returns { membership: {...}, user: {...} } for single user
    if (data.membership && data.user) {
      return [
        {
          id: data.user.id,
          name:
            data.user.user_metadata?.display_name ||
            data.user.email?.split("@")[0] ||
            "Unknown",
          email: data.user.email,
          role: data.membership.role,
          store_ids: data.membership.store_ids || [],
        },
      ];
    }
    return [];
  } else {
    // For OWNER/MANAGER users, get all users
    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}`
    );
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();

    console.log("User API response:", data);

    // Backend returns { items: [...] } where items are membership records
    // But we need actual user data too. For now, return the memberships
    // and let the frontend handle the display
    if (data.items && Array.isArray(data.items)) {
      return data.items.map((membership: any) => ({
        id: membership.user_id,
        name: membership.user_id, // We don't have display_name from membership table
        email: membership.user_id, // We don't have email from membership table
        role: membership.role,
        store_ids: membership.store_ids || [],
      }));
    }
    return [];
  }
}

export async function createUser(
  email: string,
  password: string,
  role: string,
  store_ids: string[],
  name: string,
  token: string
) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  // Map frontend roles to backend roles
  let backendRole = role;
  if (role === "Admin") backendRole = "OWNER";
  if (role === "Manager") backendRole = "OWNER";
  if (role === "Cashier") backendRole = "CASHIER";

  console.log("Creating user with:", {
    email,
    tenant_id,
    role: `${role} -> ${backendRole}`,
    store_ids,
    display_name: name,
  });

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`
  );
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email,
      password,
      tenant_id,
      role: backendRole, // Use mapped role
      store_ids,
      invite: false, // Boolean, not string
      display_name: name,
    }),
  });

  const result = await res.json();
  console.log("Create user response:", result);

  if (!res.ok) {
    throw new Error(result.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return result;
}

export async function updateUser(
  user_id: string,
  role: string,
  store_ids: string[],
  name: string,
  token: string
) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  // Map frontend roles to backend roles
  let backendRole = role;
  if (role === "Admin") backendRole = "OWNER";
  if (role === "Manager") backendRole = "OWNER";
  if (role === "Cashier") backendRole = "CASHIER";

  console.log("Updating user with:", {
    user_id,
    tenant_id,
    role: `${role} -> ${backendRole}`,
    store_ids,
    display_name: name,
  });

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`
  );
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tenant_id,
      user_id,
      role: backendRole, // Use mapped role
      store_ids,
      display_name: name,
    }),
  });

  const result = await res.json();
  console.log("Update user response:", result);

  if (!res.ok) {
    throw new Error(result.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return result;
}

export async function deleteUser(user_id: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user`
  );
  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id, user_id, hard: true }),
  });
  return res.json();
}
