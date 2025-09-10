// =============================================
// FILE: lib/product/productApi.ts
// Product/Inventory Edge Function helpers (Supabase)
// =============================================

import { jwtDecode } from "jwt-decode";

export type VariantInput = {
  name: string;
  sku: string;
  price: number;
  cost: number;
  attrs?: Record<string, string>;
};

export type ProductInput = {
  name: string;
  category_id: string;
  variants: VariantInput[];
  img?: string;
};

export type UpdateProductInput = {
  id: string;
  name?: string;
  description?: string | null;
  category_id?: string | null;
  img?: string | null;
  upsert_variants?: Array<{
    id?: string;
    name: string;
    sku: string;
    price: number;
    cost: number | null;
    attrs?: Record<string, string>;
  }>;
  remove_variant_ids?: string[];
};

function getTenantIdFromToken(token: string): string {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  if (!tenant_id) throw new Error("No tenant_id found in JWT token");
  return tenant_id;
}

function assertOk(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function getProductByStore(
  token: string,
  storeId: string,
  limit = 500
) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("scope", "store");
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  assertOk(res);
  return res.json();
}

export async function getInventoryGlobal(token: string, limit = 500) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("scope", "global");
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  assertOk(res);
  return res.json();
}

export async function getProduct(
  token: string,
  params?: { search?: string; limit?: number; offset?: number }
) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("limit", String(params?.limit ?? 20));
  url.searchParams.set("offset", String(params?.offset ?? 0));
  url.searchParams.set("search", params?.search ?? "");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  assertOk(res);
  return res.json();
}

export async function getProductById(
  token: string,
  product_id: string,
  opts?: { withVariants?: boolean; withStock?: boolean; storeId?: string }
) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("id", product_id); // IMPORTANT: id=
  url.searchParams.set("withVariants", String(opts?.withVariants ?? true));
  if (opts?.withStock && opts.storeId) {
    url.searchParams.set("withStock", "true");
    url.searchParams.set("store_id", opts.storeId);
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  assertOk(res);
  return res.json();
}

export async function getProductByCategory(token: string, category_id: string) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("category_id", category_id);
  url.searchParams.set("subtree", "true");
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  assertOk(res);
  return res.json();
}

export async function createProduct(token: string, product: ProductInput) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { ...product, tenant_id };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function updateProduct(
  token: string,
  product: UpdateProductInput
) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { ...product, tenant_id };
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

export async function deleteProduct(token: string, productId: string) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = { tenant_id, id: productId, confirm: "DELETE" };
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  assertOk(res);
  return res.json();
}

/**
 * Get all product variants for transfer selection
 */
/**
 * Get all product variants for transfer selection - OPTIMIZED VERSION
 * This version makes far fewer API calls by using parallel processing
 */
export async function getAllProductVariants(token: string) {
  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );

  // Set required parameters
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("withVariants", "true");
  url.searchParams.set("limit", "200");
  url.searchParams.set("offset", "0");

  console.log("🚀 Optimized fetch - fetching products from:", url.toString());

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Product API error:", errorText);
    throw new Error(
      `Failed to fetch products: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  console.log("📦 Product API response data:", data);

  const variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    product_name?: string;
  }> = [];

  if (data.items && Array.isArray(data.items)) {
    console.log(`📋 Processing ${data.items.length} products`);

    // Check if the first product has variants included
    const firstProduct = data.items[0];
    if (
      firstProduct &&
      firstProduct.variants &&
      Array.isArray(firstProduct.variants)
    ) {
      console.log("✅ FAST PATH: Variants are included in product response");

      // Fast path: variants are already included
      for (const product of data.items) {
        if (product.variants && Array.isArray(product.variants)) {
          console.log(
            `Product ${product.name}: ${product.variants.length} variants`
          );
          for (const variant of product.variants) {
            variants.push({
              id: variant.id,
              name: `${product.name}${
                variant.name ? ` - ${variant.name}` : ""
              }`,
              sku: variant.sku || "",
              price: variant.price || 0,
              product_name: product.name,
            });
          }
        }
      }
    } else {
      console.log("⚡ OPTIMIZED PATH: Fetching variants in parallel batches");

      // Optimized path: fetch variants in parallel instead of sequentially
      const productsNeedingVariants = data.items.filter(
        (product: any) => !product.variants || !Array.isArray(product.variants)
      );

      console.log(
        `Need to fetch variants for ${productsNeedingVariants.length} products`
      );

      // Process in batches of 5 to avoid overwhelming the server
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < productsNeedingVariants.length; i += batchSize) {
        batches.push(productsNeedingVariants.slice(i, i + batchSize));
      }

      console.log(
        `Processing ${batches.length} batches of ${batchSize} products each`
      );

      for (const batch of batches) {
        const batchPromises = batch.map(async (product: any) => {
          try {
            const productUrl = new URL(url.toString());
            productUrl.searchParams.set("id", product.id);
            productUrl.searchParams.set("withVariants", "true");

            const productRes = await fetch(productUrl.toString(), {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            });

            if (productRes.ok) {
              const productData = await productRes.json();
              const productVariants = productData.variants || [];

              return {
                productName: product.name,
                variants: productVariants.map((variant: any) => ({
                  id: variant.id,
                  name: `${product.name}${
                    variant.name ? ` - ${variant.name}` : ""
                  }`,
                  sku: variant.sku || "",
                  price: variant.price || 0,
                  product_name: product.name,
                })),
              };
            }
            return { productName: product.name, variants: [] };
          } catch (err) {
            console.error(
              `Failed to fetch variants for product ${product.id}:`,
              err
            );
            return { productName: product.name, variants: [] };
          }
        });

        // Wait for current batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Add all variants from this batch
        for (const result of batchResults) {
          console.log(
            `✅ ${result.productName}: ${result.variants.length} variants`
          );
          variants.push(...result.variants);
        }
      }
    }
  }

  console.log(`🎉 Total variants extracted: ${variants.length}`);
  return variants;
}

/**
 * Get product variants filtered by specific store ID (for transfers)
 */
export async function getProductVariantsByStore(
  token: string,
  storeId: string
) {
  console.log(`🏪 Fetching products for store: ${storeId}`);

  const tenant_id = getTenantIdFromToken(token);
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );

  // Set required parameters including store filter
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("store_id", storeId); // Filter by specific store
  url.searchParams.set("withVariants", "true");
  url.searchParams.set("limit", "200");
  url.searchParams.set("offset", "0");

  console.log("🎯 Store-filtered fetch:", url.toString());

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Store product API error:", errorText);
    throw new Error(
      `Failed to fetch store products: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  console.log(`📦 Store ${storeId} products:`, data);

  const variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    product_name?: string;
    store_id?: string;
  }> = [];

  if (data.items && Array.isArray(data.items)) {
    console.log(
      `📋 Processing ${data.items.length} products for store ${storeId}`
    );

    // Same logic as getAllProductVariants but store-filtered
    const firstProduct = data.items[0];
    if (
      firstProduct &&
      firstProduct.variants &&
      Array.isArray(firstProduct.variants)
    ) {
      console.log("✅ FAST PATH: Store variants are included");

      for (const product of data.items) {
        if (product.variants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            variants.push({
              id: variant.id,
              name: `${product.name}${
                variant.name ? ` - ${variant.name}` : ""
              }`,
              sku: variant.sku || "",
              price: variant.price || 0,
              product_name: product.name,
              store_id: storeId,
            });
          }
        }
      }
    } else {
      console.log("⚡ STORE PATH: Fetching store variants individually");

      for (const product of data.items) {
        try {
          const productUrl = new URL(url.toString());
          productUrl.searchParams.set("id", product.id);
          productUrl.searchParams.set("withVariants", "true");

          const productRes = await fetch(productUrl.toString(), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (productRes.ok) {
            const productData = await productRes.json();
            const productVariants = productData.variants || [];

            for (const variant of productVariants) {
              variants.push({
                id: variant.id,
                name: `${product.name}${
                  variant.name ? ` - ${variant.name}` : ""
                }`,
                sku: variant.sku || "",
                price: variant.price || 0,
                product_name: product.name,
                store_id: storeId,
              });
            }
          }
        } catch (err) {
          console.error(
            `Failed to fetch variants for product ${product.id}:`,
            err
          );
        }
      }
    }
  }

  console.log(`🎯 Store ${storeId} variants: ${variants.length}`);
  return variants;
}
