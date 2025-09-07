import { jwtDecode } from "jwt-decode";
import { getTenantId } from "@/lib/helper/getTenantId";

export async function getStoreId(token: string) {
  try {
    // First try to get tenant_id using the centralized function
    let tenant_id = await getTenantId();

    // Fallback to JWT parsing if getTenantId fails
    if (!tenant_id) {
      console.log("Fallback: extracting tenant_id from JWT token");
      const decoded: any = jwtDecode(token);
      tenant_id = decoded?.app_metadata?.tenants?.[0];
    }

    if (!tenant_id) {
      throw new Error("No tenant_id found in token or from getTenantId()");
    }

    console.log("Using tenant_id for store lookup:", tenant_id);

    const url = new URL(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/helper?tenant_id=${tenant_id}&expand=false&include_names=false`
    );

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to fetch store info:", res.status, errorText);
      throw new Error(
        `Failed to fetch store info: ${res.status} - ${errorText}`
      );
    }

    const response = await res.json();
    console.log("Store API response:", response);

    // Check if this is a membership response with store_ids
    if (response?.store_ids && Array.isArray(response.store_ids)) {
      if (response.store_ids.length > 0) {
        const store_id = response.store_ids[0];
        console.log("Found store_id from store_ids array:", store_id);
        return store_id;
      } else if (response.role === "OWNER" && response.scope === "all") {
        // Owner with empty store_ids but scope "all" - try to get stores from a different endpoint
        console.log(
          "Owner with scope 'all' but empty store_ids, trying to fetch actual stores..."
        );

        // Try to get stores with expanded data
        const expandedUrl = new URL(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/helper?tenant_id=${tenant_id}&expand=true&include_names=true`
        );

        const expandedRes = await fetch(expandedUrl.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (expandedRes.ok) {
          const expandedResponse = await expandedRes.json();
          console.log("Expanded store response:", expandedResponse);

          // Check for stores in expanded response
          if (
            expandedResponse?.stores &&
            Array.isArray(expandedResponse.stores) &&
            expandedResponse.stores.length > 0
          ) {
            const store_id = expandedResponse.stores[0].id;
            console.log("Found store_id from expanded response:", store_id);
            return store_id;
          }
        }
      }
    }

    // Check if this is a direct stores response
    if (
      response?.stores &&
      Array.isArray(response.stores) &&
      response.stores.length > 0
    ) {
      const store_id = response.stores[0].id;
      console.log("Found store_id from stores array:", store_id);
      return store_id;
    }

    console.error("No store found in response:", response);

    // Provide more helpful error message
    if (
      response?.role === "OWNER" &&
      response?.store_ids &&
      response.store_ids.length === 0
    ) {
      throw new Error(
        "No stores are set up for this tenant. Please create a store first or contact your administrator."
      );
    } else if (response?.store_ids && response.store_ids.length === 0) {
      throw new Error(
        "You don't have access to any stores. Please contact your administrator to assign store access."
      );
    } else {
      throw new Error("No store found for this user/tenant");
    }
  } catch (error) {
    console.error("Error in getStoreId:", error);
    throw error;
  }
}
