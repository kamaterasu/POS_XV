import { jwtDecode } from "jwt-decode";

export async function getProductDetail(productId: string, token: string) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];


  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&id=${productId}&withVariants=true`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch product details");
  }

  const data = await response.json();
  return data;
}