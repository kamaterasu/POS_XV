import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/Loading";
import { getUserRole } from "@/lib/helper/getUserRole";
import { getTenantId } from "@/lib/helper/getTenantId";
import { supabase } from "@/lib/supabaseClient";
import { getCategories } from "@/lib/category/categoryApi";
import { createProduct } from "@/lib/product/productApi";
import { productAddToInventory } from "@/lib/inventory/inventoryApi";

// Types
interface NewProduct {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  price: number | undefined;
  cost: number | undefined;
  category_id: string | null;
  images: string[];
  imageFiles: File[];
  variants: ProductVariant[];
  initialStocks: StoreStock[];
}

interface ProductVariant {
  name: string;
  price: number;
  cost?: number;
  barcode?: string;
  sku?: string;
}

interface StoreStock {
  storeId: string;
  storeName: string;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  path?: string;
}

// Tree structure types
type CatNode = {
  id: string;
  name: string;
  parent_id: string | null;
  children?: CatNode[];
};

interface StoreRow {
  id: string;
  name: string;
}

// ---------- Utils ----------
const toArray = (v: any, keys: string[] = []) => {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "object") return [];
  for (const k of keys) if (Array.isArray((v as any)[k])) return (v as any)[k];
  const vals = Object.values(v);
  return Array.isArray(vals) ? vals : [];
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

// Convert tree structure to flat array with parent_id relationships
function flattenTreeToCategories(nodes: CatNode[]): Category[] {
  const result: Category[] = [];

  function traverse(nodeList: CatNode[]) {
    for (const node of nodeList) {
      result.push({
        id: node.id,
        name: node.name,
        parent_id: node.parent_id,
      });
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

// Convert flat categories to tree structure for display
function buildCategoryTree(categories: Category[]): TreeCategory[] {
  const categoryMap = new Map<
    string,
    TreeCategory & { children: TreeCategory[] }
  >();

  // Create all nodes first
  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      children: [],
    });
  });

  const rootCategories: TreeCategory[] = [];

  // Build the tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id);
    if (!node) return;

    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      // Root category (no parent)
      rootCategories.push(node);
    }
  });

  return rootCategories;
} // Tree category type for hierarchical display
type TreeCategory = {
  id: string;
  name: string;
  children?: TreeCategory[];
};

// CategoryNode Component - Individual tree node with expand/collapse
function CategoryNode({
  node,
  onSelect,
  selectedId,
}: {
  node: TreeCategory;
  onSelect: (n: TreeCategory) => void;
  selectedId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  const selected = selectedId === node?.id;

  return (
    <li>
      <div className="flex items-center gap-2 text-sm py-1.5">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex w-6 h-6 justify-center items-center select-none text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${
                open ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <div className="w-6 h-6 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            onSelect(node);
          }}
          className={`flex-1 text-left px-2 py-1.5 rounded-lg transition-all duration-200 text-sm ${
            selected
              ? "bg-blue-100 text-blue-700 font-medium shadow-sm border border-blue-200"
              : "hover:bg-white hover:text-blue-600 text-gray-700"
          }`}
          title="Энэ ангиллаар сонгох"
        >
          <span className="flex items-center gap-2">
            {selected && (
              <svg
                className="w-3 h-3 text-blue-600"
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
            )}
            {node?.name}
          </span>
        </button>
      </div>

      {hasChildren && open && (
        <ul className="pl-4 ml-3 border-l-2 border-blue-100 space-y-0.5 mt-1">
          {node.children!.map((child: TreeCategory) => (
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

// CategoryTree Component - Renders the tree structure
function CategoryTree({
  nodes,
  onSelect,
  selectedId,
}: {
  nodes: TreeCategory[];
  onSelect: (n: TreeCategory) => void;
  selectedId?: string | null;
}) {
  if (!nodes?.length) return null;
  return (
    <ul className="space-y-1">
      {nodes.map((n: TreeCategory) => (
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

// CategorySection Component - Styled category selection matching AddItemModal
function CategorySection({
  categories,
  selectedCat,
  onSelectCategory,
}: {
  categories: TreeCategory[];
  selectedCat: { id: string; name: string } | null;
  onSelectCategory: (cat: { id: string; name: string } | null) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14-7l-7 7 7 7M5 4l7 7-7 7"
              />
            </svg>
            Ангилал
          </span>
          {selectedCat && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {selectedCat.name}
            </span>
          )}
        </div>
        {selectedCat && (
          <button
            onClick={() => onSelectCategory(null)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors duration-200"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Бүгдийг харах
          </button>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 shadow-inner">
        {categories.length === 0 ? (
          <div className="flex items-center justify-center p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-sm text-gray-500">
                Ангилал ачаалж байна...
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <button
              onClick={() => onSelectCategory(null)}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg mb-2 transition-all duration-200 flex items-center gap-2 ${
                !selectedCat
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-gray-700 hover:bg-white hover:text-blue-600 bg-white/50"
              }`}
            >
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14-7l-7 7 7 7M5 4l7 7-7 7"
                />
              </svg>
              Бүгд
            </button>
            <CategoryTree
              nodes={categories}
              onSelect={(cat) =>
                onSelectCategory({ id: cat.id, name: cat.name })
              }
              selectedId={selectedCat?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================== ProductCreateForm ========================== */
export default function ProductCreateForm({
  cats,
  branches,
  tenantId,
  qty = 9999,
  onSuccess,
  currentStoreId,
}: {
  cats?: Category[];
  branches: string[];
  tenantId?: string;
  qty?: number;
  onSuccess?: () => void;
  currentStoreId?: string;
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

  // Stores state
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);

  // Selected category
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [treeCategories, setTreeCategories] = useState<TreeCategory[]>([]);

  const createInitialStocks = (storeList: StoreRow[]): StoreStock[] => {
    return storeList.map((store) => ({
      storeId: store.id,
      storeName: store.name,
      quantity: 10, // Default to 10 instead of 0 to ensure products show up with inventory
    }));
  };

  const [newProd, setNewProd] = useState<NewProduct>({
    name: "",
    sku: "",
    barcode: "",
    description: "",
    price: undefined,
    cost: undefined,
    category_id: null,
    images: [],
    imageFiles: [],
    variants: [],
    initialStocks: [],
  });

  // Permission check
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const role = await getUserRole();
        setUserRole(role);

        if (
          !role ||
          (role !== "Admin" && role !== "Manager" && role !== "OWNER")
        ) {
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Permission check failed:", error);
        router.push("/dashboard");
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [router]);

  // Load tenant ID
  useEffect(() => {
    const loadTenantId = async () => {
      try {
        const tid = await getTenantId();
        setResolvedTenantId(tid || undefined);
      } catch (error) {
        console.error("Failed to load tenant ID:", error);
      }
    };

    if (!resolvedTenantId) {
      loadTenantId();
    }
  }, [resolvedTenantId]);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      if (!resolvedTenantId || treeCategories.length > 0) return;

      setLoadingCats(true);
      try {
        // Get authentication token
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        // Use the proper getCategories API function (matching AddItemModal approach)
        const raw = await getCategories(session.access_token);
        console.log("Categories API response:", raw); // Debug log

        // Normalize tree structure like AddItemModal
        const normalizeTreeForDisplay = (nodes: any[]): TreeCategory[] => {
          if (!Array.isArray(nodes)) return [];
          return nodes.map((node) => ({
            id: String(node.id),
            name: String(node.name || node.title || "Unknown"),
            children: node.children
              ? normalizeTreeForDisplay(node.children)
              : undefined,
          }));
        };

        const tree = Array.isArray(raw?.tree) ? raw.tree : [];
        console.log("Tree from API:", tree); // Debug log
        const treeCategories = normalizeTreeForDisplay(tree);
        console.log("Normalized tree categories:", treeCategories); // Debug log
        setTreeCategories(treeCategories);

        // Also keep flat categories for backward compatibility
        const flatCategories = flattenTreeToCategories(normalizeTree(tree));
        setCatsState(flatCategories);
      } catch (error) {
        console.error("Failed to load categories:", error);
        // Fallback to direct Supabase query if edge function fails
        try {
          const { data, error: fallbackError } = await supabase
            .from("categories")
            .select("id, name, parent_id")
            .eq("tenant_id", resolvedTenantId)
            .order("name");

          if (fallbackError) throw fallbackError;

          // Convert fallback data to tree structure too
          const fallbackCategories = data || [];
          setCatsState(fallbackCategories);
          const fallbackTree = buildCategoryTree(fallbackCategories);
          setTreeCategories(fallbackTree);
          console.log("Fallback categories loaded:", fallbackCategories.length); // Debug log
        } catch (fallbackErr) {
          console.error("Fallback category loading also failed:", fallbackErr);
        }
      } finally {
        setLoadingCats(false);
      }
    };

    loadCategories();
  }, [resolvedTenantId, treeCategories.length]);

  // Load stores
  useEffect(() => {
    const loadStores = async () => {
      if (!resolvedTenantId) return;

      setLoadingStores(true);
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", resolvedTenantId);

        if (error) throw error;

        const storeList = data || [];
        setStores(storeList);
        setNewProd((prev) => ({
          ...prev,
          initialStocks: createInitialStocks(storeList),
        }));
      } catch (error) {
        console.error("Failed to load stores:", error);
      } finally {
        setLoadingStores(false);
      }
    };

    loadStores();
  }, [resolvedTenantId]);

  // Update category_id when selectedCatId changes
  useEffect(() => {
    setNewProd((prev) => ({ ...prev, category_id: selectedCatId }));
  }, [selectedCatId]);

  // Image handling
  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    const remainingSlots = 5 - newProd.images.length;
    const filesToProcess = files.slice(0, remainingSlots);

    const newImageUrls: string[] = [];
    const newImageFiles: File[] = [];

    for (const file of filesToProcess) {
      const url = URL.createObjectURL(file);
      newImageUrls.push(url);
      newImageFiles.push(file);
    }

    setNewProd((prev) => ({
      ...prev,
      images: [...prev.images, ...newImageUrls],
      imageFiles: [...prev.imageFiles, ...newImageFiles],
    }));
  };

  const removeImage = (index: number) => {
    const urlToRevoke = newProd.images[index];
    if (urlToRevoke?.startsWith("blob:")) {
      URL.revokeObjectURL(urlToRevoke);
    }

    setNewProd((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imageFiles: prev.imageFiles.filter((_, i) => i !== index),
    }));
  };

  // Variant handling
  const addVariant = () => {
    setNewProd((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          name: "",
          price: 0,
          cost: 0,
          barcode: "",
          sku: "",
        },
      ],
    }));
  };

  const removeVariant = (index: number) => {
    setNewProd((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariant = (
    index: number,
    field: keyof ProductVariant,
    value: any
  ) => {
    setNewProd((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  // Store stock handling
  const updateStoreStock = (index: number, quantity: number) => {
    setNewProd((prev) => ({
      ...prev,
      initialStocks: prev.initialStocks.map((stock, i) =>
        i === index ? { ...stock, quantity } : stock
      ),
    }));
  };

  // Submit handler
  const handleCreateSubmit = async () => {
    if (!newProd.name.trim()) {
      alert("Бүтээгдэхүүний нэр оруулна уу");
      return;
    }

    if (!resolvedTenantId) {
      alert("Tenant ID байхгүй байна");
      return;
    }

    // Check if total inventory is 0
    const totalInventory = newProd.initialStocks.reduce(
      (sum, stock) => sum + stock.quantity,
      0
    );
    if (totalInventory === 0) {
      const confirmResult = confirm(
        "Нийт үлдэгдэл 0 байна. Энэ нь бараа үлдэгдэлгүй байх болно. Үргэлжлүүлэх үү?"
      );
      if (!confirmResult) {
        return;
      }
    }

    setLoading(true);

    try {
      // Get authentication token
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Upload images first
      let uploadedImageUrl: string | null = null;

      if (newProd.imageFiles.length > 0) {
        const file = newProd.imageFiles[0]; // Use first image for now (API supports single img)
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(fileName);

        uploadedImageUrl = publicUrl;
      }

      // Prepare variants data
      const variants = newProd.variants.map((variant) => ({
        name: variant.name,
        sku: variant.sku || null,
        price: variant.price,
        cost: variant.cost || null,
        attrs: variant.barcode ? { barcode: variant.barcode } : {}, // Store barcode in attrs
      }));

      // If no variants but we have base product pricing, create a default variant
      if (
        variants.length === 0 &&
        (newProd.price || newProd.cost || newProd.sku || newProd.barcode)
      ) {
        variants.push({
          name: newProd.name, // Default variant name same as product name
          sku: newProd.sku || null,
          price: newProd.price || 0,
          cost: newProd.cost || null,
          attrs: newProd.barcode ? { barcode: newProd.barcode } : {}, // Store base barcode in attrs
        });
      }

      // Create product using API
      const productData = {
        name: newProd.name,
        description: newProd.description || null,
        category_id: newProd.category_id,
        img: uploadedImageUrl,
        variants: variants,
      };

      const productResponse = await createProduct(
        session.access_token,
        productData
      );

      // The API handles variants creation automatically, we just need to handle initial stock
      // Add initial stock for each store/variant combination
      if (productResponse?.product?.variants) {
        const firstVariant = productResponse.product.variants[0];
        if (firstVariant) {
          // Add a small delay to ensure the product/variant is fully committed to the database
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Process initial stock entries
          console.log("Processing initial stocks:", newProd.initialStocks);

          // If all stocks are 0, add at least 1 to the current store or first store
          const totalInventory = newProd.initialStocks.reduce(
            (sum, stock) => sum + stock.quantity,
            0
          );
          let stocksToProcess = [...newProd.initialStocks];

          if (totalInventory === 0) {
            console.log(
              "Total inventory is 0, adding minimal inventory to ensure product appears"
            );
            // Find current store or use first store
            const targetStoreIndex =
              stocksToProcess.findIndex((s) => s.storeId === currentStoreId) ||
              0;
            if (targetStoreIndex >= 0) {
              stocksToProcess[targetStoreIndex] = {
                ...stocksToProcess[targetStoreIndex],
                quantity: 1, // Add 1 unit to make the product visible
              };
            }
          }

          for (const stock of stocksToProcess) {
            try {
              // Only add inventory if quantity > 0 (API might reject 0 delta)
              if (stock.quantity > 0) {
                const inventoryResult = await productAddToInventory(
                  session.access_token,
                  {
                    store_id: stock.storeId,
                    variant_id: firstVariant.id,
                    delta: stock.quantity,
                    reason: "INITIAL",
                    note: `Initial stock from product creation: ${stock.quantity} units`,
                  }
                );
                console.log(
                  "Added inventory for store",
                  stock.storeId,
                  "quantity:",
                  stock.quantity,
                  "result:",
                  inventoryResult
                );
              } else {
                console.log("Skipping 0 quantity for store", stock.storeId);
              }
            } catch (inventoryError) {
              console.error(
                "Failed to add inventory for store",
                stock.storeId,
                ":",
                inventoryError
              );
              // Continue with other stores even if one fails
            }
          }
        }
      }

      // Reset form
      setSelectedCatId(null);
      setSelectedCat(null);
      newProd.images.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });

      setNewProd({
        name: "",
        sku: "",
        barcode: "",
        description: "",
        price: undefined,
        cost: undefined,
        category_id: null,
        images: [],
        imageFiles: [],
        variants: [],
        initialStocks: createInitialStocks(stores),
      });

      if (imgInputRef.current) imgInputRef.current.value = "";

      console.log("Product creation completed successfully");
      // Call success callback if provided, otherwise navigate
      if (onSuccess) {
        onSuccess();
      } else {
        alert("Бүтээгдэхүүн амжилттай үүсгэлээ");
        router.push("/inventory");
      }
    } catch (error: any) {
      console.error("Product creation failed:", error);
      alert(`Алдаа гарлаа: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (checkingPermission) {
    return <Loading open={true} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Category Selection */}
      <CategorySection
        categories={treeCategories}
        selectedCat={selectedCat}
        onSelectCategory={(cat) => {
          setSelectedCat(cat);
          setSelectedCatId(cat?.id || null);
        }}
      />

      {/* Debug info - remove this after testing */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-gray-100 p-2 text-xs">
          <div>Flat categories: {catsState.length}</div>
          <div>Tree categories: {treeCategories.length}</div>
          <div>Loading: {loadingCats ? "yes" : "no"}</div>
        </div>
      )}

      {/* Basic Product Info */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Нэр *
          </label>
          <input
            type="text"
            value={newProd.name}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, name: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Бүтээгдэхүүний нэр"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SKU
            </label>
            <input
              type="text"
              value={newProd.sku}
              onChange={(e) =>
                setNewProd((p) => ({ ...p, sku: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="SKU код"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Баркод
            </label>
            <input
              type="text"
              value={newProd.barcode}
              onChange={(e) =>
                setNewProd((p) => ({ ...p, barcode: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Баркод"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Тайлбар
          </label>
          <textarea
            value={newProd.description}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, description: e.target.value }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            placeholder="Бүтээгдэхүүний тайлбар"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Үнэ
            </label>
            <input
              type="number"
              value={newProd.price || ""}
              onChange={(e) =>
                setNewProd((p) => ({
                  ...p,
                  price: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Өртөг
            </label>
            <input
              type="number"
              value={newProd.cost || ""}
              onChange={(e) =>
                setNewProd((p) => ({
                  ...p,
                  cost: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="0"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Image upload section */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Зураг ({newProd.images.length}/5)
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {newProd.images.map((imgUrl, idx) => (
            <div key={idx} className="relative">
              <img
                src={imgUrl}
                alt={`Зураг ${idx + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => removeImage(idx)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="hidden"
        />
        <button
          onClick={() => imgInputRef.current?.click()}
          disabled={newProd.images.length >= 5}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Зураг нэмэх
        </button>
      </div>

      {/* Product variants */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">
            Хувилбарууд ({newProd.variants.length})
          </label>
          <button
            onClick={addVariant}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600"
          >
            + Хувилбар нэмэх
          </button>
        </div>

        {newProd.variants.map((variant, index) => (
          <div
            key={index}
            className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Хувилбар {index + 1}</span>
              <button
                onClick={() => removeVariant(index)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Устгах
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Нэр</label>
                <input
                  type="text"
                  value={variant.name}
                  onChange={(e) => updateVariant(index, "name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Хувилбарын нэр"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Үнэ</label>
                <input
                  type="number"
                  value={variant.price || ""}
                  onChange={(e) =>
                    updateVariant(
                      index,
                      "price",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Баркод
                </label>
                <input
                  type="text"
                  value={variant.barcode || ""}
                  onChange={(e) =>
                    updateVariant(index, "barcode", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Баркод"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Store inventory */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Салбарын анхны үлдэгдэл
          </label>
          <div
            className={`text-xs font-medium ${
              newProd.initialStocks.reduce(
                (sum, stock) => sum + stock.quantity,
                0
              ) === 0
                ? "text-red-600 bg-red-50 px-2 py-1 rounded"
                : "text-blue-600"
            }`}
          >
            Нийт:{" "}
            {newProd.initialStocks.reduce(
              (sum, stock) => sum + stock.quantity,
              0
            )}{" "}
            ширхэг
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-sm text-blue-700">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">Анхаарах зүйл:</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Салбар тус бүрт анхны үлдэгдэл оруулна уу. 0 оруулвал тухайн салбарт
            бараа байхгүй гэсэн үг.
          </p>
        </div>

        <div className="space-y-2">
          {newProd.initialStocks.map((stock, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
            >
              <span className="text-sm text-gray-700 flex-1 font-medium">
                {stock.storeName}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={stock.quantity}
                  onChange={(e) =>
                    updateStoreStock(index, parseInt(e.target.value) || 0)
                  }
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  placeholder="0"
                />
                <span className="text-xs text-gray-500">ширхэг</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick fill buttons */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs text-gray-500">Хурдан бөглөх:</span>
          <button
            type="button"
            onClick={() => {
              setNewProd((prev) => ({
                ...prev,
                initialStocks: prev.initialStocks.map((stock) => ({
                  ...stock,
                  quantity: 10,
                })),
              }));
            }}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            Бүгдэд 10
          </button>
          <button
            type="button"
            onClick={() => {
              setNewProd((prev) => ({
                ...prev,
                initialStocks: prev.initialStocks.map((stock) => ({
                  ...stock,
                  quantity: 5,
                })),
              }));
            }}
            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
          >
            Бүгдэд 5
          </button>
          <button
            type="button"
            onClick={() => {
              setNewProd((prev) => ({
                ...prev,
                initialStocks: prev.initialStocks.map((stock) => ({
                  ...stock,
                  quantity: 1,
                })),
              }));
            }}
            className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
          >
            Бүгдэд 1
          </button>
          <button
            type="button"
            onClick={() => {
              const confirmReset = confirm(
                "Бүх салбарын үлдэгдлийг 0 болгох уу? Энэ нь барааг үлдэгдэлгүй болгоно."
              );
              if (confirmReset) {
                setNewProd((prev) => ({
                  ...prev,
                  initialStocks: prev.initialStocks.map((stock) => ({
                    ...stock,
                    quantity: 0,
                  })),
                }));
              }
            }}
            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Бүгдийг 0
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 text-center">
        Үлдэгдэл: {qty} ширхэг
      </div>

      {/* Action buttons */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setSelectedCatId(null);
            setSelectedCat(null);
            newProd.images.forEach((u) => {
              if (u.startsWith("blob:") || u.startsWith("data:")) {
                try {
                  URL.revokeObjectURL(u);
                } catch {}
              }
            });
            setNewProd({
              name: "",
              sku: "",
              barcode: "",
              description: "",
              price: undefined,
              cost: undefined,
              category_id: null,
              images: [],
              imageFiles: [],
              variants: [],
              initialStocks: createInitialStocks(stores),
            });
            if (imgInputRef.current) imgInputRef.current.value = "";
          }}
          className="h-10 px-4 rounded-lg border border-[#E6E6E6] bg-white hover:bg-gray-50"
        >
          Цэвэрлэх
        </button>
        <button
          onClick={handleCreateSubmit}
          className="h-10 px-5 rounded-lg bg-[#5AA6FF] text-white hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? "Хадгалж байна..." : "Хадгалах"}
        </button>
      </div>
    </div>
  );
}
