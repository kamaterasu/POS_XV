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
} from "@/lib/product/productApi";
import { getStore } from "@/lib/store/storeApi";
import { getImageShowUrl } from "@/lib/product/productImages";
import { getCategories, createCategory, createSubcategory } from "@/lib/category/categoryApi";

// ---------- Types ----------
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
    name: String(n?.name ?? '(нэргүй ангилал)'),
    parent_id: n?.parent_id ?? null,
    children: Array.isArray(n?.children) ? normalizeTree(n.children) : [],
  });
  return Array.isArray(nodes) ? nodes.map(walk) : [];
}

// Категорийн модыг dropdown сонголтод ашиглахаар хавтгайруулж (path label-тай) бэлтгэнэ
function flattenCats(nodes: CatNode[], path: string[] = []): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    const label = [...path, n.name].join(' › ');
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
  // зөвхөн файл нэр өгөгдсөн бол product_img/ гэж prefix хийнэ
  const path = raw.includes("/") ? raw : `product_img/${raw}`;

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
  <div className={`animate-pulse bg-neutral-200 ${className}`} />
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
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
          >
            <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-300 ml-1" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onSelect(node)}
          className={`text-left hover:underline ${selected ? 'text-blue-600 font-medium' : ''}`}
          title="Энэ ангиллаар шүүх"
        >
          {node?.name}
        </button>
      </div>

      {hasChildren && open && (
        <ul className="pl-4 ml-2 border-l border-neutral-200 space-y-1">
          {node.children.map((child: any) => (
            <CategoryNode key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} />
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
        <CategoryNode key={n.id} node={n} onSelect={onSelect} selectedId={selectedId} />
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
  const [selectedCat, setSelectedCat] = useState<{ id: string; name: string } | null>(null);
  const [loadingCats, setLoadingCats] = useState(true);
  const [catsOpen, setCatsOpen] = useState(false);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  // Add Category/Subcategory UI state
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [catName, setCatName] = useState('');
  const [subName, setSubName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [creatingSub, setCreatingSub] = useState(false);

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
    if (!tk) throw new Error('no token');
    const raw = await getCategories(tk);
    const treeRaw = Array.isArray(raw?.tree) ? raw.tree : toArray(raw, ['categories', 'data', 'items']);
    const tree = normalizeTree(treeRaw);
    setCats(tree as unknown as Category[]);
  }

  useEffect(() => {
    setLoadingCats(true);
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('no token');
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
          arr = toArray(raw, ['items', 'products', 'data']).map(mapInventoryItem).filter(Boolean) as Product[];
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
    if (storeId !== "all") {
      return products.filter((p) => String(p.storeId) === storeId);
    }

    // For "all" stores, we need to handle variants properly
    // Each variant should be treated as a separate item, but we may want to group by product
    const map = new Map<string, Product & { qty: number }>();

    for (const p of products) {
      if (!p.variantId) continue;

      // Use variantId as the key to avoid conflicts between variants of the same product
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

    return Array.from(map.values());
  }, [products, storeId]);

  const handleBack = () => router.back();
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setStoreId(v);
    if (typeof window !== 'undefined') localStorage.setItem('storeId', v);
  };
  const handleAddProduct = () => {
    if (storeId === "all") {
      alert("Эхлээд тодорхой салбар сонгоно уу.");
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
    setCatsOpen(true);
    setShowAddSub(true);
    setShowAddCat(false);
    // selectedCat байгаа бол эцэг ангиллыг автоматаар сонгоно
    setParentId(selectedCat?.id ?? null);
  };

  const handleCreateCategory = async () => {
    const name = catName.trim();
    if (!name) return alert('Ангиллын нэр шаардлагатай.');
    try {
      setCreatingCat(true);
      const token = await getAccessToken();
      if (!token) throw new Error('no token');
      await createCategory(name, token);
      await refreshCategories(token);
      setCatName('');
      setShowAddCat(false);
    } catch (e: any) {
      console.error(e);
      alert(`Ангилал нэмэхэд алдаа гарлаа:\n${e?.message ?? e}`);
    } finally {
      setCreatingCat(false);
    }
  };

  const handleCreateSubcategory = async () => {
    const name = subName.trim();
    const pid = parentId;
    if (!name) return alert('Дэд ангиллын нэр шаардлагатай.');
    if (!pid) return alert('Эцэг ангиллыг сонгоно уу.');
    try {
      setCreatingSub(true);
      const token = await getAccessToken();
      if (!token) throw new Error('no token');
      await createSubcategory(pid, name, token);
      await refreshCategories(token);
      setSubName('');
      setShowAddSub(false);
      // шинэчлэгдсэн категорийг шүүж харах бол дараахыг идэвхжүүлж болно:
      // setSelectedCat({ id: pid, name: flattenCats(cats).find(c => c.id === pid)?.label ?? '...' });
    } catch (e: any) {
      console.error(e);
      alert(`Дэд ангилал нэмэхэд алдаа гарлаа:\n${e?.message ?? e}`);
    } finally {
      setCreatingSub(false);
    }
  };

  const branchNames = useMemo(() => stores.map((s) => s.name), [stores]);
  const flatCatOptions = useMemo(() => flattenCats(cats as unknown as CatNode[]), [cats]);

  return (
    <div className="min-h-svh bg-[#F7F7F5] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 min-h-svh flex flex-col gap-4">
        {/* Top */}
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 pb-3 bg-[#F7F7F5]/90 backdrop-blur border-b border-neutral-200">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBack}
              className="h-9 px-3 rounded-full border border-neutral-200 bg-white shadow text-xs hover:shadow-md active:scale-[0.99] transition"
            >
              ← Буцах
            </button>

            <div className="relative">
              <label htmlFor="branch" className="sr-only">Салбар сонгох</label>
              {loadingStores ? (
                <Skeleton className="h-9 w-40 rounded-full" />
              ) : (
                <select
                  id="branch"
                  value={storeId}
                  onChange={handleStoreChange}
                  className="h-9 rounded-full border border-neutral-200 bg-white px-4 pr-8 text-xs"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs">▾</span>
            </div>

            <button
              onClick={handleAddProduct}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
            >
              + Бараа
            </button>

            <button
              onClick={() => setCatsOpen((v) => !v)}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
            >
              {catsOpen ? 'Ангилал нуух' : 'Ангилал харах'}
            </button>

            {/* Шинэ: Ангилал/Дэд ангилал нэмэх товчнууд */}
            <button
              onClick={handleOpenAddCat}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
              title="Үндсэн ангилал нэмэх"
            >
              + Ангилал
            </button>
            <button
              onClick={handleOpenAddSub}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
              title="Дэд ангилал нэмэх"
            >
              + Дэд ангилал
            </button>
          </div>
        </div>

        {/* Categories panel */}
        {catsOpen && (
          <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-sm font-medium flex items-center gap-2">
                Ангилалууд
                {selectedCat && (
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Шүүлт: {selectedCat.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                {loadingCats ? 'Уншиж байна…' : `${cats.length} үндсэн ангилал`}
                {selectedCat && (
                  <button
                    onClick={() => setSelectedCat(null)}
                    className="ml-2 h-7 px-2 rounded-full border border-neutral-200 bg-white text-xs hover:shadow-sm"
                    title="Категори шүүлтийг арилгах"
                  >
                    Шүүлт арилгах
                  </button>
                )}
              </div>
            </div>

            {/* Шинэ: Үндсэн ангилал нэмэх form */}
            {showAddCat && (
              <div className="mb-4 rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="text-xs font-medium mb-2">Үндсэн ангилал нэмэх</div>
                <div className="flex items-center gap-2">
                  <input
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ангиллын нэр"
                    className="h-9 px-3 rounded-md border border-neutral-300 text-sm flex-1"
                  />
                  <button
                    onClick={handleCreateCategory}
                    disabled={creatingCat}
                    className="h-9 px-3 rounded-md bg-black text-white text-xs disabled:opacity-50"
                  >
                    {creatingCat ? 'Хадгалж байна…' : 'Хадгалах'}
                  </button>
                  <button
                    onClick={() => { setShowAddCat(false); setCatName(''); }}
                    className="h-9 px-3 rounded-md border border-neutral-300 bg-white text-xs"
                  >
                    Болих
                  </button>
                </div>
              </div>
            )}

            {/* Шинэ: Дэд ангилал нэмэх form */}
            {showAddSub && (
              <div className="mb-4 rounded-lg border border-neutral-200 p-3 bg-neutral-50/50">
                <div className="text-xs font-medium mb-2">Дэд ангилал нэмэх</div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Дэд ангиллын нэр"
                    className="h-9 px-3 rounded-md border border-neutral-300 text-sm"
                  />
                  <select
                    value={parentId ?? ''}
                    onChange={(e) => setParentId(e.target.value || null)}
                    className="h-9 px-3 rounded-md border border-neutral-300 text-sm"
                    title="Эцэг ангилал"
                  >
                    <option value="" disabled>Эцэг ангилал сонгох</option>
                    {flatCatOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSubcategory}
                      disabled={creatingSub}
                      className="h-9 px-3 rounded-md bg-black text-white text-xs disabled:opacity-50"
                    >
                      {creatingSub ? 'Хадгалж байна…' : 'Хадгалах'}
                    </button>
                    <button
                      onClick={() => { setShowAddSub(false); setSubName(''); setParentId(null); }}
                      className="h-9 px-3 rounded-md border border-neutral-300 bg-white text-xs"
                    >
                      Болих
                    </button>
                  </div>
                </div>
                {selectedCat?.id && (
                  <div className="text-[11px] text-neutral-500 mt-1">
                    Сануулга: Одоогоор сонгогдсон “{selectedCat.name}” ангиллыг эцэг болгон автоматаар санал болгосон.
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
                onSelect={(n: any) => setSelectedCat({ id: String(n.id), name: String(n.name) })}
                selectedId={selectedCat?.id ?? null}
              />
            )}
          </div>
        )}

        {/* Create form */}
        {showCreate && storeId !== "all" && (
          <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">
                Шинэ бараа нэмэх (Салбар:{" "}
                {stores.find((s) => s.id === storeId)?.name})
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="h-8 px-3 rounded-md border border-[#E6E6E6] bg-white text-xs"
              >
                Хаах
              </button>
            </div>
            <ProductCreateForm
              cats={cats}
              branches={branchNames}
              tenantId={tenantId}
            />
          </div>
        )}

        {/* List */}
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 text-sm font-medium">
            Барааны жагсаалт{" "}
            {loadingProducts ? "…" : `(${mergedProducts.length})`}
          </div>

          <div className="divide-y divide-neutral-100">
            {loadingProducts ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : mergedProducts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400">
                Бараа олдсонгүй.
              </div>
            ) : (
              mergedProducts.map((p) => (
                <Link
                  key={p.variantId || p.id}
                  href={`/productdetail/${p.id}`}
                  prefetch
                  className="group flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 transition"
                  title="Дэлгэрэнгүй рүү орох"
                >
                  <SBImage
                    src={p.imgUrl}
                    alt={p.name}
                    size={48}
                    className="w-12 h-12 object-cover rounded border border-neutral-200 bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium group-hover:underline">
                      {p.name}
                      {p.variantName && p.variantName !== p.name && (
                        <span className="text-sm text-neutral-500 ml-2">
                          ({p.variantName})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {p.code && `Код: ${p.code}`}
                      {p.price && (
                        <span className="ml-3">
                          Үнэ: ₮{p.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {typeof p.qty === "number"
                      ? storeId === "all"
                        ? `Нийт: ${p.qty}`
                        : `Тоо: ${p.qty}`
                      : ""}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {storeId === "all"
                      ? ""
                      : stores.find((s) => s.id === p.storeId)?.name || ""}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
