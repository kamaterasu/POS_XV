// =============================================
// FILE: lib/product/productApi.ts
// Product/Inventory Edge Function helpers (Supabase)
// =============================================

import { jwtDecode } from "jwt-decode";

export type VariantInput = {
  name?: string | null;
  sku?: string | null;
  price?: number;
  cost?: number | null;
  attrs?: Record<string, any>;
};

export type ProductInput = {
  name: string;
  description?: string | null;
  category_id?: string | null;
  variants?: VariantInput[];
  img?: string | null;
};

export type UpdateProductInput = {
  id: string;
  name?: string;
  description?: string | null;
  category_id?: string | null;
  img?: string | null;
  upsert_variants?: Array<{
    id?: string;
    name?: string | null;
    sku?: string | null;
    price?: number;
    cost?: number | null;
    attrs?: Record<string, any>;
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
  url.searchParams.set("id", product_id);
  url.searchParams.set("withVariants", String(opts?.withVariants ?? true));

  // Backend includes qty in variants when store_id is provided
  if (opts?.storeId) {
    url.searchParams.set("store_id", opts.storeId);
  }

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

// New function for AddItemModal - gets products with variants and inventory
// This function works around the API limitation by fetching products list first,
// then fetching variants for each product individually
export async function getProductsForModal(
  token: string,
  params?: {
    store_id?: string;
    category_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
    subtree?: boolean;
  }
) {
  const tenant_id = getTenantIdFromToken(token);

  // Step 1: Get the list of products (without variants)
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );

  // Required parameters
  url.searchParams.set("tenant_id", tenant_id);
  // Don't set withVariants=true here - it doesn't work for lists

  // Store ID for inventory quantities (backend will include qty in variant objects)
  if (params?.store_id) {
    url.searchParams.set("store_id", params.store_id);
  }

  // Category filtering
  if (params?.category_id) {
    url.searchParams.set("category_id", params.category_id);
    url.searchParams.set("subtree", String(params.subtree ?? true)); // Include subcategories by default
  }

  // Search filtering
  if (params?.search) {
    url.searchParams.set("search", params.search);
  }

  // Pagination
  url.searchParams.set("limit", String(params?.limit ?? 50)); // Reduced limit for performance
  url.searchParams.set("offset", String(params?.offset ?? 0));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  assertOk(res);
  const productsResponse = await res.json();

  // Step 2: For each product, fetch its variants with inventory
  if (productsResponse?.items && Array.isArray(productsResponse.items)) {
    const productsWithVariants = await Promise.all(
      productsResponse.items.map(async (product: any) => {
        try {
          // Fetch individual product with variants
          const productUrl = new URL(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
          );
          productUrl.searchParams.set("tenant_id", tenant_id);
          productUrl.searchParams.set("id", product.id);
          productUrl.searchParams.set("withVariants", "true");

          // Always pass store_id for inventory quantities
          if (params?.store_id) {
            productUrl.searchParams.set("store_id", params.store_id);
          }

          const variantRes = await fetch(productUrl.toString(), {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (variantRes.ok) {
            const variantData = await variantRes.json();
            const variants = variantData.variants || [];

            // Store filtering logic: if a specific store is selected,
            // only include products that have inventory in that store
            if (params?.store_id && params.store_id !== "all") {
              const hasInventoryInStore = variants.some(
                (v: any) => (v.qty || 0) > 0
              );
              if (!hasInventoryInStore) {
                // Skip this product - no inventory in selected store
                return null;
              }
            }

            return {
              ...product,
              variants: variants,
            };
          } else {
            // If variants fetch fails, return product without variants
            console.warn(`Failed to fetch variants for product ${product.id}`);
            return {
              ...product,
              variants: [],
            };
          }
        } catch (error) {
          console.warn(
            `Error fetching variants for product ${product.id}:`,
            error
          );
          return {
            ...product,
            variants: [],
          };
        }
      })
    );

    // Filter out null entries (products without inventory in selected store)
    const filteredProducts = productsWithVariants.filter(Boolean);

    return {
      ...productsResponse,
      items: filteredProducts,
      count: filteredProducts.length, // Update count to reflect filtering
    };
  }

  return productsResponse;
}

export async function createProduct(token: string, product: ProductInput) {
  const tenant_id = getTenantIdFromToken(token);
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;

  // Transform the payload to match backend expectations
  const payload = {
    tenant_id,
    name: product.name,
    description: product.description || null,
    category_id: product.category_id || null,
    img: product.img || null,
    variants: product.variants || [],
  };

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

  // Ensure proper payload structure matching backend expectations
  const payload = {
    tenant_id,
    id: product.id,
    ...(product.name !== undefined && { name: product.name }),
    ...(product.description !== undefined && {
      description: product.description,
    }),
    ...(product.category_id !== undefined && {
      category_id: product.category_id,
    }),
    ...(product.img !== undefined && { img: product.img }),
    ...(product.upsert_variants && {
      upsert_variants: product.upsert_variants,
    }),
    ...(product.remove_variant_ids && {
      remove_variant_ids: product.remove_variant_ids,
    }),
  };

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
 * Get all product variants for transfer selection - FIXED VERSION
 * This version works with your current edge function by making individual product calls
 */
export async function getAllProductVariants(token: string) {
  const tenant_id = getTenantIdFromToken(token);

  console.log("🚀 Loading variants for transfer system...");

  // First, get all products (without variants)
  const productsUrl = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
  );
  productsUrl.searchParams.set("tenant_id", tenant_id);
  productsUrl.searchParams.set("limit", "200");

  const productsRes = await fetch(productsUrl.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!productsRes.ok) {
    const errorText = await productsRes.text();
    console.error("Products API error:", errorText);
    throw new Error(`Failed to fetch products: ${productsRes.status}`);
  }

  const productsData = await productsRes.json();
  console.log("📦 Products loaded:", productsData.items?.length || 0);

  if (!productsData.items || !Array.isArray(productsData.items)) {
    console.warn("No products found");
    return [];
  }

  const variants: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    product_name?: string;
  }> = [];

  // Now get variants for each product (in batches to avoid overwhelming the API)
  const batchSize = 5;
  const products = productsData.items;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    console.log(
      `📋 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        products.length / batchSize
      )} (${batch.length} products)...`
    );

    // Process batch in parallel
    const batchPromises = batch.map(async (product: any) => {
      try {
        const productUrl = new URL(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`
        );
        productUrl.searchParams.set("tenant_id", tenant_id);
        productUrl.searchParams.set("id", product.id);
        productUrl.searchParams.set("withVariants", "true");

        const productRes = await fetch(productUrl.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (productRes.ok) {
          const productData = await productRes.json();
          if (productData.variants && Array.isArray(productData.variants)) {
            return productData.variants.map((variant: any) => ({
              id: variant.id,
              name: `${product.name}${
                variant.name ? ` - ${variant.name}` : ""
              }`,
              sku: variant.sku || "",
              price: variant.price || 0,
              product_name: product.name,
            }));
          }
        } else {
          console.warn(`Failed to load variants for product ${product.id}`);
        }
      } catch (error) {
        console.warn(
          `Error loading variants for product ${product.id}:`,
          error
        );
      }
      return [];
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach((productVariants) => {
      variants.push(...productVariants);
    });

    // Small delay to be nice to the API
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`🎉 Total variants loaded: ${variants.length}`);
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
