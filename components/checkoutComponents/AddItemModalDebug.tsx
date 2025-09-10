"use client";
import { useState, useEffect } from "react";
import { getProductByStore, getProduct } from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID } from "@/lib/store/storeApi";

export default function AddItemModalDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    const info: any = {};

    try {
      // 1. Test token
      const token = await getAccessToken();
      info.token = token ? "✅ Available" : "❌ Missing";

      // 2. Test store ID
      if (token) {
        const storeId = await getStoredID(token);
        info.storeId = storeId || "❌ Missing";

        // 3. Test getProduct
        try {
          const productResponse = await getProduct(token, { limit: 5 });
          info.getProduct = {
            success: "✅",
            structure: Object.keys(productResponse || {}),
            itemCount: productResponse?.items?.length || 0,
            sample: productResponse?.items?.[0] || null,
          };
        } catch (e) {
          info.getProduct = { error: String(e) };
        }

        // 4. Test getProductByStore
        if (storeId) {
          try {
            const storeResponse = await getProductByStore(token, storeId);
            info.getProductByStore = {
              success: "✅",
              structure: Object.keys(storeResponse || {}),
              itemCount: storeResponse?.items?.length || 0,
              sample: storeResponse?.items?.[0] || null,
            };
          } catch (e) {
            info.getProductByStore = { error: String(e) };
          }
        }
      }
    } catch (e) {
      info.error = String(e);
    }

    setDebugInfo(info);
    setLoading(false);
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold text-lg mb-4">AddItemModal Debug Info</h3>

      {loading ? (
        <div>Loading debug info...</div>
      ) : (
        <pre className="text-xs overflow-auto bg-white p-3 rounded">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      )}

      <button
        onClick={runDebug}
        className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh Debug
      </button>
    </div>
  );
}
