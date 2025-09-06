import { jwtDecode } from "jwt-decode";

export async function getProduct(token: string, order_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&search=&limit=20&offset=0`);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

export async function getProductByVariant(token: string, product_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&id=${product_id}&withVariants=true}`);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

export async function getProductByCategory(token: string, category_id: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&category_id=${category_id}&subtree=true`);

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

