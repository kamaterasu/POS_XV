"use client";
import { useMemo, useState, useEffect } from "react";
import { Item } from "@/lib/sales/salesTypes";
import { FiHeart } from "react-icons/fi";
import { FaShoppingCart } from "react-icons/fa";
import Image from "next/image";
import { getProductsForModal } from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID, getStore } from "@/lib/store/storeApi";
import { getImageShowUrl } from "@/lib/product/productImages";
import { getCategories } from "@/lib/category/categoryApi";

type Category = {
  id: string;
  name: string;
  children?: Category[];
};

type Variant = {
  variant_id: string; // Made required since we need real IDs
  color?: string;
  size?: string;
  stock: number;
  price: number;
  name?: string; // Add name for variant
  sku?: string; // Add SKU
  attrs?: Record<string, string>; // Add attributes
};
type Product = {
  id: string;
  name: string;
  img?: string;
  rawImg?: string; // Add rawImg property for image URL resolution
  category?: string; // Add category
  categoryId?: string; // Add category ID
  variants: Variant[];
};

// ---------- Image URL resolver ----------
const imgUrlCache = new Map<string, string>();
async function resolveImageUrl(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  const path = raw.includes("/") ? raw : `product_img/${raw}`;
  if (imgUrlCache.has(path)) return imgUrlCache.get(path)!;
  try {
    const signed = await getImageShowUrl(path);
    imgUrlCache.set(path, signed);
    return signed;
  } catch (e) {
    // Зургийн URL үүсгэхэд алдаа гарсан ч алдаа гаргахгүй
    return undefined;
  }
}

// Category Tree Components (similar to inventory page)
function CategoryNode({
  node,
  onSelect,
  selectedId,
}: {
  node: Category;
  onSelect: (n: Category) => void;
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
          title="Энэ ангиллаар шүүх"
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
          {node.children!.map((child: Category) => (
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
  nodes: Category[];
  onSelect: (n: Category) => void;
  selectedId?: string | null;
}) {
  if (!nodes?.length) return null;
  return (
    <ul className="space-y-1">
      {nodes.map((n: Category) => (
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

export default function AddItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (it: Item) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table"); // Add view mode state

  // Store management state (moved from checkout page)
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeInfo, setStoreInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Debounce search query to prevent too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch products when modal opens and we have a storeId, or when filters change
  useEffect(() => {
    if (!open) return; // Don't load if modal is closed

    // Wait for store to be loaded before making API calls
    if (loadingStores) {
      return;
    }

    // If no storeId is set after stores loaded, default to "all"
    if (!storeId) {
      setStoreId("all");
      return;
    }
    setLoading(true);
    setCatalog([]); // Clear previous catalog

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          console.error("🛒 AddItemModal - No access token available");
          setCatalog([]);
          return;
        }

        // Set store info for UI display
        if (storeId && storeId !== "all") {
          setStoreInfo({
            id: storeId,
            name: `Store ${storeId.substring(0, 8)}`,
          });
        } else {
          setStoreInfo(null);
        }

        // Build API parameters
        const apiParams: any = {
          limit: 500,
        };

        // Add store filtering (skip if "all")
        if (storeId && storeId !== "all") {
          apiParams.store_id = storeId;
        }

        // Add category filtering if selected
        if (selectedCat?.id) {
          apiParams.category_id = selectedCat.id;
          apiParams.subtree = true; // Include subcategories
        }

        // Add search filtering if there's a query
        if (debouncedQuery.trim()) {
          apiParams.search = debouncedQuery.trim();
        }

        // Fetch products using the new product API (includes variants and inventory in bulk)
        const response = await getProductsForModal(token, apiParams);

        if (response?.error) {
          console.error("🛒 AddItemModal - API Error:", response.error);
        }

        // Process product API response - now includes variants from updated API function
        if (response?.items && response.items.length > 0) {
          const products: Product[] = response.items
            .map((productItem: any) => {
              const totalStock = (productItem.variants || []).reduce(
                (sum: number, v: any) => sum + (v.qty || 0),
                0
              );

              // Skip products without variants (but be more lenient for debugging)
              if (!productItem.variants || productItem.variants.length === 0) {
                console.warn("🛒 Skipping product without variants:", {
                  product: productItem.name,
                  id: productItem.id,
                  variants_count: productItem.variants?.length || 0,
                });
                return null;
              }
              const variants: Variant[] = productItem.variants.map(
                (variant: any) => ({
                  variant_id: variant.id,
                  color:
                    variant.attrs?.color ||
                    variant.attrs?.Color ||
                    variant.attrs?.colorName ||
                    "Default",
                  size:
                    variant.attrs?.size ||
                    variant.attrs?.Size ||
                    variant.attrs?.Хэмжээ ||
                    "Default",
                  stock: variant.qty || 0, // qty comes from inventory view in your edge function
                  price: variant.price || 0,
                  name: variant.name,
                  sku: variant.sku,
                  attrs: variant.attrs,
                })
              );

              return {
                id: productItem.id,
                name: productItem.name,
                img: productItem.img || "/default.png",
                rawImg: productItem.img,
                category: "Unknown", // Category names can be resolved from the category API
                categoryId: productItem.category_id,
                variants: variants,
              };
            })
            .filter(Boolean) as Product[]; // Remove null entries

          // Resolve image URLs for all products
          const productsWithUrls: Product[] = await Promise.all(
            products.map(async (product) => ({
              ...product,
              img: (await resolveImageUrl(product.rawImg)) || "/default.png",
            }))
          );

          setCatalog(productsWithUrls);
          if (productsWithUrls.length > 0) {
            setActiveId(productsWithUrls[0].id);
          }
        } else {
          console.warn("🛒 AddItemModal - No items in response or empty array");
          setCatalog([]);
        }
      } catch (error) {
        console.error("🛒 AddItemModal - Error fetching products:", error);
        setCatalog([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, storeId, selectedCat?.id, debouncedQuery, loadingStores]); // React to modal open, store changes, category changes, and debounced search (all server-side filtering)

  // Load stores when modal opens
  useEffect(() => {
    if (open) {
      (async () => {
        setLoadingStores(true);
        try {
          const token = await getAccessToken();
          if (!token) return;

          const storeList = await getStore(token);
          if (storeList && Array.isArray(storeList)) {
            setStores(storeList);

            // Try to get saved store from localStorage or user default
            const fromLS =
              typeof window !== "undefined"
                ? localStorage.getItem("storeId")
                : null;

            if (fromLS && storeList.some((s) => s.id === fromLS)) {
              setStoreId(fromLS);
            } else {
              const defaultStore = await getStoredID(token);
              const finalStoreId = defaultStore || "all";
              setStoreId(finalStoreId);
            }
          } else {
            console.warn(
              "🛒 AddItemModal - No stores returned or not an array:",
              storeList
            );
            setStores([]);
            setStoreId("all");
          }
        } catch (error) {
          console.error("🛒 AddItemModal - Error loading stores:", error);
          setStores([]);
          setStoreId("all");
        } finally {
          setLoadingStores(false);
        }
      })();
    } else {
      // Clear stores when modal closes to save memory
      setStores([]);
      setStoreId(null);
    }
  }, [open]);

  // Load categories when modal opens
  useEffect(() => {
    if (open) {
      // Reset category selection when modal first opens
      setSelectedCat(null);

      (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return;

          const raw = await getCategories(token);
          const normalizeTree = (nodes: any[]): Category[] => {
            if (!Array.isArray(nodes)) return [];
            return nodes.map((node) => ({
              id: String(node.id),
              name: String(node.name || node.title || "Unknown"),
              children: node.children
                ? normalizeTree(node.children)
                : undefined,
            }));
          };

          const tree = Array.isArray(raw?.tree) ? raw.tree : [];
          const normalizedCategories = normalizeTree(tree);
          setCategories(normalizedCategories);
        } catch (error) {
          console.error("🛒 AddItemModal - Error loading categories:", error);
          setCategories([]);
        }
      })();
    } else {
      // Clear categories when modal closes to save memory
      setCategories([]);
      setSelectedCat(null);
    }
  }, [open]);

  const active = useMemo(
    () => catalog.find((p) => p.id === activeId) ?? null,
    [catalog, activeId]
  );

  const colors = useMemo(
    () =>
      Array.from(
        new Set(
          (active?.variants ?? [])
            .map((v) => v.color)
            .filter((c): c is string => Boolean(c))
        )
      ),
    [active]
  );
  const sizes = useMemo(
    () =>
      Array.from(
        new Set(
          (active?.variants ?? [])
            .map((v) => v.size)
            .filter((s): s is string => Boolean(s))
        )
      ),
    [active]
  );

  const [selColor, setSelColor] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const resetSelection = () => {
    setSelColor(null);
    setSelSize(null);
    setQty(1);
    // Don't reset category when selecting a product
  };
  const selectProduct = (id: string) => {
    setActiveId(id);
    resetSelection();
  };

  const filtered = useMemo(() => {
    // All filtering is done server-side via getProductsForModal API
    // The catalog already contains only products matching:
    // - Selected store (if not "all")
    // - Selected category (if any)
    // - Search query (if any)

    return catalog;
  }, [catalog, selectedCat?.name, storeId, debouncedQuery]);

  const selectedVariant: Variant | null = useMemo(() => {
    if (!active || !selColor || !selSize) return null;
    return (
      active.variants.find((v) => v.color === selColor && v.size === selSize) ??
      null
    );
  }, [active, selColor, selSize]);

  const remaining = selectedVariant?.stock ?? 0;
  const canAdd = !!active && !!selectedVariant && qty > 0 && qty <= remaining;

  // Format currency helper function
  const fmt = (n: number) => {
    return new Intl.NumberFormat("mn-MN", {
      style: "currency",
      currency: "MNT",
      minimumFractionDigits: 0,
    }).format(n);
  };

  // Add to cart functionality for grid view
  const addToCartFromGrid = (product: Product, quantity: number = 1) => {
    // Find the first available variant
    const availableVariant = product.variants.find((v) => v.stock > 0);

    if (!availableVariant) {
      console.warn("No available variants for product:", product.name);
      return;
    }

    onAdd({
      id: crypto.randomUUID?.() ?? `${product.id}-${Date.now()}`,
      variant_id: availableVariant.variant_id,
      name: product.name,
      qty: quantity,
      price: availableVariant.price,
      size: availableVariant.size,
      color: availableVariant.color,
      imgPath: product.img || "/default.png",
    });
  };

  const handleAdd = () => {
    if (!canAdd || !active || !selectedVariant) {
      console.warn("🛒 Cannot add item:", {
        canAdd,
        active: !!active,
        selectedVariant: !!selectedVariant,
      });
      return;
    }



    onAdd({
      id:
        crypto.randomUUID?.() ??
        `${active.id}-${selectedVariant.color}-${
          selectedVariant.size
        }-${Date.now()}`,
      variant_id: selectedVariant.variant_id, // Use the actual variant_id
      name: active.name,
      qty,
      price: selectedVariant.price,
      size: selectedVariant.size,
      color: selectedVariant.color,
      imgPath: active.img || "/default.png",
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 overscroll-contain text-black animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-7xl bg-white
          h-[98vh] md:h-[92vh] md:max-h-[90vh]
          rounded-2xl md:rounded-3xl
          shadow-xl border border-gray-200 flex flex-col overflow-hidden
          animate-in slide-in-from-bottom duration-400 ease-out
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Modern Header */}
        <div className="relative p-6 md:p-8 border-b border-gray-200 shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
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
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
                  Бүтээгдэхүүн сонгох
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Дэлгүүрээс бүтээгдэхүүн хайж, сагсанд нэмэх
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200"
            >
              <svg
                className="w-5 h-5 md:w-6 md:h-6 text-gray-600 group-hover:text-gray-800 transition-colors"
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

        {/* Clean Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Clean Product Search & Selection */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
              <div className="p-4 md:p-6 border-b border-gray-200 shrink-0 bg-white">
                {/* Search Bar */}
                <div className="relative group mb-4">
                  <input
                    className="h-12 w-full border border-gray-300 rounded-lg px-4 pl-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 bg-white placeholder:text-gray-500"
                    placeholder="🔍 Хайх: нэр, код, бренд..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors"
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
                  {/* Clear button when search has content */}
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-gray-600"
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

                {/* Store Selector */}
                <div className="mb-4 p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                        />
                      </svg>
                      <label className="text-sm font-semibold text-purple-800">
                        Дэлгүүр:
                      </label>
                    </div>
                  </div>
                  <select
                    value={storeId || ""}
                    onChange={(e) => {
                      const newStoreId = e.target.value;
                      setStoreId(newStoreId);
                      // Save to localStorage
                      if (typeof window !== "undefined") {
                        localStorage.setItem("storeId", newStoreId);
                      }
                    }}
                    disabled={loadingStores}
                    className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-purple-200 shadow-sm text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {loadingStores ? (
                      <option>Ачааллаж байна...</option>
                    ) : (
                      <>
                        <option value="all">Бүх дэлгүүр</option>
                        {stores.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {storeId === "all" && (
                    <div className="mt-2 text-xs text-purple-700 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Бүх дэлгүүрийн бүтээгдэхүүн харагдана
                    </div>
                  )}
                  {storeId &&
                    storeId !== "all" &&
                    stores.find((s) => s.id === storeId) && (
                      <div className="mt-2 text-xs text-purple-700 flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Сонгосон: {stores.find((s) => s.id === storeId)?.name}
                      </div>
                    )}
                </div>

                {/* View Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">
                      Харах:
                    </span>
                    <div className="flex items-center bg-gray-100 rounded-xl p-1">
                      <button
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          viewMode === "table"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-800"
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
                            d="M3 10h18M3 6h18M3 14h18M3 18h18"
                          />
                        </svg>
                        Жагсаалт
                      </button>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          viewMode === "grid"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-800"
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
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                        График
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    {!storeId ? (
                      "Дэлгүүр сонгоно уу"
                    ) : loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        Ачааллаж...
                      </div>
                    ) : (
                      `${catalog.length} олдлоо`
                    )}
                  </div>
                </div>
                <div className="mt-4">
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
                        onClick={() => setSelectedCat(null)}
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
                          onClick={() => setSelectedCat(null)}
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
                          Бүгд ({catalog.length})
                        </button>
                        <CategoryTree
                          nodes={categories}
                          onSelect={(cat) => setSelectedCat(cat)}
                          selectedId={selectedCat?.id}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600">
                        Бүтээгдэхүүн ачаалж байна...
                      </p>
                    </div>
                  </div>
                ) : catalog.length === 0 ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="text-center">
                      <svg
                        className="w-12 h-12 text-gray-400 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-3.5m-9 0h3.5m0 0v1.5M12 14l3-3-3-3m-5 3h8"
                        />
                      </svg>
                      <p className="text-gray-600 font-medium">
                        Бүтээгдэхүүн олдсонгүй
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Дэлгүүрт бүтээгдэхүүн байхгүй эсвэл API холболт алдаатай
                      </p>
                    </div>
                  </div>
                ) : viewMode === "table" ? (
                  // Table View (existing)
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-700">
                          Брэнд
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-700">
                          Ширхэг
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((p) => {
                        const totalStock = p.variants.reduce(
                          (s, v) => s + v.stock,
                          0
                        );
                        const activeRow = p.id === active?.id;
                        return (
                          <tr
                            key={p.id}
                            className={
                              "cursor-pointer transition-all duration-200 " +
                              (activeRow
                                ? "bg-blue-50 border-l-4 border-blue-500"
                                : "hover:bg-gray-50")
                            }
                            onClick={() => selectProduct(p.id)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 overflow-hidden flex items-center justify-center">
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
                                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                    />
                                  </svg>
                                </div>
                                <span className="font-medium text-gray-900 truncate">
                                  {p.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  totalStock > 0
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {totalStock}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  // Grid View (from checkout page)
                  <div className="p-4">
                    {/* Grid View Instructions */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
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
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-medium">График харах:</span>
                        <span>
                          Бүтээгдэхүүн сонгоод баруун талд өнгө/хэмжээ сонгоно
                          уу эсвэл "Түргэн нэмэх" товчийг дарна уу
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filtered.map((p) => {
                        const totalStock = p.variants.reduce(
                          (s, v) => s + v.stock,
                          0
                        );
                        const lowestPrice = Math.min(
                          ...p.variants.map((v) => v.price)
                        );

                        return (
                          <button
                            key={p.id}
                            onClick={() => selectProduct(p.id)}
                            className={`group text-left p-3 rounded-2xl border shadow-sm transition-all duration-200 ${
                              totalStock <= 0
                                ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
                                : p.id === active?.id
                                ? "bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-200"
                                : "bg-white/70 hover:bg-white/90 border-white/40 hover:shadow-md"
                            }`}
                            disabled={totalStock <= 0}
                            title={totalStock <= 0 ? "Нөөц дууссан" : "Сонгох"}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Image
                                  src={p.img || "/default.png"}
                                  alt={p.name}
                                  width={56}
                                  height={56}
                                  className="w-14 h-14 rounded-xl object-cover bg-gray-100"
                                  unoptimized
                                />
                                {totalStock <= 0 && (
                                  <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center">
                                    <span className="text-xs text-white font-medium">
                                      Дууссан
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {p.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Үнэ: {fmt(lowestPrice)}
                                </div>
                                <div
                                  className={`text-xs font-medium ${
                                    totalStock <= 0
                                      ? "text-red-500"
                                      : "text-green-600"
                                  }`}
                                >
                                  Үлд: {totalStock}
                                </div>
                              </div>
                              {totalStock > 0 && (
                                <div className="flex-shrink-0">
                                  <div
                                    className={`w-6 h-6 text-white rounded-full flex items-center justify-center text-xs transition-all duration-200 ${
                                      p.id === active?.id
                                        ? "bg-blue-500 opacity-100"
                                        : "bg-blue-500 opacity-0 group-hover:opacity-100"
                                    }`}
                                  >
                                    {p.id === active?.id ? "✓" : "+"}
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Add Button for Grid View */}
              {viewMode === "grid" && (
                <div className="p-4 shrink-0 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (active && active.variants.length > 0) {
                        const availableVariant = active.variants.find(
                          (v) => v.stock > 0
                        );
                        if (availableVariant) {
                          addToCartFromGrid(active, 1);
                          onClose();
                        }
                      }
                    }}
                    disabled={
                      !active || active.variants.every((v) => v.stock <= 0)
                    }
                    className={`relative w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200 ${
                      active && active.variants.some((v) => v.stock > 0)
                        ? "bg-gradient-to-r from-green-500 to-emerald-600"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                    title={
                      active
                        ? active.variants.some((v) => v.stock > 0)
                          ? "Түргэн нэмэх"
                          : "Нөөц дууссан"
                        : "Бүтээгдэхүүн сонгоно уу"
                    }
                  >
                    {active && active.variants.some((v) => v.stock > 0) ? (
                      <>
                        <FaShoppingCart className="w-6 h-6 text-white" />
                        <span className="absolute -top-2 -right-2 w-6 h-6 text-xs rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow-lg">
                          +
                        </span>
                      </>
                    ) : (
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
              <div className="p-4 md:p-6 border-b border-gray-200 shrink-0 flex items-start gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-gray-100 flex items-center justify-center text-sm text-gray-500 overflow-hidden">
                  {active?.img ? (
                    <Image
                      src={active.img}
                      alt={active.name}
                      className="object-cover w-full h-full"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <svg
                      className="w-6 h-6 md:w-8 md:h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {active?.name ?? "—"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">Нөөц:</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (active
                          ? active.variants.reduce((s, v) => s + v.stock, 0)
                          : 0) > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {active
                        ? active.variants.reduce((s, v) => s + v.stock, 0)
                        : 0}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-50 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all duration-200 border border-gray-200"
                >
                  <FiHeart className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              <div className="p-4 md:p-6 border-b border-gray-200 shrink-0 bg-gray-50">
                <div className="text-sm font-semibold mb-4 text-gray-900">
                  Өнгө:
                </div>
                <div className="flex flex-wrap gap-3">
                  {colors.map((c) => {
                    const activeChip = selColor === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setSelColor(c)}
                        className={
                          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 " +
                          (activeChip
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-105"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200")
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                  {colors.length === 0 && (
                    <span className="text-sm text-gray-500 italic">
                      Өнгө байхгүй
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 border-b border-gray-200/50 shrink-0">
                <div className="text-sm font-semibold mb-4 text-gray-900">
                  Хэмжээ:
                </div>
                <div className="flex flex-wrap gap-3">
                  {sizes.map((s) => {
                    const v = active?.variants.find(
                      (v) => v.size === s && (!selColor || v.color === selColor)
                    );
                    const disabled = !v || v.stock <= 0;
                    const activeChip = selSize === s;
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => !disabled && setSelSize(s)}
                        className={
                          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 " +
                          (disabled
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed opacity-50"
                            : activeChip
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg scale-105"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200")
                        }
                        disabled={disabled}
                      >
                        {s}
                      </button>
                    );
                  })}
                  {sizes.length === 0 && (
                    <span className="text-sm text-gray-500 italic">
                      Хэмжээ байхгүй
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 border-b border-gray-200/50 shrink-0">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-2">
                    Сонгосон хувилбар:
                  </div>
                  <div className="font-medium text-gray-800">
                    {selColor && selSize
                      ? `${selColor} / ${selSize}`
                      : "Өнгө болон хэмжээ сонгоно уу"}
                  </div>
                  {selectedVariant && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-green-700 font-medium">
                        Боломжит: {remaining} ширхэг
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* optional scrollable middle segment */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* энд хүсвэл урт тайлбар/metadata байрлуулж болно */}
              </div>

              <div className="p-6 shrink-0 bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-sm font-semibold text-gray-900">
                    Тоо ширхэг
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-full p-1 shadow-sm">
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 flex items-center justify-center transition-colors duration-200"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
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
                    </button>
                    <span className="min-w-12 text-center text-lg font-bold text-gray-900 px-3">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
                      onClick={() => setQty((q) => Math.min(9999, q + 1))}
                      disabled={!selectedVariant || qty >= remaining}
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-12 px-6 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    Болих
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!canAdd}
                    className={
                      "flex-1 h-12 px-6 rounded-xl font-semibold transition-all duration-200 " +
                      (!canAdd
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl active:scale-95")
                    }
                  >
                    Сагс руу нэмэх
                  </button>
                </div>

                {canAdd && selColor && selSize && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="text-sm text-blue-800">
                      <span className="font-medium">{qty} ширхэг</span> •
                      <span className="ml-1">Хэмжээ: {selSize}</span> •
                      <span className="ml-1">Өнгө: {selColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
