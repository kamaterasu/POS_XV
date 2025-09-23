"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { updateProduct } from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  created_at: string;
  img: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  attrs: Record<string, any>;
  sku: string | null;
  price: number;
  cost: number | null;
  created_at: string;
  qty?: number;
};

type Category = {
  id: string;
  name: string;
  children?: Category[];
};

type StoreRow = {
  id: string;
  name: string;
};

type InventoryItem = {
  variant_id: string;
  store_id: string;
  qty: number;
};

interface ProductEditFormProps {
  product: Product;
  variants: ProductVariant[];
  categories: Category[];
  stores: StoreRow[];
  storeInventory: Record<string, Record<string, number>>;
  inventoryData: InventoryItem[];
  storeProductData?: Array<{storeId: string, storeName: string, data: any}> | null;
  onSave: (updatedProduct: any) => void;
  onCancel: () => void;
}

export default function ProductEditForm({
  product,
  variants: initialVariants,
  categories,
  stores = [],
  storeInventory = {},
  inventoryData = [],
  storeProductData,
  onSave,
  onCancel,
}: ProductEditFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: product.name || "",
    description: product.description || "",
    category_id: product.category_id || "",
    img: product.img || "",
  });

  // Variant states
  const [variants, setVariants] = useState<ProductVariant[]>(() => {
    // Recalculate qty from inventory data for accurate display
    if (inventoryData && inventoryData.length > 0) {
      return initialVariants.map(variant => ({
        ...variant,
        qty: inventoryData
          .filter(item => item.variant_id === variant.id)
          .reduce((total, item) => total + item.qty, 0)
      }));
    }
    // If no inventory data, keep original variants
    return initialVariants;
  });
  const [variantToRemove, setVariantToRemove] = useState<string[]>([]);

  // Variant selection for editing (like product detail page)
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");

  // Image states
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  // Helper function to get signed URL from storage path
  const getImageUrl = async (path: string): Promise<string> => {
    if (!path) return "/default.png";
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return path;

    try {
      const { data, error } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 7);

      if (error) {
        console.error("Supabase storage error:", error);
        return "/default.png";
      }

      return data?.signedUrl || "/default.png";
    } catch (error) {
      console.error("Error creating signed URL:", error);
      return "/default.png";
    }
  };

  // Initialize image previews
  useState(() => {
    if (product.img) {
      const initializeImageUrl = async () => {
        try {
          setImageError(null);
          const imageUrl = await getImageUrl(product.img!);
          if (imageUrl && imageUrl !== "/default.png") {
            setImagePreviews([imageUrl]);
          } else {
            setImageError("Зураг ачаалахад алдаа гарлаа");
            setImagePreviews(["/default.png"]);
          }
        } catch (error) {
          setImageError("Зураг ачаалахад алдаа гарлаа");
          setImagePreviews(["/default.png"]);
        }
      };
      initializeImageUrl();
    }
  });

  // Initialize selection when variants load
  useState(() => {
    if (variants.length > 0 && !selectedColor && !selectedSize) {
      const firstVariant = variants[0];
      if (firstVariant.attrs?.color) setSelectedColor(firstVariant.attrs.color);
      if (firstVariant.attrs?.size) setSelectedSize(firstVariant.attrs.size);
    }
  });

  const flattenCategories = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    for (const cat of cats) {
      result.push(cat);
      if (cat.children) {
        result.push(...flattenCategories(cat.children));
      }
    }
    return result;
  };

  // Get unique colors and sizes from variants
  const getUniqueColors = (): string[] => {
    const colors = variants
      .map(v => v.attrs?.color)
      .filter(Boolean)
      .filter((color, index, arr) => arr.indexOf(color) === index);
    return colors;
  };

  const getUniqueSizes = (): string[] => {
    const sizes = variants
      .map(v => v.attrs?.size)
      .filter(Boolean)
      .filter((size, index, arr) => arr.indexOf(size) === index);
    return sizes;
  };

  // Get current selected variant based on color and size
  const getCurrentVariant = (): ProductVariant | null => {
    if (!selectedColor && !selectedSize) return variants[0] || null;
    
    return variants.find(v => 
      (!selectedColor || v.attrs?.color === selectedColor) &&
      (!selectedSize || v.attrs?.size === selectedSize)
    ) || variants[0] || null;
  };

  // Helper function to check if color is a hex code
  const isColorHexCode = (color: string) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  // Get available sizes for selected color
  const getAvailableSizesForColor = (color: string) => {
    return variants
      .filter(v => v.attrs?.color === color)
      .map(v => v.attrs?.size)
      .filter(size => size && size.trim() !== "");
  };

  // Store inventory helper function (matches ProductDetail logic)
  const getStoreInventory = (variantId: string, storeId: string): number => {
    // First check the existing storeInventory state
    const existingQty = storeInventory[variantId]?.[storeId];
    if (existingQty !== undefined) {
      return existingQty;
    }
    
    // If not found, check storeProductData from getProductByStore API
    if (storeProductData) {
      const storeData = storeProductData.find(store => store.storeId === storeId);
      if (storeData?.data?.items) {
        const item = storeData.data.items.find((item: any) => item.variant_id === variantId);
        return item?.qty || 0;
      }
    }
    
    return 0;
  };

  // Variant management functions

  const updateVariant = (
    index: number,
    field: keyof ProductVariant,
    value: any
  ) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: value,
    };
    setVariants(updatedVariants);
  };

  const updateVariantAttr = (index: number, attrKey: string, value: string) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      attrs: {
        ...updatedVariants[index].attrs,
        [attrKey]: value,
      },
    };
    setVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    const variant = variants[index];
    if (variant.id && !variant.id.startsWith("temp-")) {
      setVariantToRemove([...variantToRemove, variant.id]);
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Image handling functions (simplified)
  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const url = prev[index];
      if (url && (url.startsWith("blob:") || url.startsWith("data:"))) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      return prev.filter((_, i) => i !== index);
    });

    if (index === 0 && imagePreviews.length > 1) {
      setFormData((prev) => ({ ...prev, img: imagePreviews[1] || "" }));
    } else if (imagePreviews.length === 1) {
      setFormData((prev) => ({ ...prev, img: "" }));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const token = await getAccessToken();

      let uploadedImagePath = formData.img;
      let uploadedImageUrl = formData.img;

      const updateData = {
        id: product.id,
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        img: uploadedImagePath || null,
        upsert_variants: variants.map((variant) => ({
          ...(variant.id && !variant.id.startsWith("temp-")
            ? { id: variant.id }
            : {}),
          name: variant.name || "",
          sku: variant.sku || "",
          price: variant.price,
          cost: variant.cost,
          attrs: variant.attrs || {},
        })),
        remove_variant_ids: variantToRemove,
      };

      const result = await updateProduct(token, updateData);

      if (result.error) {
        setError(result.error);
      } else {
        onSave(result);
        alert("Барааны мэдээлэл амжилттай шинэчлэгдлээ!");
      }
    } catch (e: any) {
      console.error("Error saving product:", e);
      if (
        e.message?.includes("NOT_AUTHENTICATED") ||
        e.message?.includes("AUTHENTICATION_ERROR")
      ) {
        setError("Нэвтрэх шаардлагатай. Дахин нэвтэрнэ үү.");
      } else if (
        e.message?.includes("INVALID_TOKEN_FORMAT") ||
        e.message?.includes("missing part")
      ) {
        setError("Хуучирсан нэвтрэх мэдээлэл. Дахин нэвтэрнэ үү.");
      } else if (e.message?.includes("No tenant_id found")) {
        setError("Байгууллагын мэдээлэл олдсонгүй. Дахин нэвтэрнэ үү.");
      } else {
        setError(e?.message ?? "Хадгалахад алдаа гарлаа.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200 font-medium"
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
          Цуцлах
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Хадгалж байна...
            </>
          ) : (
            <>
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Хадгалах
            </>
          )}
        </button>
      </div>

      {/* Product Card */}
      <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex gap-6">
          {/* Product Image */}
          <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
            {imagePreviews.length > 0 && imagePreviews[0] && imagePreviews[0] !== "/default.png" ? (
              <Image
                src={imagePreviews[0]}
                alt="Product"
                width={128}
                height={128}
                className="object-cover w-full h-full"
                unoptimized={
                  imagePreviews[0].startsWith("blob:") ||
                  imagePreviews[0].startsWith("data:")
                }
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/default.png";
                }}
                onLoad={() => setImageError(null)}
              />
            ) : (
              <span className="text-gray-400 text-sm">зураг</span>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 relative">

            {/* Product Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Барааны нэр
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Барааны нэр оруулна уу"
              />
            </div>

            {/* Product Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Тайлбар
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                placeholder="Барааны тайлбар"
              />
            </div>

            {/* Variant Selection */}
            {variants.length > 0 && (getUniqueColors().length > 0 || getUniqueSizes().length > 0) && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-3">
                  Хувилбар сонгох
                </label>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                  {/* Color Selection */}
                  {getUniqueColors().length > 0 && (
                    <div className="mb-6">
                      <div className="text-sm font-medium text-gray-600 mb-3">Өнгө:</div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => {
                            setSelectedColor("");
                            setSelectedSize("");
                          }}
                          className={`px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                            selectedColor === ""
                              ? "bg-blue-500 text-white border-blue-500 shadow-md"
                              : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
                          }`}
                        >
                          Бүгд
                        </button>
                        {getUniqueColors().map((color) => {
                          // Calculate total stock for this color across all sizes
                          const colorStock = variants
                            .filter(v => v.attrs?.color === color)
                            .reduce((total, variant) => {
                              // Sum inventory across all stores for this variant
                              const variantTotal = stores.reduce((storeTotal, store) => 
                                storeTotal + getStoreInventory(variant.id, store.id), 0
                              );
                              return total + variantTotal;
                            }, 0);
                          
                          return (
                            <button
                              key={color}
                              onClick={() => {
                                setSelectedColor(color);
                                // Reset size selection to first available size for this color
                                const availableSizes = getAvailableSizesForColor(color);
                                if (availableSizes.length > 0) {
                                  setSelectedSize(availableSizes[0]);
                                }
                              }}
                              className={`relative flex items-center gap-2 px-3 py-3 rounded-lg border transition-all ${
                                selectedColor === color
                                  ? 'border-blue-500 bg-blue-50 shadow-md'
                                  : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
                              }`}
                            >
                              <div 
                                className="w-8 h-8 rounded-full border-2 border-white shadow-md flex-shrink-0" 
                                style={{ backgroundColor: isColorHexCode(color) ? color : '#e5e7eb' }}
                              >
                                {!isColorHexCode(color) && (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">
                                    {color.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="text-left">
                                {!isColorHexCode(color) && (
                                  <div className="text-sm font-medium text-gray-700">
                                    {color}
                                  </div>
                                )}
                                <div className={`text-xs ${
                                  colorStock > 0 ? 'text-green-600' : 'text-red-500'
                                }`}>
                                  {colorStock > 0 ? `${colorStock} ширхэг` : 'Дууссан'}
                                </div>
                              </div>
                              {/* Stock indicator dot */}
                              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                                colorStock > 10 
                                  ? 'bg-green-500' 
                                  : colorStock > 0 
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}></div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Selection */}
                  {getUniqueSizes().length > 0 && (
                    <div className="mb-6">
                      <div className="text-sm font-medium text-gray-600 mb-3">Хэмжээ:</div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => setSelectedSize("")}
                          className={`px-4 py-3 text-sm rounded-lg border transition-all ${
                            selectedSize === ""
                              ? 'bg-green-500 text-white border-green-500 shadow-md'
                              : 'bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-400 hover:shadow-sm'
                          }`}
                        >
                          Бүгд
                        </button>
                        {getUniqueSizes().map((size) => {
                          const isAvailable = selectedColor ? getAvailableSizesForColor(selectedColor).includes(size) : true;
                          const sizeVariant = variants.find(v => 
                            (!selectedColor || v.attrs?.color === selectedColor) && v.attrs?.size === size
                          );
                          const sizeStock = sizeVariant ? stores.reduce((total, store) => 
                            total + getStoreInventory(sizeVariant.id, store.id), 0
                          ) : 0;
                          
                          return (
                            <button
                              key={size}
                              onClick={() => isAvailable && setSelectedSize(size)}
                              disabled={!isAvailable}
                              className={`relative px-4 py-3 text-sm rounded-lg border transition-all ${
                                selectedSize === size
                                  ? 'bg-green-500 text-white border-green-500 shadow-md'
                                  : isAvailable
                                  ? 'bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-400 hover:shadow-sm'
                                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                              }`}
                            >
                              <div className="font-medium">{size}</div>
                              {isAvailable && sizeVariant && (
                                <div className={`text-xs mt-1 ${
                                  selectedSize === size ? 'text-green-100' : 'text-gray-500'
                                }`}>
                                  {sizeStock > 0 ? `${sizeStock} ширхэг` : 'Дууссан'}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Store Inventory for Selected Variant */}
                {(() => {
                  const currentVariant = getCurrentVariant();
                  return currentVariant && stores.length > 0 ? (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-gray-600">Сонгогдсон хувилбарын мэдээлэл:</div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-600">
                            {!isColorHexCode(selectedColor || currentVariant.attrs?.color || "") && (selectedColor || currentVariant.attrs?.color)} / {selectedSize || currentVariant.attrs?.size}
                          </span>
                          <span className="font-medium text-green-600">
                            ₮{currentVariant.price.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Current Variant Summary */}
                      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Color indicator */}
                            <div 
                              className="w-6 h-6 rounded-full border-2 border-white shadow-md flex-shrink-0" 
                              style={{ backgroundColor: isColorHexCode(currentVariant.attrs?.color || "") ? currentVariant.attrs?.color : '#e5e7eb' }}
                            >
                              {!isColorHexCode(currentVariant.attrs?.color || "") && currentVariant.attrs?.color && (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">
                                  {currentVariant.attrs.color.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="font-medium text-gray-800">
                              {currentVariant.attrs?.color || "Өнгөгүй"} / {currentVariant.attrs?.size || "Хэмжээгүй"}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              ₮{currentVariant.price?.toLocaleString()}
                            </div>
                            {currentVariant.cost && (
                              <div className="text-sm text-gray-500">
                                Өртөг: ₮{currentVariant.cost.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Store Inventory Details */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-600 mb-2">Салбарын үлдэгдэл:</div>
                        {stores.map((store, storeIndex) => {
                          const qty = getStoreInventory(currentVariant.id, store.id);
                          const storeDisplayName = store.name === "Төв салбар" ? "Төв салбар" : `${store.name || `Салбар-${storeIndex + 1}`}`;
                          
                          return (
                            <div key={store.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  qty > 0 ? "bg-green-500" : "bg-gray-400"
                                }`}></div>
                                <span className="text-sm font-medium text-gray-700">
                                  {storeDisplayName}:
                                </span>
                              </div>
                              <div className="text-right">
                                <span className={`text-lg font-bold ${
                                  qty > 0 ? "text-blue-600" : "text-gray-400"
                                }`}>
                                  {qty}
                                </span>
                                <span className="text-sm text-gray-500 ml-1">ширхэг</span>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Total inventory */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
                            <span className="text-sm font-bold text-gray-800">Нийт үлдэгдэл:</span>
                            <span className="text-xl font-bold text-blue-600">
                              {(() => {
                                const total = stores.reduce((total, store) => total + getStoreInventory(currentVariant.id, store.id), 0);
                                // Debug: Log inventory calculation
                                console.log(`Variant ${currentVariant.id} total inventory:`, total, {
                                  stores: stores.map(s => ({ 
                                    id: s.id, 
                                    name: s.name, 
                                    qty: getStoreInventory(currentVariant.id, s.id) 
                                  })),
                                  inventoryDataForVariant: inventoryData.filter(item => item.variant_id === currentVariant.id),
                                  storeInventoryForVariant: storeInventory[currentVariant.id]
                                });
                                return total;
                              })()} ширхэг
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : currentVariant ? (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-6 h-6 rounded-full border-2 border-white shadow-md flex-shrink-0" 
                            style={{ backgroundColor: isColorHexCode(currentVariant.attrs?.color || "") ? currentVariant.attrs?.color : '#e5e7eb' }}
                          >
                            {!isColorHexCode(currentVariant.attrs?.color || "") && currentVariant.attrs?.color && (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">
                                {currentVariant.attrs.color.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-800">
                            Сонгогдсон: {currentVariant.attrs?.color || "Өнгөгүй"} / {currentVariant.attrs?.size || "Хэмжээгүй"}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            ₮{currentVariant.price?.toLocaleString()}
                          </div>
                          {currentVariant.cost && (
                            <div className="text-sm text-gray-500">
                              Өртөг: ₮{currentVariant.cost.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}


              </div>
            )}

            {/* Category and Date Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Ангилал
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      category_id: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Ангилал сонгоно уу</option>
                  {flattenCategories(categories).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Created Date */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Үүсгэсэн огноо
                </label>
                <div className="text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border">
                  {new Date(product.created_at).toLocaleDateString("mn-MN")}
                </div>
              </div>
            </div>


          </div>
        </div>


      </section>





    </div>
  );
}
