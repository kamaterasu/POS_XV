/**
 * Debug utility to test auth and store access
 * Use this in the browser console to debug checkout issues
 */

import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import { getStoreId } from "@/lib/store/storeId";

export async function debugCheckoutAuth() {
  console.log("=== Debugging Checkout Authentication ===");

  try {
    // Step 1: Test access token
    console.log("\n1. Testing getAccessToken...");
    const token = await getAccessToken();
    console.log("Access token:", token ? "✓ Found" : "✗ Missing");
    if (token) {
      console.log("Token length:", token.length);
      console.log("Token starts with:", token.substring(0, 20) + "...");
    }

    // Step 2: Test tenant ID
    console.log("\n2. Testing getTenantId...");
    const tenantId = await getTenantId({ forceRefresh: true });
    console.log("Tenant ID:", tenantId ? "✓ Found" : "✗ Missing");
    if (tenantId) {
      console.log("Tenant ID value:", tenantId);
    }

    // Step 3: Test store ID
    if (token) {
      console.log("\n3. Testing getStoreId...");
      const storeId = await getStoreId(token);
      console.log("Store ID:", storeId ? "✓ Found" : "✗ Missing");
      if (storeId) {
        console.log("Store ID value:", storeId);
      }
    } else {
      console.log("\n3. Skipping getStoreId (no token)");
    }

    // Step 4: Test API endpoints
    if (token && tenantId) {
      console.log("\n4. Testing API endpoints...");

      // Test tenant endpoint
      const tenantResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Accept: "application/json",
          },
        }
      );
      console.log("Tenant API status:", tenantResponse.status);

      // Test helper endpoint
      const helperResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/helper?tenant_id=${tenantId}&expand=false&include_names=false`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("Helper API status:", helperResponse.status);

      if (helperResponse.ok) {
        const helperData = await helperResponse.json();
        console.log("Helper API data:", helperData);
      }
    }

    console.log("\n=== Debug completed ===");

    return {
      token: !!token,
      tenantId: !!tenantId,
      storeId: false, // Will be set by actual test
    };
  } catch (error) {
    console.error("Debug error:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// Add to window for easy access in browser console
if (typeof window !== "undefined") {
  (window as any).debugCheckoutAuth = debugCheckoutAuth;
}
