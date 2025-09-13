# Product Edge Function Fix for Transfer System

## Current Issue

The transfer system needs to load ALL products with their variants, but your product edge function only returns variants for single product requests (with id parameter).

## Recommended Fix

Modify your product edge function GET handler to support variants in list requests:

```typescript
// In your product edge function handleGet:
async function handleGet(req, authed, admin) {
  const url = new URL(req.url);
  const tenant_id = url.searchParams.get("tenant_id");
  const id = url.searchParams.get("id");
  const withVariants = url.searchParams.get("withVariants") === "true";
  const category_id = url.searchParams.get("category_id");
  const subtree = url.searchParams.get("subtree") === "true";
  const search = url.searchParams.get("search")?.trim();
  const limit = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("limit") ?? 50))
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const store_id = url.searchParams.get("store_id") ?? undefined;

  if (!tenant_id) return json({ error: "tenant_id is required" }, 400);

  // Single product logic (unchanged)
  if (id) {
    // ... existing single product code ...
  }

  // List products logic
  let q = authed
    .from("products")
    .select("id,tenant_id,category_id,name,description,created_at,img", {
      count: "exact",
    })
    .eq("tenant_id", tenant_id);

  // Apply filters (existing logic)
  if (category_id) {
    if (subtree) {
      const ids = await getCategorySubtreeIds(admin, tenant_id, category_id);
      if (ids.length === 0) return json({ items: [], count: 0, limit, offset });
      q = q.in("category_id", ids);
    } else {
      q = q.eq("category_id", category_id);
    }
  }
  if (search) q = q.ilike("name", `%${search}%`);
  q = q.order("name").range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) return json({ error: error.message }, 400);

  // NEW: If withVariants=true, fetch variants for all products
  if (withVariants && data && data.length > 0) {
    const productIds = data.map((p) => p.id);

    // Get all variants for these products
    const { data: variants, error: vErr } = await authed
      .from("product_variants")
      .select("id,product_id,name,attrs,sku,price,cost,created_at")
      .eq("tenant_id", tenant_id)
      .in("product_id", productIds)
      .order("created_at", { ascending: true });

    if (vErr) return json({ error: vErr.message }, 400);

    // Get inventory quantities if store_id provided
    const variantIds = (variants ?? []).map((v) => v.id);
    const qtyMap = await getVariantQty(authed, tenant_id, variantIds, store_id);

    // Attach variants with quantities to products
    const productsWithVariants = data.map((product) => ({
      ...product,
      variants: (variants ?? [])
        .filter((v) => v.product_id === product.id)
        .map((v) => ({
          ...v,
          qty: qtyMap.get(v.id) ?? 0,
        })),
    }));

    return json({
      items: productsWithVariants,
      count,
      limit,
      offset,
    });
  }

  return json({
    items: data,
    count,
    limit,
    offset,
  });
}
```

## Alternative: Create a Dedicated Variants Endpoint

If you don't want to modify the product endpoint, create a separate endpoint for variants:

```typescript
// New endpoint: /functions/v1/variants
// GET /functions/v1/variants?tenant_id=xxx&store_id=xxx&limit=500
```
