// lib/tenant.ts
"use client";
import { getAccessToken } from "./getAccessToken";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let TENANT_ID: string | null = null; // ← зөвхөн санах ойд
let inFlight: Promise<string | null> | null = null; // давхар хүсэлт дедуп

export async function getTenantId({
  forceRefresh = false,
}: { forceRefresh?: boolean } = {}): Promise<string | null> {
  if (!forceRefresh && TENANT_ID) {
    return TENANT_ID; // санах ойгоос
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const token = await getAccessToken();

      const res = await fetch(`${BASE}/functions/v1/tenant`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: ANON,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const text = await res.text();

      if (!res.ok) {
        console.error("Tenant API failed:", res.status, text);
        TENANT_ID = null;
        return null;
      }

      let id: string | null = null;
      try {
        const json = text ? JSON.parse(text) : {};
        id =
          (typeof json?.id === "string" && json.id) ||
          (Array.isArray(json?.items) && json.items[0]?.id) ||
          (Array.isArray(json?.data) && json.data[0]?.id) ||
          null;
      } catch (parseError) {
        console.error("Failed to parse tenant response:", parseError);
        id = null;
      }

      TENANT_ID = id;
      return TENANT_ID;
    } catch (error) {
      console.error("Error in getTenantId:", error);
      TENANT_ID = null;
      return null;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function clearTenantId() {
  TENANT_ID = null;
}
