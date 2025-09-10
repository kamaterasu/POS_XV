"use client";
import { useMemo, useState, useEffect } from "react";
import { Item } from "@/lib/sales/salesTypes";
import { FiHeart } from "react-icons/fi";
import { FaShoppingCart } from "react-icons/fa";
import Image from "next/image";
import { getProductByStore } from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID } from "@/lib/store/storeApi";
import { getImageShowUrl } from "@/lib/product/productImages";

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
    console.error("Failed to sign image url for", path, e);
    return undefined;
  }
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
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fetch products when modal opens
  useEffect(() => {
    if (open && catalog.length === 0) {
      console.log("🛒 AddItemModal - Starting to load products...");
      setLoading(true);
      (async () => {
        try {
          console.log("🛒 AddItemModal - Getting access token...");
          const token = await getAccessToken();
          if (!token) {
            console.error("🛒 AddItemModal - No access token available");
            setCatalog([]);
            return;
          }
          console.log(
            "🛒 AddItemModal - Token obtained:",
            token.substring(0, 20) + "..."
          );

          // Get store ID first, then fetch products by store (includes stock)
          console.log("🛒 AddItemModal - Getting store ID...");
          const storeId = await getStoredID(token);
          if (!storeId) {
            console.warn(
              "🛒 AddItemModal - No store ID available, modal will show empty catalog"
            );
            setCatalog([]);
            return;
          }
          console.log("🛒 AddItemModal - Store ID obtained:", storeId);

          console.log("🛒 AddItemModal - Fetching products by store...");
          const response = await getProductByStore(token, storeId);
          console.log("🛒 AddItemModal - Raw API response:", response);
          console.log(
            "🛒 AddItemModal - Response items count:",
            response?.items?.length || 0
          );

          // Process inventory response to build product catalog
          if (response?.items && response.items.length > 0) {
            console.log("🛒 AddItemModal - Processing inventory items...");
            const productMap = new Map<string, any>();

            // Group inventory items by product
            for (const item of response.items) {
              const product = item.product;
              const variant = item.variant;

              console.log("🛒 Processing item:", {
                product: product?.name,
                variant: variant?.name,
                qty: item.qty,
              });

              if (!product?.id || !variant?.id) {
                console.warn(
                  "🛒 Skipping item - missing product or variant ID:",
                  item
                );
                continue;
              }

              if (!productMap.has(product.id)) {
                productMap.set(product.id, {
                  id: product.id,
                  name: product.name,
                  img: product.img || "/default.png",
                  rawImg: product.img, // Store original path for URL resolution
                  variants: [],
                });
              }

              // Add variant with stock from inventory
              productMap.get(product.id).variants.push({
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
                stock: item.qty || 0, // Stock from inventory
                price: variant.price || 0,
                name: variant.name,
                sku: variant.sku,
                attrs: variant.attrs,
              });
            }

            const products: Product[] = Array.from(productMap.values());

            console.log("🛒 AddItemModal - Product map size:", productMap.size);
            console.log("🛒 AddItemModal - Resolving image URLs...");

            // Resolve image URLs for all products
            const productsWithUrls: Product[] = await Promise.all(
              products.map(async (product) => ({
                ...product,
                img: (await resolveImageUrl(product.rawImg)) || "/default.png",
              }))
            );

            console.log(
              "🛒 AddItemModal - Processed products with resolved images:",
              productsWithUrls
            );
            console.log(
              "🛒 AddItemModal - Total products:",
              productsWithUrls.length
            );
            productsWithUrls.forEach((p, i) => {
              console.log(
                `🛒 Product ${i + 1}: ${p.name} (${
                  p.variants.length
                } variants) - Image: ${p.img}`
              );
              p.variants.forEach((v, j) => {
                console.log(
                  `  🛒 Variant ${j + 1}: ${v.color}/${v.size} - Stock: ${
                    v.stock
                  }, Price: ${v.price}`
                );
              });
            });

            setCatalog(productsWithUrls);
            if (productsWithUrls.length > 0) {
              setActiveId(productsWithUrls[0].id);
              console.log(
                "🛒 AddItemModal - Set active product:",
                productsWithUrls[0].name
              );
            }
          } else {
            console.warn(
              "🛒 AddItemModal - No items in response or empty array"
            );
            console.log("🛒 AddItemModal - Response:", response);
            setCatalog([]);
          }
        } catch (error) {
          console.error("🛒 AddItemModal - Error fetching products:", error);
          setCatalog([]);
        } finally {
          console.log(
            "🛒 AddItemModal - Finished loading, setting loading to false"
          );
          setLoading(false);
        }
      })();
    }
  }, [open, catalog.length]);

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
  };
  const selectProduct = (id: string) => {
    setActiveId(id);
    resetSelection();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const selectedVariant: Variant | null = useMemo(() => {
    if (!active || !selColor || !selSize) return null;
    return (
      active.variants.find((v) => v.color === selColor && v.size === selSize) ??
      null
    );
  }, [active, selColor, selSize]);

  const remaining = selectedVariant?.stock ?? 0;
  const canAdd = !!active && !!selectedVariant && qty > 0 && qty <= remaining;

  const handleAdd = () => {
    if (!canAdd || !active || !selectedVariant) {
      console.warn("🛒 Cannot add item:", {
        canAdd,
        active: !!active,
        selectedVariant: !!selectedVariant,
      });
      return;
    }

    console.log("🛒 Adding item to cart:", {
      product: active.name,
      variant: selectedVariant.variant_id,
      color: selectedVariant.color,
      size: selectedVariant.size,
      qty,
      price: selectedVariant.price,
    });

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
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900/40 via-blue-900/40 to-indigo-900/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 overscroll-contain text-black"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-5xl bg-white/95 backdrop-blur-md
          h-[90dvh] md:h-auto md:max-h-[90vh]
          rounded-t-3xl md:rounded-3xl
          shadow-2xl border border-white/20 flex flex-col overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50 shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              <h2 className="text-xl font-bold text-gray-900">
                Бүтээгдэхүүн сонгох
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
              <div className="p-4 border-b border-gray-200/50 shrink-0">
                <div className="relative">
                  <input
                    className="h-12 w-full border-2 border-gray-200 rounded-xl px-4 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="Хайх: нэр, код"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
                <div className="flex flex-wrap gap-2 mt-4">
                  {["Бүгд", "Гутал", "Амал драк хүргэв", "Цамц", "Цүнх"].map(
                    (t, i) => (
                      <button
                        key={t}
                        className={
                          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 " +
                          (i === 0
                            ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200")
                        }
                      >
                        {t}
                      </button>
                    )
                  )}
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
                ) : (
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
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            className="px-4 py-8 text-center text-gray-500"
                            colSpan={2}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <svg
                                className="w-8 h-8 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33"
                                />
                              </svg>
                              <span>Илэрц олдсонгүй.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-4 shrink-0 flex justify-center">
                <button
                  type="button"
                  className="relative w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200"
                  title="Сагс"
                >
                  <FaShoppingCart className="w-6 h-6 text-white" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 text-xs rounded-full bg-red-500 text-white flex items-center justify-center font-bold shadow-lg">
                    1
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div className="bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
              <div className="p-6 border-b border-gray-200/50 shrink-0 flex items-start gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-sm text-gray-500 overflow-hidden shadow-sm">
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
                      className="w-8 h-8"
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
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-all duration-200"
                >
                  <FiHeart className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 border-b border-gray-200/50 shrink-0">
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
