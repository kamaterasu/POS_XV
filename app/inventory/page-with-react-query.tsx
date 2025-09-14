"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ProductCreateForm, {
  type Category,
} from "@/components/inventoryComponents/ProductCreateForm";
import { getImageShowUrl } from "@/lib/product/productImages";

// Import React Query hooks
import { 
  useProducts,
  useProductsByStore,
  useProductsByCategory,
  useInventoryGlobal,
  useCategories,
  useStores,
  useStore,
  useCreateCategory,
  useCreateSubcategory
} from "@/lib/hooks";

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

const normalizeTree = (tree: any[]): Category[] => {
  if (!Array.isArray(tree)) return [];
  return tree.map((node) => ({
    id: String(node.id || ""),
    name: node.name || "",
    parent_id: node.parent_id || null,
    children: normalizeTree(node.children || []),
  }));
};

const mapStore = (s: any): StoreRow | null => {
  if (!s?.id) return null;
  return { id: String(s.id), name: s.name || `Store ${s.id}` };
};

async function resolveImageUrl(imgPath?: string): Promise<string | undefined> {
  if (!imgPath) return undefined;
  return await getImageShowUrl(imgPath);
}

// ---------- Main Component ----------
export default function InventoryPageWithReactQuery() {
  const router = useRouter();

  // State
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [storeId, setStoreId] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [isFormVisible, setFormVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // React Query hooks
  const {
    data: storesData,
    isLoading: loadingStores,
    error: storesError
  } = useStore();

  const {
    data: categoriesData,
    isLoading: loadingCategories,
    error: categoriesError
  } = useCategories();

  // Products data based on current filters
  const {
    data: productsData,
    isLoading: loadingProducts,
    error: productsError,
    refetch: refetchProducts
  } = selectedCat?.id 
    ? useProductsByCategory(selectedCat.id)
    : storeId === "all" 
      ? useInventoryGlobal()
      : useProductsByStore(storeId);

  // Mutations
  const createCategoryMutation = useCreateCategory();
  const createSubcategoryMutation = useCreateSubcategory();

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

  // Process data
  const stores = useMemo(() => {
    if (!storesData) return [{ id: "all", name: "Бүгд" }];
    const storeArray = toArray(storesData, ["stores", "data", "items"])
      .map(mapStore)
      .filter(Boolean) as StoreRow[];
    return [{ id: "all", name: "Бүгд" }, ...storeArray];
  }, [storesData]);

  const categories = useMemo(() => {
    if (!categoriesData) return [];
    const treeRaw = Array.isArray(categoriesData?.tree)
      ? categoriesData.tree
      : toArray(categoriesData, ["categories", "data", "items"]);
    return normalizeTree(treeRaw) as Category[];
  }, [categoriesData]);

  const products = useMemo(() => {
    if (!productsData) return [];
    
    let mapped: Product[];
    if (selectedCat?.id) {
      // Category-based products
      mapped = toArray(productsData, ["items", "products", "data"])
        .map(mapCategoryProduct)
        .filter(Boolean) as Product[];
    } else {
      // Inventory-based products
      mapped = toArray(productsData, ["items", "data"])
        .map(mapInventoryItem)
        .filter(Boolean) as Product[];
    }

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      return mapped.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.code?.toLowerCase().includes(search) ||
        p.variantName?.toLowerCase().includes(search)
      );
    }

    return mapped;
  }, [productsData, selectedCat, searchText]);

  // Handle category creation
  const handleCreateCategory = async (name: string) => {
    try {
      await createCategoryMutation.mutateAsync({ name });
      addToast("success", "Амжилттай", "Ангилал үүсгэгдлээ");
    } catch (error) {
      console.error("Category creation failed:", error);
      addToast("error", "Алдаа", "Ангилал үүсгэхэд алдаа гарлаа");
    }
  };

  const handleCreateSubcategory = async (parentId: string, name: string) => {
    try {
      await createSubcategoryMutation.mutateAsync({ parent_id: parentId, name });
      addToast("success", "Амжилттай", "Дэд ангилал үүсгэгдлээ");
    } catch (error) {
      console.error("Subcategory creation failed:", error);
      addToast("error", "Алдаа", "Дэд ангилал үүсгэхэд алдаа гарлаа");
    }
  };

  // Loading states
  if (loadingStores || loadingCategories) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
        </div>
      </div>
    );
  }

  // Error states
  if (storesError || categoriesError) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Алдаа гарлаа!</strong>
          <span className="block sm:inline"> {storesError?.message || categoriesError?.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm p-4 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-500 text-white"
                : toast.type === "error"
                ? "bg-red-500 text-white"
                : toast.type === "warning"
                ? "bg-yellow-500 text-black"
                : "bg-blue-500 text-white"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold">{toast.title}</h4>
                <p className="text-sm">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 text-lg leading-none opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Агуулах удирдлага</h1>
        <button
          onClick={() => setFormVisible(!isFormVisible)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          {isFormVisible ? "Хаах" : "Шинэ бараа нэмэх"}
        </button>
      </div>

      {/* Product Creation Form */}
      {isFormVisible && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <ProductCreateForm
            cats={categories}
            branches={stores.map(s => s.id)}
            tenantId={undefined}
            qty={0}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Store selector */}
        <div>
          <label className="block text-sm font-medium mb-2">Салбар</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category selector */}
        <div>
          <label className="block text-sm font-medium mb-2">Ангилал</label>
          <select
            value={selectedCat?.id || ""}
            onChange={(e) => {
              const cat = categories.find((c) => c.id === e.target.value);
              setSelectedCat(cat || null);
            }}
            className="w-full p-2 border rounded-lg"
          >
            <option value="">Бүгд</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium mb-2">Хайх</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Бараа хайх..."
            className="w-full p-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Products grid */}
      {loadingProducts ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-48 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : productsError ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Алдаа гарлаа!</strong>
          <span className="block sm:inline"> {productsError.message}</span>
          <button
            onClick={() => refetchProducts()}
            className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
          >
            Дахин оролдох
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/productdetail/${product.id}`)}
            >
              {/* Product image */}
              <div className="w-full h-48 mb-3 bg-gray-100 rounded overflow-hidden">
                {product.imgUrl ? (
                  <Image
                    src={product.imgUrl}
                    alt={product.name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Зураг байхгүй
                  </div>
                )}
              </div>

              {/* Product info */}
              <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                {product.name}
              </h3>
              
              {product.variantName && (
                <p className="text-sm text-gray-600 mb-1">{product.variantName}</p>
              )}
              
              {product.code && (
                <p className="text-sm text-gray-500 mb-1">SKU: {product.code}</p>
              )}
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-lg font-bold text-green-600">
                  ₮{product.price?.toLocaleString() || "0"}
                </span>
                <span className={`text-sm px-2 py-1 rounded ${
                  (product.qty || 0) > 0 
                    ? "bg-green-100 text-green-800" 
                    : "bg-red-100 text-red-800"
                }`}>
                  {product.qty || 0} ш
                </span>
              </div>
            </div>
          ))}
          
          {products.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              Бараа олдсонгүй
            </div>
          )}
        </div>
      )}
    </div>
  );
}