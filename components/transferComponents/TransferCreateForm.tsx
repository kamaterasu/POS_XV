"use client";

import { useState, useEffect } from "react";
import { Plus, Minus, X, Search } from "lucide-react";
import { createTransfer } from "@/lib/transfer/transferApi";
import {
  getProductVariantsByStore,
  getProductByStore,
} from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";

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
};

type TransferFormProps = {
  stores: Store[];
  onSuccess: () => void;
  onCancel: () => void;
};

type TransferItemForm = {
  variant_id: string;
  qty: number;
};

export default function TransferCreateForm({
  stores,
  onSuccess,
  onCancel,
}: TransferFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
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
      console.log(`🔄 Loading products for store: ${storeId}`);
      const token = await getAccessToken();

      // Use the same approach as inventory page for better compatibility
      const raw = await getProductByStore(token, storeId);
      const items = Array.isArray(raw.items) ? raw.items : [];

      const storeVariants: ProductVariant[] = [];

      // Convert inventory items to variants format similar to inventory page logic
      for (const item of items) {
        if (!item?.variant_id || !item?.product) continue;

        const variant = item.variant || {};
        const product = item.product || {};

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
      console.log(
        `✅ Loaded ${storeVariants.length} products for store ${storeId}`
      );

      // Clear selected items since available products changed
      setItems([{ variant_id: "", qty: 1 }]);
    } catch (err) {
      console.error("Error loading store products:", err);
      setError(
        "Дэлгүүрийн барааны мэдээлэл татахад алдаа гарлаа: " +
          (err instanceof Error ? err.message : String(err))
      );
      setVariants([]);
    } finally {
      setLoadingProducts(false);
    }
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

  // Filter variants based on search query
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
            <div>Сонгогдсон дэлгүүрийн бараа: {variants.length} ширхэг</div>
            {searchQuery && (
              <div>
                Шүүлтүүрийн дараах бараа: {filteredVariants.length} ширхэг
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
              variants.length === 0 && (
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
          {/* <div className="flex justify-between items-center">
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
                variants.length === 0
              }
              title={
                !formData.src_store_id
                  ? "Эхлээд илгээх дэлгүүрийг сонгоно уу"
                  : loadingProducts
                  ? "Бараа ачааллаж байна..."
                  : variants.length === 0
                  ? "Энэ дэлгүүрт бараа байхгүй байна"
                  : ""
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Бараа нэмэх
            </button>
          </div> */}

          {/* Search filter for products */}
          {formData.src_store_id && variants.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Бараа хайх
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Барааны нэр, SKU эсвэл бүтээгдэхүүний нэрээр хайх..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchQuery && (
                <div className="text-sm text-gray-600">
                  {filteredVariants.length} / {variants.length} бараа олдлоо
                </div>
              )}
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
                    Бараа
                  </label>
                  <select
                    value={item.variant_id}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      updateItem(index, "variant_id", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    disabled={
                      !formData.src_store_id ||
                      loadingProducts ||
                      variants.length === 0
                    }
                  >
                    <option value="">
                      {!formData.src_store_id
                        ? "Эхлээд илгээх дэлгүүрийг сонгоно уу"
                        : loadingProducts
                        ? "Бараа ачааллаж байна..."
                        : variants.length === 0
                        ? "Энэ дэлгүүрт бараа байхгүй байна"
                        : filteredVariants.length === 0 && searchQuery
                        ? "Хайлтанд тохирох бараа олдсонгүй"
                        : "Бараа сонгох"}
                    </option>
                    {filteredVariants.map((variant: ProductVariant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name} ({variant.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-sm text-gray-600 mb-1">
                    Тоо ширхэг
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateItem(index, "qty", parseInt(e.target.value) || 1)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
          <button
            type="submit"
            disabled={
              loading ||
              loadingProducts ||
              !formData.src_store_id ||
              variants.length === 0 ||
              stores.length < 2
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              loadingProducts
                ? "Бараа ачааллаж байна..."
                : !formData.src_store_id
                ? "Илгээх дэлгүүрийг сонгоно уу"
                : variants.length === 0
                ? "Сонгогдсон дэлгүүрт бараа байхгүй байна"
                : stores.length < 2
                ? "Хамгийн багадаа 2 дэлгүүр шаардлагатай"
                : ""
            }
          >
            {loading ? "Үүсгэж байна..." : "Шилжүүлэг үүсгэх"}
          </button>
        </div>
      </form>
    </div>
  );
}
