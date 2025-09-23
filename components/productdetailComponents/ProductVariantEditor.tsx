"use client";

import { useState } from "react";
import { ProductVariant } from "@/types/product";
import { StoreRow } from "@/lib/store/storeApi";
import { productAddToInventory } from "@/lib/inventory/inventoryApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";

interface ProductVariantEditorProps {
  variants: ProductVariant[];
  setVariants: (variants: ProductVariant[]) => void;
  stores: StoreRow[];
  storeInventory: Record<string, Record<string, number>>;
  updateStoreInventory: (variantId: string, storeId: string, quantity: number) => void;
  getStoreInventory: (variantId: string, storeId: string) => number;
  inventoryLoading: boolean;
  adjustingInventory: Record<string, boolean>;
  setAdjustingInventory: (adjusting: Record<string, boolean>) => void;
  deltaInputs: Record<string, number>;
  setDeltaInputs: (inputs: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  variantToRemove: string[];
  setVariantToRemove: (ids: string[]) => void;
  addVariant: () => void;
  updateVariant: (index: number, field: keyof ProductVariant, value: any) => void;
  updateVariantAttr: (index: number, attrKey: string, value: string) => void;
  removeVariant: (index: number) => void;
  adjustInventoryByDelta: (variantId: string, storeId: string, delta: number, reason?: "PURCHASE" | "ADJUSTMENT") => void;
}

export default function ProductVariantEditor({
  variants,
  setVariants,
  stores,
  storeInventory,
  updateStoreInventory,
  getStoreInventory,
  inventoryLoading,
  adjustingInventory,
  setAdjustingInventory,
  deltaInputs,
  setDeltaInputs,
  variantToRemove,
  setVariantToRemove,
  addVariant,
  updateVariant,
  updateVariantAttr,
  removeVariant,
  adjustInventoryByDelta,
}: ProductVariantEditorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">
          Хувилбар удирдлага
        </h2>
        <div className="flex gap-3">
          <button
            onClick={addVariant}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            🆕 Шинэ хувилбар нэмэх
          </button>
        </div>
      </div>

      {/* Inventory Loading Indicator */}
      {inventoryLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-700">Үлдэгдлийн мэдээлэл ачаалж байна...</span>
          </div>
        </div>
      )}

      {/* Variants List */}
      <div className="space-y-6">
        {variants.map((variant, index) => {
          const isNewVariant = variant.id.startsWith("temp-");
          return (
            <div
              key={variant.id}
              className={`${
                isNewVariant 
                  ? "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg" 
                  : "bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm"
              } rounded-xl p-6 hover:shadow-md transition-all duration-200 relative`}
            >
              {/* New Variant Badge */}
              {isNewVariant && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse">
                  ШИНЭ
                </div>
              )}
              
              {/* Variant Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isNewVariant 
                      ? "bg-green-100 animate-pulse" 
                      : "bg-blue-100"
                  }`}>
                    <span className={`font-bold text-sm ${
                      isNewVariant ? "text-green-600" : "text-blue-600"
                    }`}>
                      {isNewVariant ? "★" : index + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className={`text-lg font-semibold ${
                      isNewVariant ? "text-green-800" : "text-gray-800"
                    }`}>
                      {isNewVariant && "🆕 "}
                      {variant.attrs?.color && variant.attrs?.size 
                        ? `${variant.attrs.color} / ${variant.attrs.size}`
                        : variant.name || `Хувилбар ${index + 1}`
                      }
                    </h4>
                    <div className={`text-sm ${
                      isNewVariant ? "text-green-600 font-medium" : "text-gray-500"
                    }`}>
                      {isNewVariant 
                        ? "Шинэ хувилбар - хадгалахгүй бол устана" 
                        : new Date(variant.created_at).toLocaleDateString("mn-MN")
                      }
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeVariant(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors group"
                  aria-label="Хувилбар устгах"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Basic Information */}
              <div className="bg-white rounded-lg p-4 mb-6 border border-gray-100">
                <h5 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Үндсэн мэдээлэл
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Color Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Өнгө
                    </label>
                    <input
                      type="text"
                      value={variant.attrs?.color || ""}
                      onChange={(e) =>
                        updateVariantAttr(
                          index,
                          "color",
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Жишээ: Улаан"
                    />
                  </div>

                  {/* Size Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Хэмжээ
                    </label>
                    <input
                      type="text"
                      value={variant.attrs?.size || ""}
                      onChange={(e) =>
                        updateVariantAttr(
                          index,
                          "size",
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Жишээ: XL"
                    />
                  </div>

                  {/* SKU Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      SKU
                    </label>
                    <input
                      type="text"
                      value={variant.sku || ""}
                      onChange={(e) =>
                        updateVariant(index, "sku", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Жишээ: TSH-RED-XL"
                    />
                  </div>

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Нэр
                    </label>
                    <input
                      type="text"
                      value={variant.name || ""}
                      onChange={(e) =>
                        updateVariant(index, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Автоматаар үүсгэгдэнэ"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="bg-white rounded-lg p-4 mb-6 border border-gray-100">
                <h5 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  Үнийн мэдээлэл
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Зарах үнэ (₮)
                    </label>
                    <input
                      type="number"
                      value={variant.price || 0}
                      onChange={(e) =>
                        updateVariant(index, "price", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>

                  {/* Cost */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Өртөг (₮)
                    </label>
                    <input
                      type="number"
                      value={variant.cost || 0}
                      onChange={(e) =>
                        updateVariant(index, "cost", Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0"
                      min="0"
                      step="100"
                    />
                  </div>

                  {/* Total Quantity (readonly) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Нийт үлдэгдэл
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700">
                      {variant.qty || 0} ширхэг
                    </div>
                  </div>
                </div>
              </div>

              {/* Store Inventory Management */}
              {stores.length > 0 && (
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Салбарын үлдэгдэл удирдлага
                    </h5>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stores.map((store, storeIndex) => {
                      const qty = getStoreInventory(variant.id, store.id);
                      const storeDisplayName = store.name === "Төв салбар" ? "Төв салбар" : `${store.name || `Салбар-${storeIndex + 1}`}`;
                      const adjustKey = `${variant.id}-${store.id}`;
                      const deltaValue = deltaInputs[adjustKey] || 0;
                      const isAdjusting = adjustingInventory[adjustKey] || false;
                      
                      return (
                        <div key={store.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                qty > 0 ? "bg-green-500" : "bg-gray-400"
                              }`}></div>
                              <span className="text-sm font-medium text-gray-700">
                                {storeDisplayName}
                              </span>
                            </div>
                            <span className={`text-lg font-bold ${
                              qty > 0 ? "text-blue-600" : "text-gray-400"
                            }`}>
                              {qty}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={deltaValue}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setDeltaInputs(prev => ({...prev, [adjustKey]: value}));
                              }}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="±0"
                              disabled={isAdjusting}
                            />
                            
                            {/* Add button - always show if deltaValue is positive */}
                            {deltaValue > 0 && (
                              <button
                                onClick={() => {
                                  adjustInventoryByDelta(variant.id, store.id, deltaValue);
                                  setDeltaInputs(prev => ({...prev, [adjustKey]: 0}));
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isAdjusting}
                              >
                                {isAdjusting ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    Нэмж байна...
                                  </div>
                                ) : (
                                  "Нэмэх"
                                )}
                              </button>
                            )}
                            
                            {/* Subtract button - always show if deltaValue is not 0 */}
                            {deltaValue !== 0 && (
                              <button
                                onClick={() => {
                                  const subtractAmount = Math.abs(deltaValue);
                                  if (subtractAmount > qty) {
                                    alert(`Алдаа: Хасах тоо (${subtractAmount}) нь одоогийн үлдэгдлээс (${qty}) их байна. Хамгийн ихдээ ${qty} ширхэг хасч болно.`);
                                    return;
                                  }
                                  // Use the absolute value as negative delta for subtracting
                                  adjustInventoryByDelta(variant.id, store.id, -subtractAmount);
                                  setDeltaInputs(prev => ({...prev, [adjustKey]: 0}));
                                }}
                                className={`px-3 py-1 text-white text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  Math.abs(deltaValue) > qty 
                                    ? "bg-gray-400 cursor-not-allowed" 
                                    : "bg-red-600 hover:bg-red-700"
                                }`}
                                disabled={isAdjusting || Math.abs(deltaValue) > qty}
                              >
                                {isAdjusting ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    Хасч байна...
                                  </div>
                                ) : (
                                  Math.abs(deltaValue) > qty ? "Үлдэгдэл хүрэхгүй" : "Хасах"
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {(inventoryLoading || Object.values(adjustingInventory).some(Boolean)) && (
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        Үлдэгдлийн мэдээлэл шинэчлэж байна...
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Variant Button (when no variants exist) */}
      {variants.length === 0 && (
        <section className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg p-8 border-2 border-dashed border-green-300 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center animate-pulse">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div className="text-xl font-semibold text-green-800 mb-2">
            🆕 Анхны хувилбар үүсгэх
          </div>
          <div className="text-green-600 mb-6">
            Энэ барааны анхны хувилбарыг үүсгэн эхлүүлэх
          </div>
          <button
            onClick={addVariant}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-3 mx-auto"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            ⭐ Анхны хувилбар үүсгэх
          </button>
        </section>
      )}
    </div>
  );
}
