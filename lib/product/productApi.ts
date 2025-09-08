import { jwtDecode } from "jwt-decode";
import { getAccessToken } from "@/lib/helper/getAccessToken";

export async function listProducts(storeId: string) {
  try {
    // Get token for API call
    const token = await getAccessToken();
    if (!token) return [];

    // Use the existing getProduct function to get products
    const response = await getProduct(token);

    // Transform the response to match expected format
    if (response?.products) {
      return response.products.map((product: any) => ({
        id: product.id,
        name: product.name,
        imgPath: product.img || "/default.png",
        price: product.variants?.[0]?.price || 0,
        qty: product.variants?.[0]?.stock || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}
export async function getProductByStore(token: string, storeId: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  if (!tenant_id) {
    throw new Error("No tenant_id found in JWT token");
  }

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`
  );

  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("scope", "store");
  url.searchParams.set("store_id", storeId);
  // Add a higher limit to get more products
  url.searchParams.set("limit", "500");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Inventory API failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log("Inventory Response:", data);
  return data;
}

// New function to get inventory for all stores (global scope for OWNER)
export async function getInventoryGlobal(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  if (!tenant_id) {
    throw new Error("No tenant_id found in JWT token");
  }

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inventory`
  );

  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("scope", "global");
  url.searchParams.set("limit", "500");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Global Inventory API failed: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  console.log("Global Inventory Response:", data);
  return data;
}

export async function getProduct(token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&search=&limit=20&offset=0`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}


export async function getProductById(product_id: string) {
  const token = await getAccessToken();
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&id=${product_id}&withVariants=true`
  );
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

export async function getProductByCategory(token: string, category_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&category_id=${category_id}&subtree=true`
  );

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}
type VariantInput = {
  name: string;
  sku: string;
  price: number;
  cost: number;
  attrs?: Record<string, string>;
};

type ProductInput = {
  name: string;
  category_id: string;
  variants: VariantInput[];
  img?: string;
};
export async function createProduct(token: string, product: ProductInput) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

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

  return res.json();
}

type UpdateProductInput = {
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

export async function updateProduct(product: UpdateProductInput) {
  const token = await getAccessToken();
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

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

  return res.json();
}

export async function deleteProduct(productId: string) {
  const token = await getAccessToken();
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product`;
  const payload = {
    tenant_id,
    id: productId,
    confirm: "DELETE",
  };

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}
