// app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Item, QuickActions, PaymentRow } from "@/lib/sales/salesTypes";
import { fmt, calcTotals } from "@/lib/sales/salesUtils";
import {
  createCheckoutOrder,
  getCheckoutOrders,
  getCheckoutOrder,
  getCheckout,
  type PaymentInput,
  type CheckoutOrdersList,
  type CheckoutOrderDetail,
  normalizeMethod,
} from "@/lib/checkout/checkoutApi";

import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID, getStore } from "@/lib/store/storeApi";
import { getProductByStore, getProductById } from "@/lib/product/productApi";
import { getImageShowUrl } from "@/lib/product/productImages";

import CartFooter from "@/components/checkoutComponents/CartFooter";
import AddItemModal from "@/components/checkoutComponents/AddItemModal";
import SaveDraftDialog from "@/components/checkoutComponents/SaveDraftDialog";
import DraftManagerDialog from "@/components/checkoutComponents/DraftManagerDialog";
import PayDialogMulti from "@/components/checkoutComponents/PayDialogMulti";
import CheckoutHistoryDialog from "@/components/checkoutComponents/CheckoutHistoryDialog";

// ---------- Types ----------
type ProductRow = {
  id: string;
  name: string;
  imgPath?: string;
  price: number;
  qty: number;
  variantId?: string;
  productId?: string;
};

type CartItem = Item & { size?: string; color?: string };

type VariantOpt = {
  id: string;
  price: number;
  stock: number;
  size?: string;
  color?: string;
  colorHex?: string;
  sku?: string;
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

export default function CheckoutPage() {
  const router = useRouter();

  // cart + quick actions
  const [items, setItems] = useState<CartItem[]>([]);
  const [qa, setQa] = useState<QuickActions>({
    discountPercent: 0,
    deliveryFee: 0,
    includeVAT: false,
  });

  // dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [openSave, setOpenSave] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openDraftManager, setOpenDraftManager] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);

  // processing
  const [isProcessing, setIsProcessing] = useState(false);

  // order history
  const [orderHistory, setOrderHistory] = useState<CheckoutOrdersList | null>(
    null
  );
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] =
    useState<CheckoutOrderDetail | null>(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  // Notification system
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (
    type: "success" | "error" | "info",
    message: string
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // store + products
  const [storeId, setStoreId] = useState<string | null>(null);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [productList, setProductList] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [dataSource, setDataSource] = useState<"global" | "store-specific">(
    "store-specific"
  );

  // Variant picker
  const [picker, setPicker] = useState<{
    productId: string;
    name: string;
    img?: string;
  } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerVars, setPickerVars] = useState<VariantOpt[]>([]);
  const [selColor, setSelColor] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);

  // Auto-load order history when history dialog opens
  useEffect(() => {
    if (openHistory && !orderHistory && !loadingHistory) {
      loadOrderHistory(storeId || undefined);
    }
  }, [openHistory, orderHistory, loadingHistory, storeId]);

  const goToDashboard = () => router.push("/dashboard");
  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const colorLabel = (c?: string) => {
    const v = (c ?? "").toLowerCase();
    if (v === "#000000" || v === "black") return "Хар";
    if (v === "#ffffff" || v === "white") return "Цагаан";
    if (v === "#1a5fb4") return "Цэнхэр";
    if (v === "#26a269") return "Ногоон";
    return c ?? "—";
  };
  const colorKeyOf = (v: VariantOpt) => v.colorHex ?? v.color ?? "—";

  // Load order history
  const loadOrderHistory = async (storeIdFilter?: string) => {
    setLoadingHistory(true);
    try {
      const orders = await getCheckoutOrders(storeIdFilter, 50, 0);
      setOrderHistory(orders);
    } catch (error) {
      console.error("Failed to load order history:", error);
      showNotification("error", "Захиалгын түүх ачаалахад алдаа гарлаа");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load specific order detail
  const loadOrderDetail = async (orderId: string) => {
    setLoadingOrderDetail(true);
    try {
      const detail = await getCheckoutOrder(orderId);
      setSelectedOrderDetail(detail);
    } catch (error) {
      console.error("Failed to load order detail:", error);
      showNotification("error", "Захиалгын дэлгэрэнгүй ачаалахад алдаа гарлаа");
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  // Search orders
  const searchOrders = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      loadOrderHistory(storeId || undefined);
      return;
    }

    setLoadingHistory(true);
    try {
      // Load all orders first, then filter client-side
      // In a production app, this should be server-side filtering
      const orders = await getCheckoutOrders(storeId || undefined, 200, 0);
      if (orders) {
        const filtered = {
          ...orders,
          items: orders.items.filter(
            (order) =>
              order.order_no
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              new Date(order.created_at)
                .toLocaleDateString()
                .includes(searchTerm)
          ),
        };
        setOrderHistory(filtered);
      }
    } catch (error) {
      console.error("Failed to search orders:", error);
      showNotification("error", "Захиалга хайхад алдаа гарлаа");
    } finally {
      setLoadingHistory(false);
    }
  };

  const normalizeVariants = (det: any): VariantOpt[] => {
    const raw = (det?.variants ??
      det?.product?.variants ??
      det?.data?.variants ??
      []) as any[];
    return raw.map((v) => {
      const a = v?.attrs ?? {};
      const [maybeColorFromName, maybeSizeFromName] = String(v?.name ?? "")
        .split("/")
        .map((s: string) => s.trim());
      const colorHex =
        typeof a.color === "string" && a.color.startsWith("#")
          ? a.color
          : undefined;
      return {
        id: String(v.id),
        price: Number(v.price ?? 0),
        stock: Number(v.qty ?? v.stock ?? 0),
        size: a.size ?? a.Size ?? a["Хэмжээ"] ?? maybeSizeFromName ?? "",
        color:
          a.colorName ?? a.ColorName ?? a["Өнгө"] ?? maybeColorFromName ?? "",
        colorHex,
        sku: v.sku,
      } as VariantOpt;
    });
  };

  // Add product to cart with validation
  const addToCart = (product: ProductRow, quantity: number = 1) => {
    if (!product.variantId) {
      showNotification("error", "Бүтээгдэхүүний мэдээлэл дутуу байна");
      return;
    }

    if (product.qty <= 0) {
      showNotification("error", `${product.name} дууссан байна`);
      return;
    }

    const variantId = product.variantId;
    const productId =
      product.productId || product.id.split("-")[0] || product.id;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.variant_id === variantId
      );

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.qty + quantity;

        // Check stock limit
        if (newQty > product.qty) {
          showNotification(
            "error",
            `${product.name} - Хангалттай нөөц байхгүй (үлдэгдэл: ${product.qty})`
          );
          return prev;
        }

        const updated = [...prev];
        updated[existingIndex] = { ...existing, qty: newQty };
        showNotification(
          "success",
          `${product.name} сагсанд нэмэгдлээ (${newQty})`
        );
        return updated;
      }

      // Check if we can add initial quantity
      if (quantity > product.qty) {
        showNotification(
          "error",
          `${product.name} - Хангалттай нөөц байхгүй (үлдэгдэл: ${product.qty})`
        );
        return prev;
      }

      const newItem: CartItem = {
        id: productId,
        variant_id: variantId,
        name: product.name,
        price: product.price,
        qty: quantity,
        imgPath: product.imgPath || "/default.png",
        size: "",
        color: "",
      };

      showNotification("success", `${product.name} сагсанд нэмэгдлээ`);
      return [newItem, ...prev];
    });
  };

  const openVariantPicker = async (p: ProductRow) => {
    addToCart(p, 1);
  };

  // Remove item from cart
  const removeFromCart = (variantId: string) => {
    setItems((prev) => {
      const filtered = prev.filter((item) => item.variant_id !== variantId);
      const removedItem = prev.find((item) => item.variant_id === variantId);
      if (removedItem) {
        showNotification("info", `${removedItem.name} сагснаас хасагдлаа`);
      }
      return filtered;
    });
  };

  // Update item quantity with validation
  const updateItemQuantity = (variantId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(variantId);
      return;
    }

    setItems((prev) => {
      return prev.map((item) => {
        if (item.variant_id !== variantId) return item;

        // Find corresponding product for stock validation
        const product = productList.find((p) => p.variantId === variantId);
        if (product && newQty > product.qty) {
          showNotification(
            "error",
            `${item.name} - Хангалттай нөөц байхгүй (үлдэгдэл: ${product.qty})`
          );
          return item; // Don't change quantity if exceeds stock
        }

        return { ...item, qty: newQty };
      });
    });
  };

  // totals
  const totalRaw = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.price, 0),
    [items]
  );
  const totals = useMemo(() => calcTotals(items, qa), [items, qa]);

  // 0) Load available stores
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("No token");
        const storeList = await getStore(token);
        console.log("🏪 Available stores:", storeList);
        if (alive) {
          // Add "All stores" option at the beginning
          setStores([
            { id: "all", name: "Бүх дэлгүүр" },
            ...storeList.map((s: any) => ({
              id: s.id,
              name: s.name || s.id.slice(0, 8),
            })),
          ]);
        }
      } catch (e) {
        const errorMsg = handleApiError(
          e,
          "Дэлгүүрийн жагсаалт ачаалахад алдаа гарлаа"
        );
        console.error("Load stores error:", e);
        if (alive) {
          setStores([{ id: "all", name: "Бүх дэлгүүр" }]);
          // Only show error for authentication issues
          if (String(e).includes("NOT_AUTHENTICATED")) {
            showNotification("error", errorMsg);
          }
        }
      } finally {
        if (alive) setLoadingStores(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 1) storeId resolve - Single useEffect for cleaner logic
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Check localStorage first for saved preference
        const fromLS =
          typeof window !== "undefined"
            ? localStorage.getItem("storeId")
            : null;
        if (fromLS) {
          if (alive) setStoreId(fromLS);
          return;
        }

        // If no localStorage, get user's default store
        const token = await getAccessToken();
        if (!token) throw new Error("No token");
        const sid = await getStoredID(token);
        console.log("🎯 Default store ID:", sid);
        if (alive) setStoreId(sid ?? "all"); // Default to "all" if no specific store
      } catch (e) {
        console.error("Resolve storeId error:", e);
        if (alive) setStoreId("all"); // Always fallback to "all" instead of null
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load products based on store selection and search
  const loadProducts = async (
    selectedStoreId: string,
    searchQuery: string = ""
  ) => {
    if (!selectedStoreId) return;

    setLoadingProducts(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Authentication required");

      let invRes: any;
      let currentDataSource = "store-specific";

      if (selectedStoreId === "all") {
        // Load global inventory for all stores
        try {
          const { jwtDecode } = await import("jwt-decode");
          const decoded: any = jwtDecode(token);
          const tenantId = decoded?.app_metadata?.tenants?.[0];

          if (!tenantId) throw new Error("Tenant ID not found");

          const globalResponse = await fetch(
            `${
              process.env.NEXT_PUBLIC_SUPABASE_URL
            }/functions/v1/inventory?tenant_id=${encodeURIComponent(
              tenantId
            )}&scope=global&limit=500`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (globalResponse.ok) {
            invRes = await globalResponse.json();
            currentDataSource = "global";
          } else {
            throw new Error("Global inventory not available");
          }
        } catch (globalError) {
          console.warn(
            "Global inventory failed, using empty list:",
            globalError
          );
          invRes = { items: [] };
        }
      } else {
        // Load store-specific inventory
        invRes = await getProductByStore(token, selectedStoreId);
      }

      setDataSource(currentDataSource as "global" | "store-specific");

      // Process inventory data
      const rawItems = Array.isArray(invRes)
        ? invRes
        : invRes?.items ?? invRes?.data ?? invRes?.products ?? [];

      // Transform to ProductRow format
      const productList: ProductRow[] = rawItems
        .filter((item: any) => item?.product?.id && item?.variant_id)
        .map((item: any) => {
          const product = item.product;
          const variant = item.variant;
          const baseName = String(product?.name ?? "(нэргүй)");
          const variantName = variant?.name;

          return {
            id: `${product.id}-${item.variant_id}`,
            name:
              variantName && variantName !== baseName
                ? `${baseName} - ${variantName}`
                : baseName,
            imgPath: product?.img,
            price: Number(variant?.price ?? 0),
            qty: Number(item?.qty ?? item?.stock ?? 0),
            variantId: item.variant_id,
            productId: product.id,
          };
        });

      // Resolve image URLs
      const productsWithImages = await Promise.all(
        productList.map(async (product) => ({
          ...product,
          imgPath: await resolveImageUrl(product.imgPath),
        }))
      );

      // Apply search filter
      const searchTerm = searchQuery.trim().toLowerCase();
      const filteredProducts = searchTerm
        ? productsWithImages.filter((p) =>
            p.name.toLowerCase().includes(searchTerm)
          )
        : productsWithImages;

      setProductList(filteredProducts);
    } catch (error) {
      const errorMsg = handleApiError(
        error,
        "Бүтээгдэхүүн ачаалахад алдаа гарлаа"
      );
      console.error("Load products failed:", error);
      setProductList([]);

      // Show error for critical issues
      if (
        String(error).includes("NOT_AUTHENTICATED") ||
        String(error).includes("tenant_id")
      ) {
        showNotification("error", errorMsg);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  // 2) Load products when store or search changes
  useEffect(() => {
    if (storeId) {
      loadProducts(storeId, search);
    }
  }, [storeId, search]);

  // Enhanced error handling helper
  const handleApiError = (
    error: any,
    defaultMessage: string = "Тодорхойгүй алдаа гарлаа"
  ) => {
    console.error("API Error:", error);
    const errorMessage = String(error?.message ?? "");

    // Network errors
    if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError")
    ) {
      return "Интернэт холболт тасарсан байна. Дахин оролдоно уу.";
    }

    // Authentication errors
    if (
      errorMessage.includes("NOT_AUTHENTICATED") ||
      errorMessage.includes("401")
    ) {
      return "Нэвтрэх эрх дууссан байна. Дахин нэвтэрнэ үү.";
    }

    // Authorization errors
    if (errorMessage.includes("tenant_id") || errorMessage.includes("403")) {
      return "Танд байгууллагын эрх байхгүй байна.";
    }

    if (errorMessage.includes("store_id")) {
      return "Дэлгүүрийн эрх байхгүй байна.";
    }

    // Validation errors
    if (
      errorMessage.includes("variant_id") ||
      errorMessage.includes("validation")
    ) {
      return "Бүтээгдэхүүний мэдээлэл буруу байна. Дахин сонгоно уу.";
    }

    // Database constraint errors
    if (errorMessage.includes("foreign key constraint")) {
      if (errorMessage.includes("tenant_id_store_id")) {
        return "Сонгосон дэлгүүр системд бүртгэгдээгүй байна. Админтай холбогдоно уу.";
      }
      return "Өгөгдлийн сангийн холболтын алдаа. Админтай холбогдоно уу.";
    }

    // UUID validation error (like "invalid input syntax for type uuid")
    if (errorMessage.includes("invalid input syntax for type uuid")) {
      return "Дэлгүүрийн ID буруу байна. Тодорхой дэлгүүр сонгоно уу.";
    }

    if (
      errorMessage.includes("insufficient") ||
      errorMessage.includes("stock")
    ) {
      return "Хангалттай нөөц байхгүй байна.";
    }

    // Server errors
    if (
      errorMessage.includes("500") ||
      errorMessage.includes("Internal Server Error")
    ) {
      return "Серверийн алдаа гарлаа. Дахин оролдоно уу.";
    }

    // Return the actual error message if it's user-friendly, otherwise use default
    return errorMessage.length > 0 && errorMessage.length < 100
      ? errorMessage
      : defaultMessage;
  };

  // 3) төлбөр
  const handleCheckout = async (
    paymentRows: PaymentRow[],
    _totalReceived: number,
    _change: number
  ) => {
    // Enhanced validation with better error messages
    if (items.length === 0) {
      showNotification("error", "Захиалгад бүтээгдэхүүн нэмнэ үү");
      return;
    }

    const missing = items.filter((i) => !i.variant_id);
    if (missing.length) {
      console.error("Items missing variant_id:", missing);
      showNotification(
        "error",
        "Зарим бүтээгдэхүүнд хэмжээ/өнгө сонгогдоогүй байна. Дахин сонгоно уу."
      );
      return;
    }

    if (!storeId || storeId === "all") {
      showNotification(
        "error",
        "Захиалга үүсгэхийн тулд тодорхой дэлгүүр сонгоно уу. 'Бүх дэлгүүр' сонголтоор захиалга үүсгэх боломжгүй."
      );
      return;
    }

    const totalPayments = paymentRows.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPayments - totals.grand) > 1) {
      showNotification(
        "error",
        "Төлбөрийн дүн таарахгүй байна. Дахин шалгаарай."
      );
      return;
    }

    setIsProcessing(true);
    try {
      const tax = qa.includeVAT ? Math.round(totals.grand * 0.1) : 0;
      const discount = Math.round(totals.discount);

      const payments: PaymentInput[] = paymentRows.map((r) => ({
        method: normalizeMethod(r.method),
        amount: Math.round(r.amount),
        ref: (r as any).ref,
      }));

      console.log("🛒 Creating checkout order with store_id:", storeId);
      
      const result = await createCheckoutOrder(
        items.map((it) => ({
          variantId: it.variant_id!,
          qty: it.qty,
          price: it.price,
        })),
        payments,
        { tax, discount },
        storeId
      );

      // Clear cart and reset state on success
      setItems([]);
      setQa({ discountPercent: 0, deliveryFee: 0, includeVAT: false });
      setOpenPay(false);

      // Refresh order history if it's loaded
      if (orderHistory) {
        loadOrderHistory(storeId);
      }

      const orderNumber =
        result?.order?.order_no ||
        result?.order?.id?.slice(-8) ||
        "Тодорхойгүй";
      showNotification(
        "success",
        `Захиалга амжилттай үүсгэгдлээ! Дугаар: ${orderNumber}`
      );

      if (result?.order?.id) {
        router.push(`/receipt?orderId=${result.order.id}`);
      }
    } catch (error: any) {
      const userMessage = handleApiError(
        error,
        "Захиалга үүсгэхэд алдаа гарлаа"
      );
      showNotification("error", userMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const printPayload = { items, total: totals.grand };

  function handlePrintClick() {
    setShowPrintConfirm(true);
  }

  function confirmPrint() {
    setShowPrintConfirm(false);
    // ...print logic here (call print function)...
  }

  // ============================= UI =============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button
          onClick={goToDashboard}
          className="group flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95"
        >
          <svg
            className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="font-medium text-gray-900">Борлуулалт</span>
        </button>

        <div className="flex items-center gap-4">
          {/* Store Filter for Order History */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Дэлгүүрийн түүх:</label>
            <select
              value={storeId || "all"}
              onChange={(e) => {
                const newStoreId =
                  e.target.value === "all" ? null : e.target.value;
                setStoreId(newStoreId);
                // Save to localStorage
                if (typeof window !== "undefined") {
                  localStorage.setItem("storeId", newStoreId || "all");
                }
              }}
              disabled={loadingStores}
              className="px-2 py-1 rounded bg-white/80 border border-white/40 shadow-sm text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
            >
              {loadingStores ? (
                <option>...</option>
              ) : (
                <>
                  <option value="all">Бүх дэлгүүр</option>
                  {stores
                    .filter((s) => s.id !== "all")
                    .map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>

          {/* Quick Order Stats */}
          {orderHistory && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>
                Өнөөдөр:{" "}
                {
                  orderHistory.items.filter((o) => {
                    const today = new Date().toDateString();
                    const orderDate = new Date(o.created_at).toDateString();
                    return today === orderDate;
                  }).length
                }{" "}
                захиалга
              </span>
              {orderHistory.count > orderHistory.items.length && (
                <span className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">
                  +{orderHistory.count - orderHistory.items.length}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col text-black">
        {/* Search + grid */}
        {/* <section className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Бүтээгдэхүүн хайх..."
                className="w-full px-4 py-2 pl-10 rounded-xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                disabled={!storeId}
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
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
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 hover:text-gray-600"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {!storeId ? (
                "Store сонгоогүй"
              ) : loadingProducts ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Ачааллаж...
                </div>
              ) : (
                `${productList.length} олдлоо`
              )}
            </div>
          </div>

          {!storeId ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
                />
              </svg>
              <p className="text-lg font-medium mb-2">Дэлгүүр сонгогдоогүй</p>
              <p className="text-sm text-center">
                Бүтээгдэхүүн харахын тулд дэлгүүр сонгоно уу
              </p>
            </div>
          ) : productList.length === 0 && !loadingProducts ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-lg font-medium mb-2">Бүтээгдэхүүн олдсонгүй</p>
              <p className="text-sm text-center">
                {search
                  ? "Хайлтын үр дүн олдсонгүй. Өөр түлхүүр үг ашиглана уу."
                  : "Энэ дэлгүүрт бүтээгдэхүүн байхгүй байна."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(loadingProducts ? Array.from({ length: 8 }) : productList).map(
                (p: any, idx: number) =>
                  loadingProducts ? (
                    <div
                      key={`s-${idx}`}
                      className="h-28 rounded-2xl bg-white/60 border border-white/40 animate-pulse"
                    />
                  ) : (
                    <button
                      key={p.id}
                      onClick={() => openVariantPicker(p)}
                      className={`group text-left p-3 rounded-2xl border shadow-sm transition-all duration-200 ${
                        (p.qty ?? 0) <= 0
                          ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
                          : "bg-white/70 hover:bg-white/90 border-white/40 hover:shadow-md"
                      }`}
                      disabled={(p.qty ?? 0) <= 0}
                      title={(p.qty ?? 0) <= 0 ? "Нөөц дууссан" : "Сагслах"}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Image
                            src={p.imgPath || "/default.png"}
                            alt={p.name}
                            width={56}
                            height={56}
                            className="w-14 h-14 rounded-xl object-cover bg-gray-100"
                            unoptimized
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/default.png";
                            }}
                          />
                          {(p.qty ?? 0) <= 0 && (
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
                            Үнэ: {fmt(p.price)}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              (p.qty ?? 0) <= 0
                                ? "text-red-500"
                                : "text-green-600"
                            }`}
                          >
                            Үлд: {p.qty ?? 0}
                          </div>
                        </div>
                        {(p.qty ?? 0) > 0 && (
                          <div className="flex-shrink-0">
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              +
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  )
              )}
            </div>
          )}
        </section> */}

        {/* Cart header */}
        <div className="flex flex-col gap-2 px-6 py-3 mb-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-900 font-medium">
            <div className="flex items-center gap-2">
              <span>Сагс</span>
              {items.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {items.length} зүйл
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {items.length > 0 && (
                <>
                  <span className="text-xs text-gray-600">
                    Нийт:{" "}
                    <span className="font-semibold text-blue-600">
                      {fmt(totalRaw)}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      setItems([]);
                      showNotification("info", "Сагс цэвэрлэгдлээ");
                    }}
                    className="px-3 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Сагс цэвэрлэх"
                  >
                    Цэвэрлэх
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Store selection status indicator */}
          {storeId === "all" && items.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
              <svg
                className="w-4 h-4 text-amber-600 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-amber-800 font-medium">
                Анхаар: "Бүх дэлгүүр" сонгосон тул төлбөр тооцох боломжгүй.
                Тодорхой дэлгүүр сонгоно уу.
              </span>
            </div>
          )}

          {storeId !== "all" &&
            items.length > 0 &&
            stores.find((s) => s.id === storeId) && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs">
                <svg
                  className="w-4 h-4 text-green-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-green-800 font-medium">
                  Дэлгүүр: {stores.find((s) => s.id === storeId)?.name} - Төлбөр
                  тооцоход бэлэн
                </span>
              </div>
            )}
        </div>

        {/* Cart list */}
        <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <p className="text-lg font-medium mb-2">Сагс хоосон байна</p>
              <p className="text-sm text-center">
                Бүтээгдэхүүн сонгож сагсанд нэмнэ үү
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((it, idx) => {
                const line = it.qty * it.price;
                return (
                  <li
                    key={it.id + "-" + (it as any).variant_id + "-" + idx}
                    className="p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200"
                  >
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                      <div className="flex items-start gap-2 w-full">
                        <Image
                          src={it.imgPath || "/default.png"}
                          alt={it.name}
                          width={40}
                          height={40}
                          className="w-12 h-12 rounded-xl object-cover bg-gray-100 shadow-sm"
                          unoptimized
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/default.png";
                          }}
                        />
                        <div className="leading-tight flex flex-col min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {idx + 1}. {it.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            Хэмжээ: {(it as any).size || "—"} • Өнгө:{" "}
                            {(it as any).color || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {fmt(it.price)} × {it.qty}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-center">
                        <div className="flex justify-center w-20">
                          <div className="inline-flex items-center gap-1 bg-gray-50 rounded-full p-1">
                            <button
                              onClick={() =>
                                updateItemQuantity(it.variant_id!, it.qty - 1)
                              }
                              className="w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 text-sm leading-none flex items-center justify-center transition-colors duration-200"
                              title={
                                it.qty === 1 ? "Сагснаас хасах" : "Тоог хасах"
                              }
                            >
                              –
                            </button>
                            <span className="w-8 text-center text-sm font-medium text-gray-900 px-2">
                              {it.qty}
                            </span>
                            {(() => {
                              const product = productList.find(
                                (p) => p.variantId === it.variant_id
                              );
                              const isAtStockLimit = product && it.qty >= product.qty;
                              
                              return (
                                <button
                                  onClick={() =>
                                    updateItemQuantity(it.variant_id!, it.qty + 1)
                                  }
                                  disabled={isAtStockLimit}
                                  className={`w-7 h-7 rounded-full text-white text-sm leading-none flex items-center justify-center transition-colors duration-200 ${
                                    isAtStockLimit
                                      ? "bg-gray-300 cursor-not-allowed"
                                      : "bg-blue-500 hover:bg-blue-600"
                                  }`}
                                  title={
                                    isAtStockLimit
                                      ? `Хангалттай нөөц байхгүй (үлдэгдэл: ${product?.qty || 0})`
                                      : "Тоог нэмэх"
                                  }
                                >
                                  +
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="w-20 text-right font-semibold text-gray-900">
                          {fmt(line)}
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => removeFromCart(it.variant_id!)}
                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 flex items-center justify-center transition-colors duration-200"
                        title="Сагснаас хасах"
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
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Totals */}
        <div className="mt-4 bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm p-6 text-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Дүн</span>
            <span className="font-medium text-gray-900">{fmt(totalRaw)}</span>
          </div>
          {!!qa.discountPercent && (
            <div className="flex justify-between items-center text-red-600">
              <span>Хөнгөлөлт ({qa.discountPercent}%)</span>
              <span className="font-medium">- {fmt(totals.discount)}</span>
            </div>
          )}
          {qa.includeVAT && (
            <div className="flex justify-between items-center text-amber-600">
              <span>НӨАТ (10%)</span>
              <span className="font-medium">{fmt(totals.vat)}</span>
            </div>
          )}
          {!!qa.deliveryFee && (
            <div className="flex justify-between items-center text-blue-600">
              <span>Хүргэлт</span>
              <span className="font-medium">{fmt(totals.deliveryFee)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg text-gray-900">
                Нийт төлөх
              </span>
              <span className="font-bold text-xl text-blue-600">
                {fmt(totals.grand)}
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <CartFooter
          onQuick={() => setOpenAdd(true)}
          onAdd={() => setOpenAdd(true)}
          onSave={() => setOpenSave(true)}
          onPay={() => {
            if (storeId === "all") {
              showNotification(
                "error",
                "Захиалга үүсгэхийн тулд тодорхой дэлгүүр сонгоно уу"
              );
              return;
            }
            setOpenPay(true);
          }}
          onHistory={() => {
            setOpenHistory(true);
            // Auto-load history when opening
            if (!orderHistory && !loadingHistory) {
              loadOrderHistory(storeId || undefined);
            }
          }}
          onPrint={handlePrintClick}
          onDraftManager={() => setOpenDraftManager(true)}
        />
      </footer>

      <AddItemModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(it) =>
          setItems((prev) => {
            // Better matching: use variant_id if available, otherwise fallback to name+price
            const i = prev.findIndex((p) =>
              it.variant_id
                ? p.variant_id === it.variant_id
                : p.name === it.name && p.price === it.price
            );
            if (i > -1) {
              const copy = [...prev];
              // Preserve all properties including variant_id when updating quantity
              copy[i] = {
                ...copy[i],
                ...it, // Include all new item properties
                qty: copy[i].qty + it.qty,
              };
              return copy;
            }
            return [it as CartItem, ...prev];
          })
        }
      />

      <SaveDraftDialog
        open={openSave}
        onClose={() => setOpenSave(false)}
        items={items}
      />

      <PayDialogMulti
        open={openPay}
        onClose={() => !isProcessing && setOpenPay(false)}
        total={totals.grand}
        onPaidMulti={handleCheckout}
        disabled={isProcessing || storeId === "all"}
      />

      <CheckoutHistoryDialog
        open={openHistory}
        onClose={() => setOpenHistory(false)}
        onSelectOrder={(order) => router.push(`/receipt?orderId=${order.id}`)}
        orderHistory={orderHistory}
        loadingHistory={loadingHistory}
        orderSearchTerm={orderSearchTerm}
        onSearchChange={(term: string) => {
          setOrderSearchTerm(term);
          searchOrders(term);
        }}
        onLoadHistory={() => loadOrderHistory(storeId || undefined)}
        onViewOrderDetail={loadOrderDetail}
        selectedOrderDetail={selectedOrderDetail}
        loadingOrderDetail={loadingOrderDetail}
        onCloseOrderDetail={() => setSelectedOrderDetail(null)}
      />

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow">
            {pickerLoading ? (
              <div className="text-sm text-neutral-500">Ачааллаж байна…</div>
            ) : (
              <>
                {/* Толгой */}
                <div className="flex gap-3 mb-3">
                  <Image
                    src={picker.img || "/default.png"}
                    alt={picker.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                    unoptimized
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/default.png";
                    }}
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          Нэр: {picker.name}
                        </div>
                        <div className="text-sm text-gray-700">
                          Нөөц:{" "}
                          {pickerVars.reduce((s, v) => s + (v.stock || 0), 0)}
                        </div>
                      </div>
                      <button
                        title="Дуртайд нэмэх"
                        className="p-1.5 rounded-full border text-blue-500 border-blue-200 hover:bg-blue-50"
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                </div>

                {/* Өнгө */}
                {(() => {
                  const colors = uniq(pickerVars.map(colorKeyOf));
                  return (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-2">Өнгө:</div>
                      <div className="flex items-center gap-3">
                        {colors.map((c) => {
                          const sample = pickerVars.find(
                            (v) => colorKeyOf(v) === c
                          );
                          const sw = sample?.colorHex;
                          const active = selColor === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setSelColor(c)}
                              className={`flex flex-col items-center text-xs ${
                                active
                                  ? "ring-2 ring-blue-500 rounded-full"
                                  : ""
                              }`}
                              title={colorLabel(c)}
                            >
                              <span
                                className="w-7 h-7 rounded-full border"
                                style={{ backgroundColor: sw || undefined }}
                              />
                              <span className="mt-1 text-gray-700">
                                {colorLabel(c)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Хэмжээ */}
                {(() => {
                  const sizes = uniq(
                    pickerVars
                      .filter((v) => !selColor || colorKeyOf(v) === selColor)
                      .map((v) => v.size || "—")
                  );
                  const getStock = (size: string) => {
                    const v = pickerVars.find(
                      (x) =>
                        (x.size || "—") === size &&
                        (!selColor || colorKeyOf(x) === selColor)
                    );
                    return v?.stock ?? 0;
                  };
                  return (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-2">Хэмжээ:</div>
                      <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => {
                          const st = getStock(s);
                          const disabled = st <= 0;
                          const active = selSize === s;
                          return (
                            <button
                              key={s}
                              disabled={disabled}
                              onClick={() => setSelSize(s)}
                              className={[
                                "px-3 py-1.5 rounded-full text-sm border",
                                disabled
                                  ? "opacity-40 cursor-not-allowed"
                                  : active
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Сонгосон хувилбар */}
                {(() => {
                  const selected =
                    pickerVars.find(
                      (v) =>
                        (!selColor || colorKeyOf(v) === selColor) &&
                        (!selSize || (v.size || "—") === selSize)
                    ) || null;

                  const showColor = selColor ? colorLabel(selColor) : "—";
                  const showSize = selSize ?? "—";
                  const canAdd = !!selected && selected.stock > 0;

                  return (
                    <>
                      <div className="flex items-center justify-between text-sm mt-1 mb-3">
                        <div className="text-gray-800">
                          <span className="text-gray-500">
                            Сонгосон хувилбар:{" "}
                          </span>
                          <span className="font-medium">
                            {showColor} / {showSize}
                          </span>
                        </div>
                        <div className="text-blue-600">
                          Боломжит:{" "}
                          <span className="font-semibold">
                            {selected?.stock ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setPicker(null)}
                          className="px-3 py-1.5 text-sm rounded-md border"
                        >
                          Хаах
                        </button>
                        <button
                          disabled={!canAdd}
                          onClick={() => {
                            if (!selected) return;
                            setItems((prev) => {
                              const i = prev.findIndex(
                                (it) => it.variant_id === selected.id
                              );
                              if (i > -1) {
                                const copy = [...prev];
                                copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
                                return copy;
                              }
                              return [
                                {
                                  id: picker!.productId,
                                  variant_id: selected.id,
                                  name: picker!.name,
                                  price: selected.price,
                                  qty: 1,
                                  imgPath: picker!.img || "/default.png",
                                  size: selected.size,
                                  color: colorLabel(colorKeyOf(selected)),
                                } as CartItem,
                                ...prev,
                              ];
                            });
                            setPicker(null);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-black text-white disabled:opacity-40"
                        >
                          Сагслах
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* {showPrintConfirm && printPayload && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold mb-3">Баталгаажуулах</h2>
            <div className="mb-4">
              <div className="font-medium mb-2">
                Та дараах барааг хэвлэх гэж байна:
              </div>
              <ul className="space-y-2 mb-2">
                {printPayload.items.map((it, idx) => (
                  <li
                    key={it.id + "-" + (it as any).variant_id + "-" + idx}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {it.name} ({it.size || "—"}, {it.color || "—"}) × {it.qty}
                    </span>
                    <span>{fmt(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>Нийт:</span>
                <span>{fmt(printPayload.total)}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPrintConfirm(false)}
                className="px-4 py-2 rounded-lg border bg-gray-50"
              >
                Цуцлах
              </button>
              <button
                onClick={confirmPrint}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
              >
                Баталгаажуулах
              </button>
            </div>
          </div>
        </div>
      )} */}

      <DraftManagerDialog
        open={openDraftManager}
        onClose={() => setOpenDraftManager(false)}
        onLoadDraft={(draftItems) => setItems(draftItems)}
      />

      {/* Enhanced Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-right-full duration-300">
          <div
            className={`px-6 py-4 rounded-lg shadow-xl backdrop-blur-sm border max-w-sm ${
              notification.type === "success"
                ? "bg-green-50 text-green-800 border-green-200"
                : notification.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === "success" && (
                  <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                {notification.type === "error" && (
                  <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
                {notification.type === "info" && (
                  <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 text-sm font-medium leading-relaxed">
                {notification.message}
              </div>
              <button
                onClick={() => setNotification(null)}
                className={`flex-shrink-0 p-1 rounded-full transition-colors ${
                  notification.type === "success"
                    ? "text-green-400 hover:text-green-600 hover:bg-green-100"
                    : notification.type === "error"
                    ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                    : "text-blue-400 hover:text-blue-600 hover:bg-blue-100"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
