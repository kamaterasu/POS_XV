"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

import ProductCreateForm, {
  type Category,
} from "@/components/inventoryComponents/ProductCreateForm";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import {
  getProductByStore,
  getProductByCategory,
  getInventoryGlobal,
  updateProduct,
} from "@/lib/product/productApi";
import { getStore } from "@/lib/store/storeApi";
import { getImageShowUrl } from "@/lib/product/productImages";
import {
  getCategories,
  createCategory,
  createSubcategory,
} from "@/lib/category/categoryApi";
import { getReturnsByOrder } from "@/lib/return/returnApi";

// ---------- Types ----------
type ToastType = "success" | "error" | "warning" | "info";
type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
};

type StoreRow = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  qty?: number;
  code?: string; // SKU from variant
  storeId?: string;
  img?: string; // DB-д хадгалсан утга (ж: "product_img/xxx.png" эсвэл "xxx.png")
  imgUrl?: string; // Дүгнэсэн харах URL (signed/public/absolute)
  variantId?: string; // Variant ID for inventory tracking
  variantName?: string; // Variant name if different from product name
  price?: number; // Price from variant
  returnCount?: number; // Number of returns for this variant
  lastReturnDate?: string; // Last return date
};

// Backend inventory API response structure:
// { items: [{ store_id, variant_id, qty, variant: {...}, product: {...} }] }
const mapInventoryItem = (item: any): Product | null => {
  if (!item?.variant_id || !item?.product) return null;

  const variant = item.variant || {};
  const product = item.product || {};

  return {
    id: String(product.id || variant.id || item.variant_id),
    variantId: String(item.variant_id),
    name: product.name || variant.name || "(нэргүй)",
    variantName: variant.name !== product.name ? variant.name : undefined,
    qty: typeof item.qty === "number" ? item.qty : 0,
    code: variant.sku || undefined,
    storeId: item.store_id ? String(item.store_id) : undefined,
    img: product.img || undefined,
    price: variant.price || 0,
  };
};

// Map products from category API (different structure than inventory items)
const mapCategoryProduct = (product: any): Product | null => {
  if (!product?.id) return null;

  // Category API returns products directly, not inventory items
  return {
    id: String(product.id),
    variantId: String(product.id), // Use product ID as variant ID for now
    name: product.name || "(нэргүй)",
    variantName: undefined,
    qty: 0, // Category API doesn't provide quantity, set to 0
    code: product.sku || undefined,
    storeId: undefined, // Category API doesn't provide store info
    img: product.img || undefined,
    price: product.price || 0,
  };
};

// ---------- Utils ----------
const toArray = (v: any, keys: string[] = []) => {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  for (const k of keys) if (Array.isArray((v as any)[k])) return (v as any)[k];
  const vals = Object.values(v);
  return Array.isArray(vals) ? vals : [];
};

const mapStore = (s: any): StoreRow | null => {
  const id = s?.id ?? s?.store_id ?? s?.storeId;
  if (!id) return null;
  return { id: String(id), name: s?.name ?? s?.store_name ?? "Салбар" };
};

// ---------- Category helpers ----------
// API-ээс tree бүтэцтэй ирж буйг normalize хийж, хүүхдүүдийг үргэлж массив болгоно
export type CatNode = {
  id: string;
  name: string;
  parent_id: string | null;
  children?: CatNode[];
};

function normalizeTree(nodes: any[]): CatNode[] {
  const walk = (n: any): CatNode => ({
    id: String(n?.id ?? crypto.randomUUID()),
    name: String(n?.name ?? "(нэргүй ангилал)"),
    parent_id: n?.parent_id ?? null,
    children: Array.isArray(n?.children) ? normalizeTree(n.children) : [],
  });
  return Array.isArray(nodes) ? nodes.map(walk) : [];
}

// Категорийн модыг dropdown сонголтод ашиглахаар хавтгайруулж (path label-тай) бэлтгэнэ
function flattenCats(
  nodes: CatNode[],
  path: string[] = []
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    const label = [...path, n.name].join(" › ");
    out.push({ id: n.id, label });
    if (Array.isArray(n.children) && n.children.length) {
      out.push(...flattenCats(n.children, [...path, n.name]));
    }
  }
  return out;
}

// ---------- Image URL resolver (7 хоногийн signed URL, кэштэй) ----------
const imgUrlCache = new Map<string, string>();

async function resolveImageUrl(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;

  // Absolute URL эсвэл data URL бол шууд
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;

  // Public (app/public) зам бол шууд
  if (raw.startsWith("/")) return raw;

  // Supabase storage object замыг таамаглах
  // Хэрэв product_img/ prefix байгаа бол устгаад дахин нэмэх (давхар prefix-ээс зайлсхийх)
  let cleanPath = raw;
  if (cleanPath.startsWith("product_img/")) {
    cleanPath = cleanPath.replace("product_img/", "");
  }

  // зөвхөн файл нэр өгөгдсөн бол product_img/ гэж prefix хийнэ
  const path = cleanPath.includes("/") ? cleanPath : `product_img/${cleanPath}`;

  if (imgUrlCache.has(path)) return imgUrlCache.get(path)!;

  try {
    const signed = await getImageShowUrl(path); // 7 хоног хүчинтэй
    imgUrlCache.set(path, signed);
    return signed;
  } catch (e) {
    console.error("Failed to sign image url for", path, e);
    return undefined;
  }
}

// ---------- Tiny UI ----------
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200/60 rounded-lg ${className}`} />
);

// ---------- Image with fallback (Next/Image) ----------
function SBImage({
  src,
  alt,
  className,
  size = 48,
}: {
  src?: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed || !src ? "/default.png" : src;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      unoptimized
      loading="lazy"
    />
  );
}

// ---------- Category Tree UI (сонгоод шүүх) ----------
function CategoryNode({
  node,
  onSelect,
  selectedId,
}: {
  node: any;
  onSelect: (n: any) => void;
  selectedId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  const selected = selectedId === node?.id;

  return (
    <li>
      <div className="flex items-center gap-2 text-sm py-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex w-5 justify-center select-none text-neutral-600 hover:text-neutral-900"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
          >
            <span className={`transition-transform ${open ? "rotate-90" : ""}`}>
              ▶
            </span>
          </button>
        ) : (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1"
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => {
            onSelect(node);
          }}
          className={`text-left hover:underline ${
            selected ? "text-blue-600 font-medium" : ""
          }`}
          title="Энэ ангиллаар шүүх"
        >
          {node?.name}
        </button>
      </div>

      {hasChildren && open && (
        <ul className="pl-4 ml-2 border-l border-neutral-200 space-y-1">
          {node.children.map((child: any) => (
            <CategoryNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CategoryTree({
  nodes,
  onSelect,
  selectedId,
}: {
  nodes: any[];
  onSelect: (n: any) => void;
  selectedId?: string | null;
}) {
  if (!nodes?.length) return null;
  return (
    <ul className="space-y-1">
      {nodes.map((n: any) => (
        <CategoryNode
          key={n.id}
          node={n}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </ul>
  );
}

// ======================================================================

export default function InventoryPage() {
  const router = useRouter();

  // UI state
  const [loadingStores, setLoadingStores] = useState(true);
  const [stores, setStores] = useState<StoreRow[]>([
    { id: "all", name: "Бүгд" },
  ]);
  const [storeId, setStoreId] = useState<string>("all");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  // ProductCreateForm & categories
  const [showCreate, setShowCreate] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [loadingCats, setLoadingCats] = useState(true);
  const [catsOpen, setCatsOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  // Add Category/Subcategory UI state
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [catName, setCatName] = useState("");
  const [subName, setSubName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [creatingSub, setCreatingSub] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showReturned, setShowReturned] = useState(false);

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    price: 0,
    cost: 0,
    code: "",
    description: "",
  });
  const [updating, setUpdating] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast functions
  const addToast = (type: ToastType, title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1) Салбарууд болон tenant ID
  useEffect(() => {
    setLoadingStores(true);
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no token");

        // Get tenant ID
        const tId = await getTenantId();
        if (tId) setTenantId(tId);

        // Get stores
        const raw = await getStore(token);
        const arr = toArray(raw, ["stores", "data", "items"])
          .map(mapStore)
          .filter(Boolean) as StoreRow[];
        setStores([{ id: "all", name: "Бүгд" }, ...arr]);
      } catch (error) {
        console.error("Failed to load stores and tenant ID:", error);
        setStores([{ id: "all", name: "Бүгд" }]);
      } finally {
        setLoadingStores(false);
      }
    })();
  }, []);

  // 2) Ангилал (Category)
  async function refreshCategories(token?: string) {
    const tk = token ?? (await getAccessToken());
    if (!tk) throw new Error("no token");
    const raw = await getCategories(tk);
    const treeRaw = Array.isArray(raw?.tree)
      ? raw.tree
      : toArray(raw, ["categories", "data", "items"]);
    const tree = normalizeTree(treeRaw);
    setCats(tree as unknown as Category[]);
  }

  useEffect(() => {
    setLoadingCats(true);
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no token");
        const decoded: any = jwtDecode(token);
        const tId = decoded?.app_metadata?.tenants?.[0];
        setTenantId(tId);
        await refreshCategories(token);
      } catch (e) {
        console.error(e);
        setCats([]);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, []);

  // 3) Бараа (+ зураг бүрийн signed URL)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingProducts(true);
        const token = await getAccessToken();
        if (!token) throw new Error("no token");

        let arr: Product[] = [];
        if (selectedCat?.id) {
          // Категори сонгосон үед: тухайн категорийн (subtree=true) барааг API-аас авч үзүүлнэ
          const raw = await getProductByCategory(token, selectedCat.id);

          arr = toArray(raw, ["items", "products", "data"])
            .map(mapCategoryProduct) // Use category product mapper
            .filter(Boolean) as Product[];
        } else if (storeId === "all") {
          // For "all" stores, we can either:
          // 1. Use global scope (if user is OWNER) - aggregated inventory
          // 2. Fetch from each store individually
          try {
            // Try global scope first
            const globalRaw = await getInventoryGlobal(token);
            const globalItems = toArray(globalRaw, ["items", "data"])
              .map(mapInventoryItem)
              .filter(Boolean) as Product[];
            arr = globalItems;
          } catch (globalError) {
            console.log(
              "Global scope not available, fetching per store:",
              globalError
            );
            // Fallback: fetch from each store individually
            const merged: Product[] = [];
            for (const s of stores) {
              if (s.id === "all") continue;
              try {
                const raw = await getProductByStore(token, s.id);
                const items = toArray(raw, ["items", "data"])
                  .map(mapInventoryItem)
                  .filter(Boolean) as Product[];
                merged.push(...items);
              } catch (storeError) {
                console.error(
                  `Failed to fetch inventory for store ${s.id}:`,
                  storeError
                );
              }
            }
            arr = merged;
          }
        } else {
          // Single store
          const raw = await getProductByStore(token, storeId);
          arr = toArray(raw, ["items", "data"])
            .map(mapInventoryItem)
            .filter(Boolean) as Product[];
        }

        // signed URL-уудаа тооцоолж products-д шингээнэ
        const withUrls = await Promise.all(
          arr.map(async (p) => ({
            ...p,
            imgUrl: await resolveImageUrl(p.img),
          }))
        );

        if (!alive) return;
        setProducts(withUrls);
      } catch (e) {
        console.error("Failed to fetch inventory:", e);
        setProducts([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [storeId, stores, selectedCat?.id]);

  const mergedProducts = useMemo(() => {
    let filtered = products;

    // Filter by store
    if (storeId !== "all") {
      filtered = filtered.filter((p) => String(p.storeId) === storeId);
    } else {
      // For "all" stores, we need to handle variants properly
      const map = new Map<string, Product & { qty: number }>();

      for (const p of filtered) {
        if (!p.variantId) continue;

        const key = p.variantId;
        const prev = map.get(key);

        if (prev) {
          // Same variant from different stores - sum quantities
          map.set(key, {
            ...prev,
            qty: (prev.qty ?? 0) + (p.qty ?? 0),
          });
        } else {
          // New variant
          map.set(key, {
            ...p,
            qty: p.qty ?? 0,
          });
        }
      }
      filtered = Array.from(map.values());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.code?.toLowerCase().includes(query) ||
          p.variantName?.toLowerCase().includes(query)
      );
    }

    // Filter by stock status
    if (showOutOfStock) {
      filtered = filtered.filter((p) => (p.qty ?? 0) === 0);
    }

    // Filter by return status
    if (showReturned) {
      filtered = filtered.filter((p) => (p.returnCount ?? 0) > 0);
    }

    return filtered;
  }, [products, storeId, searchQuery, showOutOfStock, showReturned]);

  const handleBack = () => router.back();
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setStoreId(v);
    if (typeof window !== "undefined") localStorage.setItem("storeId", v);
  };
  const handleAddProduct = () => {
    if (storeId === "all") {
      addToast("warning", "Анхааруулга", "Эхлээд тодорхой салбар сонгоно уу.");
      return;
    }
    setShowCreate(true);
  };

  // --------- Create Category/Subcategory handlers ----------
  const handleOpenAddCat = () => {
    setCatsOpen(true);
    setShowAddCat(true);
    setShowAddSub(false);
  };

  const handleOpenAddSub = () => {
    console.log("🔍 Opening subcategory form...");
    console.log("selectedCat:", selectedCat);
    console.log("Will set parentId to:", selectedCat?.id ?? null);

    setCatsOpen(true);
    setShowAddSub(true);
    setShowAddCat(false);
    // selectedCat байгаа бол эцэг ангиллыг автоматаар сонгоно
    setParentId(selectedCat?.id ?? null);
  };

  const handleCreateCategory = async () => {
    const name = catName.trim();
    if (!name) {
      addToast("warning", "Анхааруулга", "Ангиллын нэр шаардлагатай.");
      return;
    }
    try {
      setCreatingCat(true);
      const token = await getAccessToken();
      if (!token) throw new Error("no token");
      await createCategory(name, token);
      await refreshCategories(token);
      setCatName("");
      setShowAddCat(false);
    } catch (e: any) {
      console.error(e);
      addToast(
        "error",
        "Алдаа",
        `Ангилал нэмэхэд алдаа гарлаа: ${e?.message ?? e}`
      );
    } finally {
      setCreatingCat(false);
    }
  };

  const handleCreateSubcategory = async () => {
    const name = subName.trim();
    const pid = parentId;

    console.log("🔍 Creating subcategory...");
    console.log("subName:", subName);
    console.log("name (trimmed):", name);
    console.log("parentId:", parentId);
    console.log("pid:", pid);
    console.log("flatCatOptions:", flatCatOptions);

    if (!name) {
      addToast("warning", "Анхааруулга", "Дэд ангиллын нэр шаардлагатай.");
      return;
    }
    if (!pid) {
      addToast("warning", "Анхааруулга", "Эцэг ангиллыг сонгоно уу.");
      return;
    }
    try {
      setCreatingSub(true);
      const token = await getAccessToken();
      if (!token) throw new Error("no token");

      console.log("🚀 Calling createSubcategory API...");
      console.log("API params:", { parent_id: pid, name, token: "***" });

      const result = await createSubcategory(pid, name, token);
      console.log("✅ API call successful, result:", result);

      console.log("🔄 Refreshing categories...");
      await refreshCategories(token);
      console.log("✅ Categories refreshed");

      setSubName("");
      setShowAddSub(false);
      console.log("✅ Subcategory creation completed successfully!");

      // Add success feedback
      addToast("success", "Амжилттай", "Дэд ангилал амжилттай нэмэгдлээ!");

      // Optional: Auto-select parent category to show the new subcategory
      const parentCategory = flatCatOptions.find((opt) => opt.id === pid);
      if (parentCategory) {
        setSelectedCat({ id: pid, name: parentCategory.label });
      }

      // шинэчлэгдсэн категорийг шүүж харах бол дараахыг идэвхжүүлж болно:
      // setSelectedCat({ id: pid, name: flattenCats(cats).find(c => c.id === pid)?.label ?? '...' });
    } catch (e: any) {
      console.error("❌ Subcategory creation failed:", e);
      addToast(
        "error",
        "Алдаа",
        `Дэд ангилал нэмэхэд алдаа гарлаа: ${e?.message ?? e}`
      );
    } finally {
      setCreatingSub(false);
    }
  };

  const branchNames = useMemo(() => stores.map((s) => s.name), [stores]);
  const flatCatOptions = useMemo(
    () => flattenCats(cats as unknown as CatNode[]),
    [cats]
  );

  // --------- Edit and Delete handlers ----------
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: product.price || 0,
      cost: 0, // We don't have cost in the Product type, so default to 0
      code: product.code || "",
      description: "", // We don't have description in the Product type
    });
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    try {
      setUpdating(true);
      const result = await updateProduct({
        id: editingProduct.id,
        name: editForm.name,
        description: editForm.description || null,
        upsert_variants: [
          {
            id: editingProduct.variantId,
            name: editForm.name,
            sku: editForm.code,
            price: editForm.price,
            cost: editForm.cost,
            attrs: {},
          },
        ],
      });

      if (result.error) {
        addToast("error", "Алдаа", `Шинэчлэхэд алдаа гарлаа: ${result.error}`);
      } else {
        addToast("success", "Амжилттай", "Амжилттай шинэчлэгдлээ!");
        setEditingProduct(null);
        // Refresh products
        const token = await getAccessToken();
        if (token) {
          window.location.reload();
        }
      }
    } catch (e: any) {
      addToast("error", "Алдаа", `Алдаа гарлаа: ${e?.message ?? e}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-svh bg-gradient-to-br from-slate-50 via-white to-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 min-h-svh flex flex-col gap-6">
        {/* Top */}
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-4 pb-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleBack}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white shadow-sm text-sm hover:shadow-md hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium text-slate-700"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Буцах
            </button>

            <div className="relative">
              <label htmlFor="branch" className="sr-only">
                Салбар сонгох
              </label>
              {loadingStores ? (
                <Skeleton className="h-10 w-48 rounded-xl" />
              ) : (
                <div className="relative">
                  <select
                    id="branch"
                    value={storeId}
                    onChange={handleStoreChange}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm shadow-sm hover:shadow-md transition-all duration-200 appearance-none font-medium text-slate-700"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Search input */}
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Бараа хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-sm shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            <button
              onClick={handleAddProduct}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Бараа нэмэх
            </button>

            <button
              onClick={() => setCatsOpen((v) => !v)}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm shadow-sm hover:shadow-md hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium text-slate-700"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14-7l-7 7-7-7m14 18l-7-7-7 7"
                />
              </svg>
              {catsOpen ? "Ангилал нуух" : "Ангилал харах"}
            </button>

            {/* Filter buttons */}
            <button
              onClick={() => setShowOutOfStock(!showOutOfStock)}
              className={`h-10 px-4 rounded-xl border text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium ${
                showOutOfStock
                  ? "bg-gradient-to-r from-red-500 to-red-600 border-red-500 text-white shadow-red-200"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
              Дууссан
            </button>

            <button
              onClick={() => setShowReturned(!showReturned)}
              className={`h-10 px-4 rounded-xl border text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium ${
                showReturned
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 border-orange-500 text-white shadow-orange-200"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              Буцаалттай
            </button>

            {/* Category action buttons */}
            <button
              onClick={handleOpenAddCat}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm shadow-sm hover:shadow-md hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium text-slate-700"
              title="Үндсэн ангилал нэмэх"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14-7l-7 7-7-7m14 18l-7-7-7 7"
                />
              </svg>
              + Ангилал
            </button>
            {/* <button
              onClick={handleOpenAddSub}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-sm shadow-sm hover:shadow-md hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 font-medium text-slate-700"
              title="Дэд ангилал нэмэх"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              + Дэд ангилал
            </button> */}
          </div>
        </div>

        {/* Categories panel */}
        {catsOpen && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-100/50 p-6">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="text-lg font-semibold flex items-center gap-3 text-slate-800">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14-7l-7 7-7-7m14 18l-7-7-7 7"
                    />
                  </svg>
                </div>
                Ангилалууд
                {selectedCat && (
                  <span className="text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full font-medium">
                    Шүүлт: {selectedCat.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                {loadingCats ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Уншиж байна…
                  </div>
                ) : (
                  `${cats.length} үндсэн ангилал`
                )}
                {selectedCat && (
                  <button
                    onClick={() => setSelectedCat(null)}
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm hover:shadow-sm hover:bg-slate-50 transition-all duration-200"
                    title="Категори шүүлтийг арилгах"
                  >
                    Шүүлт арилгах
                  </button>
                )}
              </div>
            </div>

            {/* Create category form */}
            {showAddCat && (
              <div className="mb-6 rounded-xl border border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-white">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Үндсэн ангилал нэмэх
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ангиллын нэр"
                    className="h-10 px-4 rounded-lg border border-slate-300 text-sm flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={creatingCat}
                    className="h-10 px-4 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                  >
                    {creatingCat ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Хадгалж байна…
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Хадгалах
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCat(false);
                      setCatName("");
                    }}
                    className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-50 transition-all duration-200"
                  >
                    Болих
                  </button>
                </div>
              </div>
            )}

            {/* Create subcategory form */}
            {showAddSub && (
              <div className="mb-6 rounded-xl border border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-white">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Дэд ангилал нэмэх
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Дэд ангиллын нэр"
                    className="h-10 px-4 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                  <select
                    value={parentId ?? ""}
                    onChange={(e) => setParentId(e.target.value || null)}
                    className="h-10 px-4 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    title="Эцэг ангилал"
                  >
                    <option value="" disabled>
                      Эцэг ангилал сонгох
                    </option>
                    {flatCatOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSubcategory}
                      disabled={creatingSub}
                      className="h-10 px-4 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                    >
                      {creatingSub ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Хадгалж байна…
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Хадгалах
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddSub(false);
                        setSubName("");
                        setParentId(null);
                      }}
                      className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-50 transition-all duration-200"
                    >
                      Болих
                    </button>
                  </div>
                </div>
                {selectedCat?.id && (
                  <div className="text-[11px] text-neutral-500 mt-1">
                    Сануулга: Одоогоор сонгогдсон “{selectedCat.name}” ангиллыг
                    эцэг болгон автоматаар санал болгосон.
                  </div>
                )}
              </div>
            )}

            {loadingCats ? (
              <>
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/4 mb-2" />
              </>
            ) : cats.length === 0 ? (
              <div className="text-sm text-neutral-400">Ангилал олдсонгүй.</div>
            ) : (
              <CategoryTree
                nodes={cats}
                onSelect={(n: any) => {
                  console.log("CategoryTree onSelect called with:", n);
                  // Show toast for debugging
                  addToast(
                    "info",
                    "Category Selected",
                    `${n.name} (ID: ${n.id})`
                  );
                  setSelectedCat({ id: String(n.id), name: String(n.name) });
                }}
                selectedId={selectedCat?.id ?? null}
              />
            )}
          </div>
        )}

        {/* Create Product Form */}
        {showCreate && storeId !== "all" && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-100/50 overflow-hidden">
            {/* Enhanced Header with Gradient Background */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-6 text-white relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8"></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Шинэ бараа нэмэх
                      <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-2 text-blue-100">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        <span className="text-sm font-medium">
                          {stores.find((s) => s.id === storeId)?.name}
                        </span>
                      </div>
                      <div className="w-1 h-1 bg-blue-200 rounded-full"></div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-sm font-medium">
                          {new Date().toLocaleDateString("mn-MN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all duration-200 flex items-center justify-center group shadow-lg"
                  title="Хаах"
                >
                  <svg
                    className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Enhanced Form Container */}
            <div className="p-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">
                      Барааны мэдээлэл
                    </h4>
                    <p className="text-sm text-slate-500">
                      Бүх шаардлагатай талбарыг бөглөнө үү
                    </p>
                  </div>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span>Мэдээлэл оруулах</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-slate-200 rounded-full">
                    <div className="w-1/3 h-full bg-gradient-to-r from-blue-600 to-blue-700 rounded-full"></div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                    <span>Хадгалах</span>
                  </div>
                </div>
              </div>

              {/* Form with enhanced styling */}
              <div className="bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 rounded-2xl border border-slate-200/60 p-6 shadow-inner">
                <ProductCreateForm
                  cats={cats}
                  branches={branchNames}
                  tenantId={tenantId}
                />
              </div>

              {/* Helper text */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-blue-900 mb-1">
                      Зөвлөгөө
                    </h5>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      Барааны нэр, ангилал, үнэ зэрэг үндсэн мэдээллийг
                      оруулснаар борлуулалтын систем дээр бүртгэгдэх болно.
                      Зураг нэмэх нь бараагаа илүү тод танилцуулахад тусална.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-lg shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-100/60 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {mergedProducts.length}
            </div>
            <div className="text-sm text-slate-500 font-medium">Нийт бараа</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-lg shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-100/60 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              {mergedProducts.filter((p) => (p.qty ?? 0) > 10).length}
            </div>
            <div className="text-sm text-slate-500 font-medium">Хангалттай</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-lg shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-100/60 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">
              {
                mergedProducts.filter(
                  (p) => (p.qty ?? 0) > 0 && (p.qty ?? 0) <= 10
                ).length
              }
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Бага үлдсэн
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-lg shadow-slate-100/50 hover:shadow-xl hover:shadow-slate-100/60 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
                />
              </svg>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-1">
              {mergedProducts.filter((p) => (p.qty ?? 0) === 0).length}
            </div>
            <div className="text-sm text-slate-500 font-medium">Дууссан</div>
          </div>
        </div>

        {/* Product List */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-100/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                Барааны жагсаалт{" "}
                {loadingProducts ? (
                  <span className="text-slate-400">уншиж байна...</span>
                ) : (
                  <span className="text-blue-600">
                    ({mergedProducts.length})
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loadingProducts ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ) : mergedProducts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <p className="text-slate-500 text-lg font-medium mb-2">
                  {searchQuery
                    ? `"${searchQuery}" гэсэн хайлтад тохирох бараа олдсонгүй`
                    : showOutOfStock
                    ? "Дууссан бараа байхгүй байна"
                    : showReturned
                    ? "Буцаалттай бараа олдсонгүй"
                    : selectedCat
                    ? `"${selectedCat.name}" ангилалд бараа олдсонгүй`
                    : "Бараа олдсонгүй"}
                </p>
                <p className="text-slate-400">
                  Шинэ бараа нэмэх эсвэл шүүлтээ өөрчилнө үү
                </p>
              </div>
            ) : (
              mergedProducts.map((p) => (
                <div
                  key={p.variantId || p.id}
                  className="group flex items-center gap-6 px-6 py-4 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white transition-all duration-200"
                >
                  <SBImage
                    src={p.imgUrl}
                    alt={p.name}
                    size={56}
                    className="w-14 h-14 object-cover rounded-xl border border-slate-200 bg-slate-100 flex-shrink-0 shadow-sm"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 text-base mb-1">
                      {p.name}
                      {p.variantName && p.variantName !== p.name && (
                        <span className="text-sm text-slate-500 ml-2 font-normal">
                          ({p.variantName})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-4">
                      {p.code && (
                        <span className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                            />
                          </svg>
                          {p.code}
                        </span>
                      )}
                      {p.price && (
                        <span className="flex items-center gap-1 text-green-700">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                            />
                          </svg>
                          ₮{p.price.toLocaleString()}
                        </span>
                      )}
                      {p.returnCount && p.returnCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-100 px-2 py-1 rounded-full text-xs font-medium">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                            />
                          </svg>
                          {p.returnCount} буцаалт
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Badge */}
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
                        typeof p.qty === "number"
                          ? p.qty === 0
                            ? "text-red-700 bg-red-100 border border-red-200"
                            : p.qty < 10
                            ? "text-orange-700 bg-orange-100 border border-orange-200"
                            : "text-green-700 bg-green-100 border border-green-200"
                          : "text-slate-700 bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {typeof p.qty === "number" && (
                        <div
                          className={`w-2 h-2 rounded-full ${
                            p.qty === 0
                              ? "bg-red-500"
                              : p.qty < 10
                              ? "bg-orange-500"
                              : "bg-green-500"
                          }`}
                        />
                      )}
                      {typeof p.qty === "number"
                        ? storeId === "all"
                          ? `Нийт: ${p.qty}`
                          : `${p.qty} ширхэг`
                        : "—"}
                    </div>
                    {typeof p.qty === "number" && (
                      <div className="text-xs text-slate-400 mt-1 text-center">
                        {p.qty === 0
                          ? "Дууссан"
                          : p.qty < 10
                          ? "Бага үлдсэн"
                          : "Хангалттай"}
                      </div>
                    )}
                  </div>

                  {/* Store info */}
                  {storeId !== "all" && (
                    <div className="text-sm text-slate-400 min-w-[100px] text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                        {stores.find((s) => s.id === p.storeId)?.name || ""}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Link
                      href={`/productdetail/${p.id}`}
                      className="h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 hover:border-blue-300 transition-all duration-200 flex items-center gap-2 font-medium"
                      title="Дэлгэрэнгүй харах"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Харах
                    </Link>
                    <button
                      onClick={() => handleEditProduct(p)}
                      className="h-9 px-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm hover:bg-green-100 hover:border-green-300 transition-all duration-200 flex items-center gap-2 font-medium"
                      title="Засах"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Засах
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Enhanced Edit Modal */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-0 w-full max-w-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Бараа засах</h3>
                    <p className="text-sm text-blue-100 mt-1">
                      {editingProduct.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Product Image Preview */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <SBImage
                    src={editingProduct.imgUrl}
                    alt={editingProduct.name}
                    size={64}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {editingProduct.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {editingProduct.code && `SKU: ${editingProduct.code}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      Одоогийн үнэ: ₮
                      {editingProduct.price?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        Барааны нэр
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Барааны нэр оруулна уу"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                            />
                          </svg>
                          Зарах үнэ
                        </span>
                      </label>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            price: Number(e.target.value),
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="0"
                        min="0"
                        step="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <span className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                          Авах үнэ
                        </span>
                      </label>
                      <input
                        type="number"
                        value={editForm.cost}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            cost: Number(e.target.value),
                          }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="0"
                        min="0"
                        step="100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                          />
                        </svg>
                        SKU код
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editForm.code}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          code: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="SKU код оруулна уу"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h7"
                          />
                        </svg>
                        Тайлбар
                      </span>
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                      placeholder="Барааны тайлбар (сонголттой)"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3">
                <button
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Цуцлах
                </button>
                <button
                  onClick={handleUpdateProduct}
                  disabled={updating || !editForm.name.trim()}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {updating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="w-4 h-4 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Хадгалж байна...
                    </span>
                  ) : (
                    "Хадгалах"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm rounded-xl shadow-lg border p-4 transform transition-all duration-300 animate-in slide-in-from-right ${
                toast.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : toast.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : toast.type === "warning"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {toast.type === "success" && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "error" && (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "warning" && (
                    <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "info" && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{toast.title}</div>
                  <div className="text-sm mt-1 opacity-90">{toast.message}</div>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
