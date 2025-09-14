import { jwtDecode } from "jwt-decode";
// /home/tr1bo/Documents/1. Projets/pos-x/lib/user/userApi.ts
// New function to get all users with complete details
export async function getAllUsersWithDetails(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  try {
    // Step 1: Get all memberships (this returns {items: [...]})
    const membershipsUrl = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}`
    );
    const membershipsRes = await fetch(membershipsUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const membershipsData = await membershipsRes.json();

    if (!membershipsData.items || !Array.isArray(membershipsData.items)) {
      return [];
    }

    // Step 2: For each membership, get the full user details
    const userPromises = membershipsData.items.map(async (membership: any) => {
      try {
        const userUrl = new URL(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}&user_id=${membership.user_id}`
        );
        const userRes = await fetch(userUrl.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const userData = await userRes.json();

        if (userData.user && userData.membership) {
          // Map backend role to frontend role
          let frontendRole = userData.membership.role;
          if (userData.membership.role === "OWNER") frontendRole = "Admin";
          if (userData.membership.role === "CASHIER") frontendRole = "Cashier";

          return {
            id: userData.user.id,
            name:
              userData.user.user_metadata?.display_name ||
              userData.user.email?.split("@")[0] ||
              "Unknown",
            email: userData.user.email,
            role: frontendRole,
            store_ids: userData.membership.store_ids || [],
          };
        } else {
          return null;
        }
      } catch (err) {
        return null;
      }
    });

    // Step 3: Wait for all user details and filter out nulls
    const users = await Promise.all(userPromises);
    const validUsers = users.filter((user) => user !== null);

    return validUsers;
  } catch (error) {
    return [];
  }
}

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

    // Backend returns { items: [...] } where items are membership records
    // We need to fetch actual user details for each membership
    if (data.items && Array.isArray(data.items)) {
      // For each membership, fetch the actual user details
      const userPromises = data.items.map(async (membership: any) => {
        try {
          const userUrl = new URL(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}&user_id=${membership.user_id}`
          );
          const userRes = await fetch(userUrl.toString(), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const userData = await userRes.json();

          if (userData.user && userData.membership) {
            // Map backend role to frontend role
            let frontendRole = userData.membership.role;
            if (userData.membership.role === "OWNER") frontendRole = "Admin";
            if (userData.membership.role === "CASHIER")
              frontendRole = "Cashier";

            return {
              id: userData.user.id,
              name:
                userData.user.user_metadata?.display_name ||
                userData.user.email?.split("@")[0] ||
                "Unknown",
              email: userData.user.email,
              role: frontendRole,
              store_ids: userData.membership.store_ids || [],
            };
          }

          // Fallback if individual fetch fails
          let fallbackRole = membership.role;
          if (membership.role === "OWNER") fallbackRole = "Admin";
          if (membership.role === "CASHIER") fallbackRole = "Cashier";

          return {
            id: membership.user_id,
            name: membership.user_id,
            email: membership.user_id,
            role: fallbackRole,
            store_ids: membership.store_ids || [],
          };
        } catch (err) {
          console.error(`Failed to fetch user ${membership.user_id}:`, err);

          // Return minimal data from membership with role mapping
          let fallbackRole = membership.role;
          if (membership.role === "OWNER") fallbackRole = "Admin";
          if (membership.role === "CASHIER") fallbackRole = "Cashier";

          return {
            id: membership.user_id,
            name: membership.user_id,
            email: membership.user_id,
            role: fallbackRole,
            store_ids: membership.store_ids || [],
          };
        }
      });

      const users = await Promise.all(userPromises);
      return users;
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

  const result = await res.json();

  if (!res.ok) {
    // Handle specific error cases from the backend
    if (
      res.status === 409 &&
      result.error?.includes("cannot remove the last OWNER")
    ) {
      throw new Error("Хамгийн сүүлийн админ хэрэглэгчийг устгах боломжгүй.");
    }
    throw new Error(result.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return result;
}

export async function getUserIds(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user?tenant_id=${tenant_id}&ids=true`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
