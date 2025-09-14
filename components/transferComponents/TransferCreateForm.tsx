"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, X, Search, Package, Trash2, ChevronDown } from "lucide-react";
import { createTransfer } from "@/lib/transfer/transferApi";
import {
  getProductVariantsByStore,
  getProductByStore,
} from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getProductDetail} from "@/lib/product/productDetail";
import { getImageShowUrl } from "@/lib/product/productImages";
import Image from "next/image";

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

type Store = {
  id: string;
  name: string;
};

type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_name?: string;
  attrs?: {
    color?: string;
    size?: string;
  };
  qty?: number;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  img?: string;
  rawImg?: string; // Raw image path for URL resolution
};

type ProductWithVariants = {
  product: Product;
  variants: ProductVariant[];
};

type TransferFormProps = {
  stores: Store[];
  onSuccess: () => void;
  onCancel: () => void;
};

type TransferItemForm = {
  variant_id: string;
  qty: number;
  name?: string;
  sku?: string;
  color?: string;
  size?: string;
  price?: number;
};

export default function TransferCreateForm({
  stores,
  onSuccess,
  onCancel,
}: TransferFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    src_store_id: "",
    dst_store_id: "",
    note: "",
    allow_negative: false,
  });
  const [items, setItems] = useState<TransferItemForm[]>([
    { variant_id: "", qty: 1 },
  ]);
  const [error, setError] = useState<string>("");

  // Variant selection modal state
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [loadingVariants, setLoadingVariants] = useState(false);

  // Load products when source store changes
  useEffect(() => {
    if (formData.src_store_id) {
      loadProductsForStore(formData.src_store_id);
    } else {
      setVariants([]);
    }
  }, [formData.src_store_id]);

  const loadProductsForStore = async (storeId: string) => {
    setLoadingProducts(true);
    setError("");
    try {
      const token = await getAccessToken();

      // Use the same approach as inventory page for better compatibility
      const raw = await getProductByStore(token, storeId);
      const items = Array.isArray(raw.items) ? raw.items : [];

      const storeVariants: ProductVariant[] = [];
      const uniqueProducts = new Map<string, Product>();

      // Convert inventory items to variants format and collect unique products
      for (const item of items) {
        if (!item?.variant_id || !item?.product) continue;

        const variant = item.variant || {};
        const product = item.product || {};

        // Add to unique products
        if (!uniqueProducts.has(product.id)) {
          uniqueProducts.set(product.id, {
            id: product.id,
            name: product.name || "(нэргүй)",
            description: product.description,
            img: product.img,
            rawImg: product.img, // Store raw path for URL resolution
          });
        }

        storeVariants.push({
          id: String(item.variant_id),
          name: `${product.name || "(нэргүй)"}${
            variant.name && variant.name !== product.name
              ? ` - ${variant.name}`
              : ""
          }`,
          sku: variant.sku || "",
          price: variant.price || 0,
          product_name: product.name,
        });
      }

      setVariants(storeVariants);
      
      // Resolve image URLs for all products
      const productsArray = Array.from(uniqueProducts.values());
      const productsWithUrls = await Promise.all(
        productsArray.map(async (product) => {
          const resolvedImg = (await resolveImageUrl(product.rawImg)) || "/default.png";
          return {
            ...product,
            img: resolvedImg,
          };
        })
      );
      
      setProducts(productsWithUrls);

      // Clear selected items since available products changed
      setItems([{ variant_id: "", qty: 1 }]);
    } catch (err) {
      console.error("Error loading store products:", err);
      setError(
        "Дэлгүүрийн барааны мэдээлэл татахад алдаа гарлаа: " +
          (err instanceof Error ? err.message : String(err))
      );
      setVariants([]);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Function to open variant selection modal
  const openVariantSelection = async (productId: string, itemIndex: number) => {
    if (!productId) return;

    setSelectedItemIndex(itemIndex);
    setSelectedColor("");
    setSelectedSize("");
    setLoadingVariants(true);
    setShowVariantModal(true);

    try {
      const token = await getAccessToken();
      const productDetail = await getProductDetail(productId, token);
      
      // Resolve product image URL
      if (productDetail?.product?.img) {
        const resolvedImageUrl = await resolveImageUrl(productDetail.product.img);
        productDetail.product.img = resolvedImageUrl || "/default.png";
      }
      
      setSelectedProduct(productDetail);
    } catch (err) {
      console.error("Error loading product variants:", err);
      setError("Барааны мэдээлэл татахад алдаа гарлаа");
      setShowVariantModal(false);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Function to close variant selection modal
  const closeVariantSelection = () => {
    setShowVariantModal(false);
    setSelectedProduct(null);
    setSelectedColor("");
    setSelectedSize("");
    setLoadingVariants(false);
  };

  // Function to confirm variant selection
  const confirmVariantSelection = () => {
    if (!selectedProduct || !selectedColor || !selectedSize) return;

    const selectedVariant = selectedProduct.variants.find(
      (variant) => 
        variant.attrs?.color === selectedColor && 
        variant.attrs?.size === selectedSize
    );

    if (!selectedVariant) return;

    // Update the item with selected variant
    const newItems = [...items];
    newItems[selectedItemIndex] = {
      ...newItems[selectedItemIndex],
      variant_id: selectedVariant.id,
      name: `${selectedProduct.product.name} (${selectedColor}, ${selectedSize})`,
      sku: selectedVariant.sku,
      color: selectedColor,
      size: selectedSize,
      price: selectedVariant.price,
    };
    setItems(newItems);

    closeVariantSelection();
  };

  const addItem = () => {
    setItems([...items, { variant_id: "", qty: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (
    index: number,
    field: keyof TransferItemForm,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.src_store_id || !formData.dst_store_id) {
      setError("Дэлгүүрүүдийг сонгоно уу");
      return;
    }

    if (formData.src_store_id === formData.dst_store_id) {
      setError("Өөр өөр дэлгүүр сонгоно уу");
      return;
    }

    const validItems = items.filter((item) => item.variant_id && item.qty > 0);
    if (validItems.length === 0) {
      setError("Хамгийн багадаа нэг бараа нэмэх шаардлагатай");
      return;
    }

    // Check if all selected variants exist
    const invalidVariants = validItems.filter(
      (item) => !variants.find((v: ProductVariant) => v.id === item.variant_id)
    );
    if (invalidVariants.length > 0) {
      setError("Сонгосон зарим бараа олдсонгүй. Дахин сонгоно уу.");
      return;
    }

    // Check stock availability (unless negative transfers are allowed)
    if (!formData.allow_negative) {
      const stockErrors: string[] = [];
      
      for (const item of validItems) {
        const variant = variants.find((v: ProductVariant) => v.id === item.variant_id);
        const availableStock = variant?.qty || 0;
        
        if (item.qty > availableStock) {
          const productName = item.name || variant?.name || "Тодорхойгүй бараа";
          stockErrors.push(`${productName}: ${item.qty} ширхэг хүсэж байна, харин ${availableStock} ширхэг л байна`);
        }
      }
      
      if (stockErrors.length > 0) {
        setError("Нөөц хүрэлцэхгүй байна:\n" + stockErrors.join("\n"));
        return;
      }
    }

    setLoading(true);
    try {
      await createTransfer({
        src_store_id: formData.src_store_id,
        dst_store_id: formData.dst_store_id,
        items: validItems,
        note: formData.note || undefined,
        allow_negative: formData.allow_negative,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  // Filter products and variants based on search query
  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return product.name.toLowerCase().includes(query);
  });

  const filteredVariants = variants.filter((variant) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      variant.name.toLowerCase().includes(query) ||
      variant.sku.toLowerCase().includes(query) ||
      (variant.product_name &&
        variant.product_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Шинэ шилжүүлэг үүсгэх
        </h2>
        <p className="text-gray-600">
          Дэлгүүрүүдийн хооронд бараа шилжүүлэх хүсэлт үүсгэх
        </p>

        {/* Debug Information */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="font-medium text-blue-800 mb-1">Debug мэдээлэл:</div>
          <div className="text-blue-700 space-y-1">
            <div>Дэлгүүр: {stores.length} ширхэг</div>
            <div>Сонгогдсон дэлгүүрийн бүтээгдэхүүн: {products.length} ширхэг</div>
            <div>Сонгогдсон дэлгүүрийн вариант: {variants.length} ширхэг</div>
            {searchQuery && (
              <div>
                Шүүлтүүрийн дараах бүтээгдэхүүн: {filteredProducts.length} ширхэг
              </div>
            )}
            <div>Илгээх дэлгүүр: {formData.src_store_id || "Сонгогдоогүй"}</div>
            {loadingProducts && (
              <div className="text-blue-600 font-medium">
                🔄 Барааны жагсаалт ачааллаж байна...
              </div>
            )}
            {formData.src_store_id &&
              !loadingProducts &&
              products.length === 0 && (
                <div className="text-red-600 font-medium">
                  ⚠️ Сонгогдсон дэлгүүрт бараа олдсонгүй!
                </div>
              )}
            {!formData.src_store_id && (
              <div className="text-yellow-600 font-medium">
                💡 Эхлээд илгээх дэлгүүрийг сонгоно уу
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Source and Destination Stores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="src_store"
              className="block text-sm font-medium text-gray-700"
            >
              Илгээх дэлгүүр
            </label>
            <select
              id="src_store"
              value={formData.src_store_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, src_store_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Дэлгүүр сонгох</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="dst_store"
              className="block text-sm font-medium text-gray-700"
            >
              Хүлээн авах дэлгүүр
            </label>
            <select
              id="dst_store"
              value={formData.dst_store_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setFormData({ ...formData, dst_store_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Дэлгүүр сонгох</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700">
              Шилжүүлэх барааны жагсаалт
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={
                !formData.src_store_id ||
                loadingProducts ||
                products.length === 0
              }
              title={
                !formData.src_store_id
                  ? "Эхлээд илгээх дэлгүүрийг сонгоно уу"
                  : loadingProducts
                  ? "Бараа ачааллаж байна..."
                  : products.length === 0
                  ? "Энэ дэлгүүрт бараа байхгүй байна"
                  : ""
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Бараа нэмэх
            </button>
          </div>

          {/* Search filter for products */}
          {formData.src_store_id && products.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Бүтээгдэхүүн хайх
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Бүтээгдэхүүний нэрээр хайх..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchQuery && (
                <div className="text-sm text-gray-600">
                  {filteredProducts.length} / {products.length} бүтээгдэхүүн олдлоо
                </div>
              )}
            </div>
          )}

          {/* Product Grid Display */}
          {formData.src_store_id && !loadingProducts && products.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Бүтээгдэхүүн сонгох (зураг)
                </label>
                <div className="text-sm text-gray-600">
                  {filteredProducts.length} бүтээгдэхүүн олдлоо
                </div>
              </div>
              
              <div className="max-h-80 overflow-y-auto bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => {
                    const productVariants = variants.filter(v => v.product_name === product.name);
                    const totalStock = productVariants.reduce((sum, v) => sum + (v.qty || 0), 0);
                    
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => openVariantSelection(product.id, items.findIndex(item => !item.variant_id) !== -1 ? items.findIndex(item => !item.variant_id) : items.length - 1)}
                        className="group text-left p-3 rounded-xl border shadow-sm transition-all duration-200 bg-white hover:shadow-md hover:scale-105"
                        title={`${product.name} - Дарж variant сонгох`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative">
                            <Image
                              src={product.img || "/default.png"}
                              alt={product.name}
                              width={64}
                              height={64}
                              className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                              unoptimized
                            />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              +
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-900 truncate w-full">
                              {product.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {productVariants.length} variant
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Product loading and status messages */}
          {!formData.src_store_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Илгээх дэлгүүрийг сонгоно уу
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Дээр илгээх дэлгүүрийг сонгосны дараа тухайн дэлгүүрийн
                      барааны жагсаалт автоматаар ачаалагдана.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loadingProducts && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div className="ml-3 text-sm text-blue-700">
                  Дэлгүүрийн барааны жагсаалт ачааллаж байна...
                </div>
              </div>
            </div>
          )}

          {formData.src_store_id &&
            !loadingProducts &&
            variants.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Сонгогдсон дэлгүүрт бараа байхгүй байна
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Энэ дэлгүүрт шилжүүлэх бараа байхгүй байна. Эхлээд тус
                        дэлгүүрт бараа нэмнэ үү.
                        <a
                          href="/inventory"
                          className="font-medium underline hover:text-yellow-600 ml-1"
                          target="_blank"
                        >
                          Бараа нэмэх хуудас руу очих →
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    Бүтээгдэхүүн
                  </label>
                  
                  {/* Show selected product card or selection button */}
                  {item.variant_id && item.name ? (
                    /* Selected Product Card */
                    <div className="relative group">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm">
                        <div className="flex items-center gap-4">
                          {/* Product Image */}
                          <div className="w-16 h-16 rounded-xl bg-white border-2 border-white shadow-md overflow-hidden flex-shrink-0">
                            {(() => {
                              const product = products.find(p => 
                                variants.some(v => v.id === item.variant_id && v.product_name === p.name)
                              );
                              return product?.img ? (
                                <Image
                                  src={product.img}
                                  alt={product.name}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                  <Package className="w-8 h-8 text-gray-400" />
                                </div>
                              );
                            })()}
                          </div>
                          
                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-lg mb-1 truncate">
                              {item.name}
                            </div>
                            <div className="space-y-1">
                              {item.sku && (
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <span className="font-medium">SKU:</span>
                                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">{item.sku}</span>
                                </div>
                              )}
                              {item.color && item.size && (
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    {item.color}
                                  </span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    {item.size}
                                  </span>
                                </div>
                              )}
                              {item.price && (
                                <div className="text-lg font-bold text-green-600">
                                  ₮{item.price.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Stock Info & Actions */}
                          <div className="flex flex-col items-end gap-2">
                            {(() => {
                              const variant = variants.find(v => v.id === item.variant_id);
                              const stock = variant?.qty || 0;
                              return (
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">Нөөц</div>
                                  <div className={`px-2 py-1 rounded-full text-sm font-semibold ${
                                    stock > 0 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {stock} ширхэг
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Change Button */}
                            <button
                              type="button"
                              onClick={() => {
                                // Clear current selection and open modal for new selection
                                const emptyItem = { ...item, variant_id: "", name: "", sku: "", color: "", size: "", price: 0 };
                                const newItems = [...items];
                                newItems[index] = emptyItem;
                                setItems(newItems);
                              }}
                              className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                            >
                              Өөрчлөх
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Product Selection Button */
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.src_store_id && products.length > 0) {
                          // Open product grid or first available product for selection
                          const firstProduct = filteredProducts[0];
                          if (firstProduct) {
                            openVariantSelection(firstProduct.id, index);
                          }
                        }
                      }}
                      disabled={
                        !formData.src_store_id ||
                        loadingProducts ||
                        products.length === 0
                      }
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group"
                    >
                      <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-blue-600">
                        <div className="w-12 h-12 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                          <Plus className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-medium">
                          {!formData.src_store_id
                            ? "Эхлээд илгээх дэлгүүрийг сонгоно уу"
                            : loadingProducts
                            ? "Бараа ачааллаж байна..."
                            : products.length === 0
                            ? "Энэ дэлгүүрт бараа байхгүй байна"
                            : filteredProducts.length === 0 && searchQuery
                            ? "Хайлтанд тохирох бараа олдсонгүй"
                            : "Бүтээгдэхүүн сонгох"}
                        </div>
                        {products.length > 0 && (
                          <div className="text-xs text-gray-400">
                            {filteredProducts.length} бүтээгдэхүүн боломжтой
                          </div>
                        )}
                      </div>
                    </button>
                  )}
                  
                  {/* Selected variant info with image */}
                  {item.variant_id && item.name && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        {/* Product Image */}
                        <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                          {(() => {
                            const product = products.find(p => 
                              variants.some(v => v.id === item.variant_id && v.product_name === p.name)
                            );
                            return product?.img ? (
                              <Image
                                src={product.img}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Product Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            {item.sku && (
                              <div>SKU: <span className="font-mono">{item.sku}</span></div>
                            )}
                            {item.color && item.size && (
                              <div>
                                <span className="inline-flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                  {item.color}
                                </span>
                                {" • "}
                                <span className="inline-flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                  {item.size}
                                </span>
                              </div>
                            )}
                            {item.price && (
                              <div className="font-semibold text-green-600">
                                ₮{item.price.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Stock Info */}
                        {(() => {
                          const variant = variants.find(v => v.id === item.variant_id);
                          const stock = variant?.qty || 0;
                          return (
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Нөөц</div>
                              <div className={`text-sm font-semibold ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stock} ширхэг
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="w-32">
                  <label className="block text-sm text-gray-600 mb-1">
                    Тоо ширхэг
                  </label>
                  {(() => {
                    const variant = variants.find(v => v.id === item.variant_id);
                    const maxStock = variant?.qty || 0;
                    const hasExceeded = item.qty > maxStock;
                    
                    return (
                      <div className="space-y-1">
                        <input
                          type="number"
                          min="1"
                          max={maxStock || undefined}
                          value={item.qty}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const newQty = parseInt(e.target.value) || 1;
                            updateItem(index, "qty", newQty);
                          }}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                            hasExceeded 
                              ? "border-red-300 focus:ring-red-500 bg-red-50" 
                              : "border-gray-300 focus:ring-blue-500"
                          }`}
                          title={maxStock > 0 ? `Дээд хэмжээ: ${maxStock} ширхэг` : "Нөөц байхгүй"}
                        />
                        {item.variant_id && maxStock > 0 && (
                          <div className="text-xs">
                            {hasExceeded ? (
                              <span className="text-red-600 font-medium">
                                ⚠️ Нөөцөөс хэтрэв! (Дээд: {maxStock})
                              </span>
                            ) : (
                              <span className="text-gray-500">
                                Дээд: {maxStock} ширхэг
                              </span>
                            )}
                          </div>
                        )}
                        {item.variant_id && maxStock === 0 && (
                          <div className="text-xs text-red-600 font-medium">
                            ❌ Нөөц дууссан
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="flex items-center justify-center h-10 w-10 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label
            htmlFor="note"
            className="block text-sm font-medium text-gray-700"
          >
            Тэмдэглэл (заавал биш)
          </label>
          <textarea
            id="note"
            placeholder="Шилжүүлгийн талаарх нэмэлт мэдээлэл..."
            value={formData.note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setFormData({ ...formData, note: e.target.value })
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Options */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="allow_negative"
            checked={formData.allow_negative}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({ ...formData, allow_negative: e.target.checked })
            }
            className="rounded"
          />
          <label htmlFor="allow_negative" className="text-sm text-gray-700">
            Сөрөг тоо ширхэгтэй шилжүүлэхийг зөвшөөрөх
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Цуцлах
          </button>
          {(() => {
            // Check for stock issues in selected items
            const validItems = items.filter((item) => item.variant_id && item.qty > 0);
            const hasStockIssues = !formData.allow_negative && validItems.some(item => {
              const variant = variants.find((v: ProductVariant) => v.id === item.variant_id);
              const availableStock = variant?.qty || 0;
              return item.qty > availableStock;
            });

            const isDisabled = loading ||
              loadingProducts ||
              !formData.src_store_id ||
              products.length === 0 ||
              stores.length < 2 ||
              hasStockIssues;

            return (
              <button
                type="submit"
                disabled={isDisabled}
                className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                  hasStockIssues 
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title={
                  loadingProducts
                    ? "Бараа ачааллаж байна..."
                    : !formData.src_store_id
                    ? "Илгээх дэлгүүрийг сонгоно уу"
                    : products.length === 0
                    ? "Сонгогдсон дэлгүүрт бараа байхгүй байна"
                    : stores.length < 2
                    ? "Хамгийн багадаа 2 дэлгүүр шаардлагатай"
                    : hasStockIssues
                    ? "Нөөц хүрэлцэхгүй байна. 'Сөрөг тоо зөвшөөрөх' сонгоно уу эсвэл тоо хэмжээг багасгана уу."
                    : ""
                }
              >
                {loading 
                  ? "Үүсгэж байна..." 
                  : hasStockIssues 
                  ? "⚠️ Нөөц хүрэлцэхгүй" 
                  : "Шилжүүлэг үүсгэх"
                }
              </button>
            );
          })()}
        </div>
      </form>

      {/* Variant Selection Modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden">
                    {selectedProduct?.product.img ? (
                      <Image
                        src={selectedProduct.product.img}
                        alt={selectedProduct.product.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedProduct?.product.name || "Бүтээгдэхүүн"}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Өнгө болон хэмжээг сонгоно уу
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeVariantSelection}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingVariants ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Variant-ууд ачааллаж байна...</p>
                  </div>
                </div>
              ) : selectedProduct ? (
                <div className="space-y-6">
                  {/* Product Details Card */}
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-semibold text-gray-900">Variant мэдээлэл</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Нийт variant:</span>
                        <span className="ml-2 font-semibold text-blue-600">{selectedProduct.variants.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Нөөцтэй:</span>
                        <span className="ml-2 font-semibold text-green-600">
                          {selectedProduct.variants.filter(v => v.qty && v.qty > 0).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Color Selection with Swatches */}
                  {(() => {
                    const availableColors = Array.from(
                      new Set(
                        selectedProduct.variants
                          .filter((v) => v.qty && v.qty > 0)
                          .map((v) => v.attrs?.color)
                          .filter(Boolean)
                      )
                    );

                    return availableColors.length > 0 ? (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-400 to-blue-400"></div>
                          Өнгө сонгох:
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {availableColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => {
                                setSelectedColor(color!);
                                setSelectedSize(""); // Reset size when color changes
                              }}
                              className={`p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                                selectedColor === color
                                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border-blue-500 scale-105"
                                  : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200 hover:border-blue-300"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-4 h-4 rounded-full ${selectedColor === color ? 'bg-white/30' : 'bg-gradient-to-r from-red-200 to-blue-200'}`}></div>
                                <span className="font-medium">{color}</span>
                              </div>
                              <div className="text-xs opacity-75">
                                {selectedProduct.variants.filter(
                                  (v) => v.attrs?.color === color && v.qty && v.qty > 0
                                ).length} хувилбар боломжтой
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <p className="text-yellow-800 text-sm">⚠️ Энэ бүтээгдэхүүний нөөцтэй өнгө байхгүй байна.</p>
                      </div>
                    );
                  })()}

                  {/* Size Selection Grid */}
                  {(() => {
                    const availableSizes = Array.from(
                      new Set(
                        selectedProduct.variants
                          .filter(
                            (v) =>
                              v.attrs?.color === selectedColor &&
                              v.qty &&
                              v.qty > 0
                          )
                          .map((v) => v.attrs?.size)
                          .filter(Boolean)
                      )
                    );

                    return selectedColor && availableSizes.length > 0 ? (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4m-4 0l5.657 5.657M20 8V4m0 0h-4m4 0l-5.657 5.657" />
                          </svg>
                          Хэмжээ сонгох:
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {availableSizes.map((size) => {
                            const variant = selectedProduct.variants.find(
                              (v) => v.attrs?.color === selectedColor && v.attrs?.size === size
                            );
                            const stock = variant?.qty || 0;
                            
                            return (
                              <button
                                key={size}
                                onClick={() => setSelectedSize(size!)}
                                className={`p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                                  selectedSize === size
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg border-green-500 scale-105"
                                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200 hover:border-green-300"
                                }`}
                              >
                                <div className="font-bold text-base">{size}</div>
                                <div className="text-xs mt-2 opacity-90">
                                  {stock} ширхэг
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : selectedColor ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <p className="text-yellow-800 text-sm">⚠️ Сонгосон өнгөнд нөөцтэй хэмжээ байхгүй байна.</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Selected Variant Summary */}
                  {selectedColor && selectedSize && (() => {
                    const selectedVariant = selectedProduct.variants.find(
                      (v) =>
                        v.attrs?.color === selectedColor &&
                        v.attrs?.size === selectedSize
                    );

                    return selectedVariant ? (
                      <div className="p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl border-2 border-blue-200 shadow-sm">
                        <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Сонгосон variant:
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              <span className="text-gray-700">Өнгө:</span>
                              <span className="font-semibold text-blue-900">{selectedColor}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <span className="text-gray-700">Хэмжээ:</span>
                              <span className="font-semibold text-green-900">{selectedSize}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700">SKU:</span>
                              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{selectedVariant.sku}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700">Үнэ:</span>
                              <span className="font-bold text-green-700">₮{selectedVariant.price?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700">Нөөц:</span>
                              <span className={`font-semibold ${(selectedVariant.qty || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {selectedVariant.qty || 0} ширхэг
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={closeVariantSelection}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Цуцлах
                </button>
                <button
                  onClick={confirmVariantSelection}
                  disabled={!selectedColor || !selectedSize || loadingVariants}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedColor && selectedSize && !loadingVariants
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {loadingVariants
                    ? "Ачааллаж байна..."
                    : selectedColor && selectedSize
                    ? "Сонгох"
                    : "Өнгө болон хэмжээг сонгоно уу"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
