"use client";

import React, { useState, useEffect } from 'react';
import { useProducts, useProductsByStore } from "@/lib/hooks/useProducts";
import { useInventoryAdjustment } from "@/lib/hooks/useInventoryAdjustment";
import { useCurrentStore } from "@/lib/hooks/useStore";

// Toast функц (энгийн alert-ийг орлуулна)
const toast = {
  success: (message: string) => alert(`✅ ${message}`),
  error: (message: string) => alert(`❌ ${message}`)
};

interface InventoryAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProductId?: string;
  preselectedVariantId?: string;
}

interface ProductVariant {
  id: string;
  name: string;
  current_stock: number;
  product_name: string;
}

export function InventoryAdjustmentModal({
  open,
  onOpenChange,
  preselectedProductId,
  preselectedVariantId
}: InventoryAdjustmentModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [reason, setReason] = useState<"ADJUSTMENT" | "PURCHASE" | "INITIAL">("ADJUSTMENT");
  
  const { selectedStore } = useCurrentStore();
  const inventoryAdjustment = useInventoryAdjustment();

  // Use different hooks based on whether we have a store ID
  const { data: globalProducts, isLoading: globalLoading } = useProducts({ limit: 500 });
  const { data: storeProducts, isLoading: storeLoading } = useProductsByStore(
    selectedStore?.id || '', 
    500
  );

  // Use store-specific products if available, otherwise fall back to global
  const products = selectedStore?.id ? storeProducts : globalProducts;
  const productsLoading = selectedStore?.id ? storeLoading : globalLoading;



  // Ensure products is an array - handle different API response structures
  let productsList: any[] = [];
  if (Array.isArray(products)) {
    productsList = products;
  } else if (products && typeof products === 'object') {
    // Check if products has an array property (common API pattern)
    if (Array.isArray(products.data)) {
      productsList = products.data;
    } else if (Array.isArray(products.items)) {
      productsList = products.items;
    } else if (Array.isArray(products.products)) {
      productsList = products.products;
    }
  }

  // Get variants for the selected product
  const selectedProductData = productsList.find((p: any) => p.id === selectedProduct);
  const variants: ProductVariant[] = selectedProductData?.variants?.map((v: any) => ({
    id: v.id,
    name: v.name || v.value || 'Default',
    current_stock: v.current_stock || 0,
    product_name: selectedProductData.name
  })) || [];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedProduct(preselectedProductId || "");
      setSelectedVariant(preselectedVariantId || "");
      setAdjustmentQuantity(0);
      setNote("");
      setReason("ADJUSTMENT");
    }
  }, [open, preselectedProductId, preselectedVariantId]);

  const selectedVariantData = variants.find(v => v.id === selectedVariant);

  const handleSubmit = async () => {
    if (!selectedStore?.id) {
      toast.error("Дэлгүүр сонгоогүй байна");
      return;
    }

    if (!selectedVariant) {
      toast.error("Барааны хувилбар сонгоогүй байна");
      return;
    }

    if (adjustmentQuantity === 0) {
      toast.error("Тоо ширхэг оруулна уу");
      return;
    }

    try {
      await inventoryAdjustment.mutateAsync({
        store_id: selectedStore.id,
        variant_id: selectedVariant,
        delta: adjustmentQuantity,
        reason,
        note: note || `${adjustmentQuantity > 0 ? 'Нэмэгдүүлэх' : 'Хасах'}: ${Math.abs(adjustmentQuantity)} ширхэг`,
      });

      toast.success(
        `${selectedVariantData?.product_name} (${selectedVariantData?.name}) - ${adjustmentQuantity > 0 ? 'нэмэгдлээ' : 'хасагдлаа'}: ${Math.abs(adjustmentQuantity)} ширхэг`
      );
      
      onOpenChange(false);
    } catch (error) {
      toast.error("Алдаа гарлаа: " + (error instanceof Error ? error.message : 'Тодорхойгүй алдаа'));
    }
  };

  const handleQuickAdjust = (amount: number) => {
    setAdjustmentQuantity(prev => prev + amount);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Барааны тоо ширхэг тохируулах</h2>
            <p className="text-sm text-gray-600 mt-1">
              Барааны хувилбар сонгоод тоо ширхэгийг нэмэгдүүлэх эсвэл хасах
            </p>
          </div>

          <div className="space-y-4">
            {/* Product Selection */}
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
                Бараа
              </label>
              <select
                id="product"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Бараа сонгох...</option>
                {productsLoading ? (
                  <option disabled>Ачааллаж байна...</option>
                ) : (
                  productsList.map((product: any) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Variant Selection */}
            {selectedProduct && (
              <div>
                <label htmlFor="variant" className="block text-sm font-medium text-gray-700 mb-1">
                  Хувилбар
                </label>
                <select
                  id="variant"
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Хувилбар сонгох...</option>
                  {variants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name} (Одоогийн: {variant.current_stock})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Current Stock Display */}
            {selectedVariantData && (
              <div className="p-3 bg-gray-100 rounded-lg">
                <div className="text-sm font-medium">
                  Одоогийн үлдэгдэл: {selectedVariantData.current_stock} ширхэг
                </div>
              </div>
            )}

            {/* Adjustment Quantity */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Тоо ширхэг (+/-)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(-1)}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  -
                </button>
                <input
                  id="quantity"
                  type="number"
                  value={adjustmentQuantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjustmentQuantity(parseInt(e.target.value) || 0)}
                  className="flex-1 p-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => handleQuickAdjust(1)}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  +
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Эерэг тоо - нэмэгдүүлэх, сөрөг тоо - хасах
              </div>
            </div>

            {/* Quick Adjustment Buttons */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAdjustmentQuantity(1)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">+1</button>
              <button type="button" onClick={() => setAdjustmentQuantity(5)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">+5</button>
              <button type="button" onClick={() => setAdjustmentQuantity(10)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">+10</button>
              <button type="button" onClick={() => setAdjustmentQuantity(-1)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">-1</button>
              <button type="button" onClick={() => setAdjustmentQuantity(-5)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">-5</button>
              <button type="button" onClick={() => setAdjustmentQuantity(-10)} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50">-10</button>
            </div>

            {/* Reason Selection */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Шалтгаан
              </label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as "ADJUSTMENT" | "PURCHASE" | "INITIAL")}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ADJUSTMENT">Тохируулга</option>
                <option value="PURCHASE">Худалдан авалт</option>
                <option value="INITIAL">Анхны үлдэгдэл</option>
              </select>
            </div>

            {/* Note */}
            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">
                Тэмдэглэл (сонголт)
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                placeholder="Нэмэлт тэмдэглэл..."
                rows={2}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Preview */}
            {selectedVariantData && adjustmentQuantity !== 0 && (
              <div className="p-3 border rounded-lg bg-blue-50">
                <div className="text-sm font-medium mb-1">Урьдчилсан харагдац:</div>
                <div className="text-sm">
                  {selectedVariantData.current_stock} → {selectedVariantData.current_stock + adjustmentQuantity}
                  <span className={`ml-2 ${adjustmentQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({adjustmentQuantity > 0 ? '+' : ''}{adjustmentQuantity})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Цуцлах
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedVariant || adjustmentQuantity === 0 || inventoryAdjustment.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inventoryAdjustment.isPending ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}