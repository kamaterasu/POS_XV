"use client";

import { useRef, useMemo, useState, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";

import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getUserRole, canAccessFeature } from "@/lib/helper/getUserRole";
import { getCategories } from "@/lib/category/categoryApi";
import { createCategory } from "@/lib/category/categoryApi";
import { createProduct } from "@/lib/product/productApi";
import { Loading } from "@/components/Loading";

// ✅ Зөв замаас
import { uploadProductImageOnly } from "@/lib/product/productImages";

// ✅ Салбаруудын жагсаалт авч ID-г нэртэй нь тааруулах
import { listStores, type StoreRow } from "@/lib/store/storeApi";

// ✅ Анхны үлдэгдлийг бүртгэх
import { productAddToInventory } from "@/lib/inventory/inventoryApi";

/* ========================== Types & utils ========================== */
export type Category = { id: string; name: string; parent_id: string | null };
type CleanCategory = { id: string; name: string; parent_id: string | null };

export type CatNode = {
  id: string;
  name: string;
  parent_id: string | null;
  children?: CatNode[];
};

type Variant = {
  id: string;
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
};

const rid = () => Math.random().toString(36).slice(2, 10);

const toArray = (v: any) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    if (Array.isArray(v.categories)) return v.categories;
    if (Array.isArray(v.data)) return v.data;
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.rows)) return v.rows;
  }
  return [];
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

function sanitizeCats(cats: Category[] = []): CleanCategory[] {
  return (cats || [])
    .map((c: any) => ({
      id: String(c?.id ?? c?.uuid ?? ""),
      name: String(c?.name ?? ""),
      parent_id: c?.parent_id ?? null,
    }))
    .filter((c) => !!c.id);
}

async function apiCategoryCreate({
  tenantId,
  name,
  parentId,
}: {
  tenantId: string;
  name: string;
  parentId: string | null;
}) {
  const token = await getAccessToken();
  if (!token) throw new Error("No token");
  return await createCategory(token, {
    name,
    parent_id: parentId,
    tenant_id: tenantId,
  } as any);
}



/* ========================== Category Tree Components ========================== */
// Category Tree UI components copied from inventory page
function CategoryNode({
  node,
  onSelect,
  selectedId,
}: {
  node: any;
  onSelect: (n: any) => void;
  selectedId?: string | null;
}) {
  const [open, setOpen] = useState(true); // Дэд ангилалууд анхнаасаа нээлттэй харагдана
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  const selected = selectedId === node?.id;

  return (
    <li>
      <div className="flex items-center gap-3 text-sm py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex w-5 h-5 items-center justify-center rounded hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
          >
            <svg 
              className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-300" />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            console.log('Category selected:', node?.name, node?.id); // Debug log
            onSelect(node);
          }}
          className={`flex-1 text-left py-1 px-2 rounded hover:bg-blue-50 transition-colors ${
            selected 
              ? "text-blue-700 font-semibold bg-blue-100" 
              : "text-slate-700 hover:text-blue-600"
          }`}
          title={`${node?.name} ангиллаар шүүх`}
        >
          {node?.name}
          {hasChildren && (
            <span className="ml-2 text-xs text-slate-500">
              ({node.children.length})
            </span>
          )}
        </button>
      </div>

      {hasChildren && open && (
        <ul className="ml-6 mt-1 space-y-1 border-l-2 border-slate-100 pl-4">
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
  if (!nodes?.length) {
    return (
      <div className="text-sm text-slate-500 py-4 text-center">
        Ангилал олдсонгүй
      </div>
    );
  }
  
  console.log('CategoryTree nodes:', nodes); // Debug log
  
  return (
    <div className="max-h-96 overflow-y-auto">
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
    </div>
  );
}

/* ========================== CategoryPicker ========================== */
function CategoryPicker({
  categories,
  value,
  onChange,
  tenantId,
  disabled,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null, pathLabel: string, leafName?: string) => void;
  tenantId?: string;
  disabled?: boolean;
}) {
  // Normalize categories to tree structure
  const treeNodes = useMemo(() => {
    const result = normalizeTree(categories);
    console.log('CategoryPicker tree nodes:', result);
    return result;
  }, [categories]);

  const [open, setOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CatNode | null>(null);

  // Find selected node based on value
  useEffect(() => {
    if (!value) {
      setSelectedNode(null);
      return;
    }
    
    const findNode = (nodes: CatNode[]): CatNode | null => {
      for (const node of nodes) {
        if (node.id === value) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    setSelectedNode(findNode(treeNodes));
  }, [value, treeNodes]);

  const selectedText = selectedNode ? selectedNode.name : "Ангилал сонгоогүй";

  function handleCategorySelect(node: CatNode) {
    console.log('Category selected in picker:', node);
    onChange(node.id, node.name, node.name);
    setSelectedNode(node);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          className="h-10 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm disabled:opacity-60"
          disabled={disabled}
        >
          Ангилал сонгох
        </button>
        <div className="text-sm text-[#333] truncate max-w-[60ch]">
          <span className="opacity-70">Одоогийн:</span>{" "}
          <b title={selectedText}>{selectedText}</b>
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(92vw,640px)] bg-white border border-[#E6E6E6] rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Ангилал сонгох</h3>
            <button
              className="px-3 h-9 rounded-md bg-white border border-[#E6E6E6] text-sm hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              Хаах
            </button>
          </div>
          
          <CategoryTree
            nodes={treeNodes}
            onSelect={handleCategorySelect}
            selectedId={value}
          />
        </div>
      )}
    </div>
  );
}

/* ========================== ProductCreateForm ========================== */
export default function ProductCreateForm({
  cats,
  branches,
  tenantId,
  qty = 9999, // Борлуулалтын үед үлдэгдэл
}: {
  cats?: Category[];
  branches: string[];
  tenantId?: string;
  qty?: number; // Үлдэгдэл
}) {
  const router = useRouter();
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  // Role-based access control
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const [catsState, setCatsState] = useState<Category[]>(cats ?? []);
  const [loadingCats, setLoadingCats] = useState<boolean>(false);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | undefined>(
    tenantId
  );

  // ✅ Салбаруудыг server-оос авч ID/нэрийн map үүсгэнэ
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);

  // Initialize data on mount
  useEffect(() => {
    let alive = true;

    const initializeData = async () => {
      try {
        // Check user role and permissions first
        const role = await getUserRole();
        if (alive) {
          setUserRole(role);
          setCheckingPermission(false);
        }

        const token = await getAccessToken();
        if (!token || !alive) return;

        // 1. Get tenant ID if not provided
        if (!tenantId) {
          try {
            const decoded: any = jwtDecode(token);
            const extractedTenantId = decoded?.app_metadata?.tenants?.[0];
            if (extractedTenantId && alive) {
              setResolvedTenantId(String(extractedTenantId));
            }
          } catch (error) {
            console.error("Failed to extract tenant ID:", error);
          }
        }

        // 2. Load categories if not provided
        if (!cats || cats.length === 0) {
          setLoadingCats(true);
          try {
            const raw = await getCategories(token);
            if (alive) {
              const arr = toArray(raw) as Category[];
              setCatsState(arr);
            }
          } catch (error) {
            console.error("Failed to load categories:", error);
            if (alive) setCatsState([]);
          } finally {
            if (alive) setLoadingCats(false);
          }
        } else {
          setCatsState(cats);
        }

        // 3. Load stores
        setLoadingStores(true);
        try {
          const storeData = await listStores(token);
          if (alive) {
            const storeArray = toArray(storeData) as StoreRow[];
            setStores(storeArray);
          }
        } catch (error) {
          console.error("Failed to load stores:", error);
          if (alive) setStores([]);
        } finally {
          if (alive) setLoadingStores(false);
        }
      } catch (error) {
        console.error("Failed to initialize form data:", error);
        if (alive) {
          setCatsState([]);
          setStores([]);
          setLoadingCats(false);
          setLoadingStores(false);
        }
      }
    };

    initializeData();

    return () => {
      alive = false;
    };
  }, []); // Remove dependencies to avoid re-running

  // Update categories when prop changes
  useEffect(() => {
    if (cats && cats.length > 0) {
      setCatsState(cats);
      setLoadingCats(false);
    }
  }, [cats]);

  // Update tenant ID when prop changes
  useEffect(() => {
    if (tenantId) {
      setResolvedTenantId(tenantId);
    }
  }, [tenantId]);

  type NewProduct = {
    name: string;
    sku?: string;
    category_id?: string | null;
    price?: number;
    cost?: number;
    description?: string;
    images: string[]; // preview blobs (UI only)
    imageFiles: File[]; // real files to upload
    variants: Variant[];
    initialStocks: Record<string, number>; // storeId -> qty (legacy, for simple products)
    variantStocks: Record<string, Record<string, number>>; // variantId -> storeId -> qty
  };

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedPathLabel, setSelectedPathLabel] =
    useState<string>("Ангилал байхгүй");

  // Create initial stocks based on actual store IDs
  const createInitialStocks = (stores: StoreRow[]) => {
    return Object.fromEntries(stores.map((store) => [store.id, 0]));
  };

  const [newProd, setNewProd] = useState<NewProduct>({
    name: "",
    sku: "",
    category_id: null,
    price: undefined,
    cost: undefined,
    description: "",
    images: [],
    imageFiles: [],
    variants: [],
    initialStocks: {}, // Will be populated when stores load
    variantStocks: {}, // variantId -> storeId -> qty
  });

  // Update initial stocks when stores are loaded
  useEffect(() => {
    if (stores.length > 0) {
      setNewProd((prev) => ({
        ...prev,
        initialStocks: {
          ...createInitialStocks(stores),
          ...prev.initialStocks, // Keep any existing values
        },
      }));
    }
  }, [stores]);

  function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;

    const fileArr = Array.from(files);
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    const maxSizeMB = 8;

    const urls: string[] = [];
    const picked: File[] = [];
    for (const f of fileArr) {
      if (!accepted.includes(f.type)) {
        alert(`Дэмжигдэхгүй төрөл: ${f.name}`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        alert(`Хэт том файл (${maxSizeMB}MB+): ${f.name}`);
        continue;
      }
      urls.push(URL.createObjectURL(f));
      picked.push(f);
    }
    if (!picked.length) return;

    setNewProd((p) => ({
      ...p,
      images: [...p.images, ...urls],
      imageFiles: [...p.imageFiles, ...picked],
    }));

    if (imgInputRef.current) imgInputRef.current.value = "";
  }

  function removeImage(i: number) {
    setNewProd((p) => {
      const url = p.images[i];
      if (url && (url.startsWith("blob:") || url.startsWith("data:"))) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      return {
        ...p,
        images: p.images.filter((_, idx) => idx !== i),
        imageFiles: p.imageFiles.filter((_, idx) => idx !== i),
      };
    });
  }

  function addVariant() {
    const newVariantId = rid();
    setNewProd((p) => {
      // Initialize variant stocks for all stores
      const newVariantStocks = { ...p.variantStocks };
      newVariantStocks[newVariantId] = Object.fromEntries(
        stores.map(store => [store.id, 0])
      );
      
      return {
        ...p,
        variants: [
          ...p.variants,
          { id: newVariantId, color: "", size: "", sku: "", price: undefined },
        ],
        variantStocks: newVariantStocks,
      };
    });
  }
  function removeVariant(id: string) {
    setNewProd((p) => {
      // Remove variant stocks
      const newVariantStocks = { ...p.variantStocks };
      delete newVariantStocks[id];
      
      return {
        ...p,
        variants: p.variants.filter((v) => v.id !== id),
        variantStocks: newVariantStocks,
      };
    });
  }
  function updateVariant(id: string, patch: Partial<Variant>) {
    setNewProd((p) => ({
      ...p,
      variants: p.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  // ✅ Helper: product create response-аас variant ID-уудыг уян хатан сугалж авах
  function extractVariantIds(res: any): string[] {
    const pools = [
      toArray(res?.variants),
      toArray(res?.data?.variants),
      toArray(res?.product?.variants),
      toArray(res?.result?.variants),
    ];
    const flat = pools.flat();
    const ids = flat
      .map((v: any) => String(v?.id ?? v?.variant_id ?? ""))
      .filter(Boolean);
    // fallback: variants байхгүй бол ганцхан variant үүсгэсэн гэж үзэх боломжгүй тул хоосон буцаая
    return Array.from(new Set(ids));
  }

  async function handleCreateSubmit() {
    if (!newProd.name.trim()) {
      alert("Барааны нэрийг оруулна уу.");
      return;
    }

    const basePrice = newProd.price;
    if (basePrice == null || Number.isNaN(basePrice) || basePrice <= 0) {
      alert("Зөв зарах үнийг оруулна уу.");
      return;
    }

    if (!selectedCatId) {
      alert("Ангиллаа сонгоно уу.");
      return;
    }

    // Validate and clean variants
    const cleanVariants = newProd.variants
      .map((v) => ({
        ...v,
        price: v.price && v.price > 0 ? v.price : basePrice,
        color: v.color?.trim() || "",
        size: v.size?.trim() || "",
        sku: v.sku?.trim() || "",
      }))
      .filter((v) => v.color || v.size || v.sku); // Keep variants that have at least one attribute

    // SKU validation - check for duplicates and conflicts
    const allSkus = cleanVariants.map((v) => v.sku).filter(Boolean); // Remove empty SKUs

    if (allSkus.length > 0) {
      const uniqueSkus = new Set(allSkus);
      if (uniqueSkus.size !== allSkus.length) {
        alert(
          "SKU давхардаж байна. Вариант бүрийн SKU-г давхардахгүй оруулна уу."
        );
        return;
      }
    }

    // Create variant inputs for backend API matching your expected structure
    const variantInputs = (
      cleanVariants.length
        ? cleanVariants
        : [{ id: rid(), price: basePrice, color: "", size: "", sku: "" }]
    ).map((v, index) => {
      const hasVariantAttrs = "color" in v && "size" in v && "sku" in v;
      const color = hasVariantAttrs ? v.color : "";
      const size = hasVariantAttrs ? v.size : "";
      const sku = hasVariantAttrs ? v.sku : "";

      const variantName =
        [color, size].filter(Boolean).join(" / ") || newProd.name;
      const variantSku =
        sku || `${newProd.name.substring(0, 3).toUpperCase()}-${index + 1}`;

      // Match backend expectations: optional fields, proper typing
      return {
        name: variantName || null,
        sku: variantSku || null,
        price: Number(v.price || basePrice) || 0,
        cost: Number(newProd.cost || 0) || null,
        attrs: {
          ...(color ? { color } : {}),
          ...(size ? { size } : {}),
        },
      };
    });

    // ⬇️ Signed URL бус, path хадгална
    let uploadedPaths: string[] = [];
    if (newProd.imageFiles.length > 0) {
      try {
        const uploadResults = await Promise.all(
          newProd.imageFiles.map((file) =>
            uploadProductImageOnly(file, { prefix: "product_img" })
          )
        );
        uploadedPaths = uploadResults.map((res) => res.path);
      } catch (e) {
        console.error(e);
        alert("Зураг upload хийхэд алдаа гарлаа.");
        return;
      }
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");

      // Match backend API expectations - POST endpoint structure
      const payload: any = {
        name: newProd.name,
        description: newProd.description || null,
        category_id: selectedCatId || null,
        img: uploadedPaths[0] || null, // Single image path for backend
        variants: variantInputs || [], // Variants array matching backend structure
      };

      // 1) Барааг үүсгэнэ
      const res = await createProduct(token, payload);
      const newId =
        res?.id ?? res?.data?.id ?? res?.product?.id ?? res?.result?.id;
      if (!newId) {
        console.warn("createProduct response:", res);
        if (res?.error) {
          alert(`Бараа үүсгэхэд алдаа гарлаа: ${res.error}`);
        } else {
          alert("Шинэ барааны ID олдсонгүй.");
        }
        throw new Error("Шинэ барааны ID олдсонгүй.");
      }

      // 2) Вариант ID-уудыг сугална
      const variantIds = extractVariantIds(res);
      if (!variantIds.length) {
        console.warn("No variant ids found in response to seed stock.", res);
        alert(
          "Шинэ бараа үүссэн, гэхдээ variant ID олдоогүй тул анхны үлдэгдэл оруулж чадсангүй."
        );
        router.push(`/productdetail/${newId}`);
        return;
      }

      // 3) Анхны үлдэгдлийг SEED хийх
      const seedPromises: Promise<any>[] = [];

      if (newProd.variants.length > 0) {
        // Use variant-specific stocks
        Object.entries(newProd.variantStocks).forEach(([frontendVariantId, storeStocks]) => {
          // Find matching backend variant ID
          const matchingVariantIndex = newProd.variants.findIndex(v => v.id === frontendVariantId);
          if (matchingVariantIndex === -1 || matchingVariantIndex >= variantIds.length) {
            console.warn(`Could not match frontend variant ${frontendVariantId} with backend variant`);
            return;
          }
          
          const backendVariantId = variantIds[matchingVariantIndex];
          
          Object.entries(storeStocks)
            .filter(([storeId, qty]) => Number(qty) > 0)
            .forEach(([storeId, qty]) => {
              seedPromises.push(
                productAddToInventory(token, {
                  store_id: storeId,
                  variant_id: backendVariantId,
                  delta: Number(qty),
                  reason: "INITIAL",
                  note: `Product creation - variant initial stock`,
                }).catch((error) => {
                  console.error(
                    `Failed to seed inventory for store ${storeId}, variant ${backendVariantId}:`,
                    error
                  );
                  return { error, storeId, variantId: backendVariantId };
                })
              );
            });
        });
      } else {
        // Fallback: use simple initialStocks for products without variants
        Object.entries(newProd.initialStocks)
          .filter(([storeId, qty]) => Number(qty) > 0)
          .forEach(([storeId, qty]) => {
            if (variantIds.length > 0) {
              seedPromises.push(
                productAddToInventory(token, {
                  store_id: storeId,
                  variant_id: variantIds[0], // Use first (and likely only) variant
                  delta: Number(qty),
                  reason: "INITIAL",
                  note: "Product creation - initial stock",
                }).catch((error) => {
                  console.error(
                    `Failed to seed inventory for store ${storeId}, variant ${variantIds[0]}:`,
                    error
                  );
                  return { error, storeId, variantId: variantIds[0] };
                })
              );
            }
          });
      }

      // Execute all seeding operations
      if (seedPromises.length > 0) {
        const results = await Promise.allSettled(seedPromises);
        const successful = results.filter(
          (r) => r.status === "fulfilled" && !r.value?.error
        ).length;
        const failed = results.length - successful;

        if (failed > 0) {
          console.warn(
            `${failed} inventory seeding operations failed:`,
            results
          );
          alert(
            `Бараа амжилттай үүсэв! Анхны үлдэгдэл: ${successful} амжилттай, ${failed} алдаатай.`
          );
        } else {
          alert("Шинэ бараа болон анхны үлдэгдэл амжилттай бүртгэгдлээ!");
        }
      } else {
        alert("Шинэ бараа үүсэв! (Анхны үлдэгдэл тохируулаагүй байна)");
      }

      // 5) Дундаас буцах/шинэ дэлгэрэнгүй рүү очих
      router.push(`/productdetail/${newId}`);
    } catch (error) {
      console.error(error);
      alert("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }



  if (loading) return <Loading open label="Уншиж байна…" />;

  // Check if user has permission to create products
  if (checkingPermission) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loading open={true} />
        <span className="ml-2">Эрх шалгаж байна...</span>
      </div>
    );
  }

  if (!canAccessFeature(userRole as any, "createProduct")) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Хандалт хориглогдсон
        </h2>
        <p className="text-gray-600 mb-4">
          Таны эрх ({userRole}) бараа нэмэх боломжийг олгохгүй байна.
        </p>
        <p className="text-sm text-gray-500">
          Бараа нэмэхийн тулд Admin эсвэл Manager эрх шаардлагатай.
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
        >
          Буцах
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Барааны нэр *</label>
          <input
            className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
            value={newProd.name}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="Барааны нэрээ оруулна уу."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Ангилал *</label>
          <CategoryPicker
            categories={catsState}
            value={selectedCatId}
            tenantId={resolvedTenantId}
            disabled={loadingCats}
            onChange={(id, pathLabel) => {
              setSelectedCatId(id);
              setSelectedPathLabel(pathLabel);
              setNewProd((p) => ({ ...p, category_id: id }));
            }}
          />
          <div className="text-xs text-[#777]">
            {loadingCats ? (
              "Ангилал ачаалж байна…"
            ) : (
              <>
                Сонгосон: <b>{selectedPathLabel}</b>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Зарах үнэ *</label>
          <input
            type="number"
            className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
            value={newProd.price ?? ""}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, price: Number(e.target.value || 0) }))
            }
            placeholder="Барааны зарах үнэ"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Тайлбар</label>
        <textarea
          className="min-h-24 w-full rounded-md border border-[#E6E6E6] px-3 py-2"
          value={newProd.description}
          onChange={(e) =>
            setNewProd((p) => ({ ...p, description: e.target.value }))
          }
          placeholder="Материал, онцлог, арчилгаа..."
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Зураг</span>
          <button
            onClick={() => imgInputRef.current?.click()}
            className="h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm"
          >
            Зураг нэмэх
          </button>
          <input
            ref={imgInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>
        {newProd.images.length ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {newProd.images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative aspect-square">
                <Image
                  src={src}
                  alt={`Барааны зураг ${i + 1}`}
                  fill
                  sizes="(min-width:768px) 14vw, 30vw"
                  className="object-cover rounded-md border"
                  unoptimized={
                    src.startsWith("blob:") || src.startsWith("data:")
                  }
                  priority={i === 0}
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 text-xs bg-white/80 rounded px-1 border"
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#777]">Одоогоор зураг алга.</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Варианташ (сонголттой)</span>
          <button
            type="button"
            onClick={addVariant}
            className="h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm hover:bg-gray-50"
          >
            + Вариант нэмэх
          </button>
        </div>

        {newProd.variants.length > 0 && (
          <div className="space-y-3">
            {newProd.variants.map((v, index) => (
              <div
                key={v.id}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border rounded-lg p-3 bg-gray-50"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    Өнгө
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 p-0 border border-[#E6E6E6] rounded-md cursor-pointer"
                      value={v.color || "#E6E6E6"}
                      onChange={(e) =>
                        updateVariant(v.id, { color: e.target.value })
                      }
                    />
                    <input
                      placeholder="Өнгө"
                      className="h-9 flex-1 rounded-md border border-[#E6E6E6] px-2 text-sm"
                      value={v.color || ""}
                      onChange={(e) =>
                        updateVariant(v.id, { color: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    Хэмжээ
                  </label>
                  <input
                    placeholder="Хэмжээ (S, M, L...)"
                    className="h-9 w-full rounded-md border border-[#E6E6E6] px-2 text-sm"
                    value={v.size ?? ""}
                    onChange={(e) =>
                      updateVariant(v.id, { size: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    SKU код
                  </label>
                  <input
                    placeholder="SKU (сонголттой)"
                    className="h-9 w-full rounded-md border border-[#E6E6E6] px-2 text-sm"
                    value={v.sku ?? ""}
                    onChange={(e) =>
                      updateVariant(v.id, { sku: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">
                    Үнэ
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Сонгодог үнэ ашиглана"
                    className="h-9 w-full rounded-md border border-[#E6E6E6] px-2 text-sm"
                    value={v.price ?? ""}
                    onChange={(e) =>
                      updateVariant(v.id, {
                        price: Number(e.target.value || 0),
                      })
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="h-9 px-3 rounded-md border border-red-200 text-red-600 text-sm bg-white hover:bg-red-50"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500">
          {newProd.variants.length === 0
            ? "Өнгө, хэмжээ эсвэл бусад онцлогоороо ялгаатай бараа байвал вариант нэмнэ үү."
            : `${newProd.variants.length} вариант нэмэгдсэн. Хоосон талбаруудтай варианташ хасагдана.`}
        </div>
      </div>

      {/* Variant-specific stock management */}
      {newProd.variants.length > 0 && stores.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-medium">Вариант тус бүрийн анхны үлдэгдэл</div>
          
          {newProd.variants.map((variant, variantIndex) => {
            const variantLabel = [variant.color, variant.size].filter(Boolean).join(" / ") || 
                               `Вариант ${variantIndex + 1}`;
            
            return (
              <div key={variant.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {variant.color && (
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: variant.color }}
                      />
                    )}
                    <span className="font-medium text-gray-700">{variantLabel}</span>
                  </div>
                  {variant.price && (
                    <span className="text-sm text-green-600">₮{variant.price.toLocaleString()}</span>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center gap-2">
                      <span className="text-sm w-32 truncate" title={store.name}>
                        {store.name}
                      </span>
                      <input
                        type="number"
                        min="0"
                        className="h-9 w-full rounded-md border border-[#E6E6E6] px-2"
                        value={newProd.variantStocks[variant.id]?.[store.id] ?? 0}
                        onChange={(e) => {
                          const quantity = Math.max(0, Number(e.target.value || 0));
                          setNewProd((p) => ({
                            ...p,
                            variantStocks: {
                              ...p.variantStocks,
                              [variant.id]: {
                                ...p.variantStocks[variant.id],
                                [store.id]: quantity,
                              },
                            },
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          <div className="text-xs text-gray-500">
            Вариант тус бүр дээр салбар бүрийн анхны үлдэгдлийг тусад нь тохируулна уу.
          </div>
        </div>
      )}

      {stores.length > 0 && newProd.variants.length === 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">
            Анхны үлдэгдэл салбар бүрээр
          </span>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {stores.map((store) => (
              <div key={store.id} className="flex items-center gap-2">
                <span className="text-sm w-32 truncate" title={store.name}>
                  {store.name}
                </span>
                <input
                  type="number"
                  min="0"
                  className="h-9 w-full rounded-md border border-[#E6E6E6] px-2"
                  value={newProd.initialStocks[store.id] ?? 0}
                  onChange={(e) => {
                    const quantity = Math.max(0, Number(e.target.value || 0));
                    setNewProd((p) => ({
                      ...p,
                      initialStocks: {
                        ...p.initialStocks,
                        [store.id]: quantity,
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
          {loadingStores && (
            <div className="text-xs text-amber-600">
              Салбарууд ачаалж байна...
            </div>
          )}
          <div className="text-xs text-gray-500">
            Энэ тоо хэмжээ нь бараа үүсгэх үед автоматаар нөөцөнд нэмэгдэнэ.
          </div>
        </div>
      )}



      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setSelectedCatId(null);
            setSelectedPathLabel("Ангилал байхгүй");
            newProd.images.forEach((u) => {
              if (u.startsWith("blob:") || u.startsWith("data:")) {
                try {
                  URL.revokeObjectURL(u);
                } catch {}
              }
            });
            setNewProd((p) => ({
              ...p,
              name: "",
              sku: "",
              description: "",
              price: undefined,
              cost: undefined,
              category_id: null,
              images: [],
              imageFiles: [],
              variants: [],
              initialStocks: createInitialStocks(stores),
              variantStocks: {},
            }));
            if (imgInputRef.current) imgInputRef.current.value = "";
          }}
          className="h-10 px-4 rounded-lg border border-[#E6E6E6] bg-white"
        >
          Цэвэрлэх
        </button>
        <button
          onClick={handleCreateSubmit}
          className="h-10 px-5 rounded-lg bg-[#5AA6FF] text-white"
        >
          Хадгалах
        </button>
      </div>
    </div>
  );
}
