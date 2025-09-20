"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loading } from "@/components/Loading";
import { getProductById, updateProduct } from "@/lib/product/productApi";
import { getCategories } from "@/lib/category/categoryApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { uploadProductImageOnly } from "@/lib/product/productImages";
import { getStore, StoreRow } from "@/lib/store/storeApi";
import { supabase } from "@/lib/supabaseClient";
import { getInventoryForProduct, InventoryItem, productAddToInventory } from "@/lib/inventory/inventoryApi";

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

type ProductData = {
  product: Product;
  variants?: ProductVariant[];
};

type Category = {
  id: string;
  name: string;
  children?: Category[];
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // Helper function to validate if a string is a valid URL for Next.js Image component
  const isValidImageUrl = (url: string): boolean => {
    if (!url || url === "/default.png") return true;

    // Check if it's a relative path starting with /
    if (url.startsWith("/")) return true;

    // Check if it's an absolute URL
    if (url.startsWith("http://") || url.startsWith("https://")) return true;

    // Check if it's a blob or data URL
    if (url.startsWith("blob:") || url.startsWith("data:")) return true;

    // If it's none of the above, it's probably a storage path that needs conversion
    return false;
  };

  // Helper function to get signed URL from storage path
  const getImageUrl = async (path: string): Promise<string> => {
    if (!path) return "/default.png";

    // If it's already a full URL, return it
    if (path.startsWith("http")) return path;

    // If it's a local path starting with /, return it
    if (path.startsWith("/")) return path;

    // If it's a storage path, create signed URL
    try {
      const { data, error } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

      if (error) {
        console.error("Supabase storage error:", error);
        return "/default.png";
      }

      if (!data?.signedUrl) {
        console.error("No signed URL returned");
        return "/default.png";
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Error creating signed URL:", error);
      return "/default.png";
    }
  };

  const [data, setData] = useState<ProductData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "",
    img: "",
  });

  // Variant states
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantToRemove, setVariantToRemove] = useState<string[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<
    number | null
  >(null);

  // Store management
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeInventory, setStoreInventory] = useState<Record<string, Record<string, number>>>({});
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [adjustingInventory, setAdjustingInventory] = useState<Record<string, boolean>>({});

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get token first and validate
        const token = await getAccessToken();

        // Fetch product data, categories, stores, and inventory in parallel
        const [productResult, categoriesResult, storesResult] = await Promise.all([
          getProductById(token, String(id), { withVariants: true }),
          getCategories(token),
          getStore(token),
        ]);

        if (alive) {
          if (productResult.error) {
            setError(productResult.error);
          } else {
            setData(productResult);
            setFormData({
              name: productResult.product.name || "",
              description: productResult.product.description || "",
              category_id: productResult.product.category_id || "",
              img: productResult.product.img || "",
            });

            // Initialize variants
            if (productResult.variants) {
              setVariants(productResult.variants);
              
              // Fetch inventory data for this product
              setInventoryLoading(true);
              try {
                const inventoryItems = await getInventoryForProduct(token, productResult.product.tenant_id, String(id));
                setInventoryData(inventoryItems);
                
                // Process inventory data into the format we need
                const inventoryMap: Record<string, Record<string, number>> = {};
                inventoryItems.forEach(item => {
                  if (!inventoryMap[item.variant_id]) {
                    inventoryMap[item.variant_id] = {};
                  }
                  inventoryMap[item.variant_id][item.store_id] = item.qty;
                });
                setStoreInventory(inventoryMap);
                
                // Update variants with total qty
                const updatedVariants = productResult.variants.map(variant => ({
                  ...variant,
                  qty: inventoryItems
                    .filter(item => item.variant_id === variant.id)
                    .reduce((total, item) => total + item.qty, 0)
                }));
                setVariants(updatedVariants);
              } catch (inventoryError) {
                console.warn('Failed to load inventory:', inventoryError);
              } finally {
                setInventoryLoading(false);
              }
            }

            // Initialize image previews with current product images
            if (productResult.product.img) {
              // Convert storage path to signed URL for display
              const initializeImageUrl = async () => {
                try {
                  setImageError(null);
                  const imageUrl = await getImageUrl(productResult.product.img);
                  if (imageUrl && imageUrl !== "/default.png") {
                    setImagePreviews([imageUrl]);
                  } else {
                    setImageError("Зураг ачаалахад алдаа гарлаа");
                    setImagePreviews(["/default.png"]);
                  }
                } catch (error) {
                  // Зураг ачаалахад алдаа гарсан ч алдаа гаргахгүй
                  setImageError("Зураг ачаалахад алдаа гарлаа");
                  setImagePreviews(["/default.png"]);
                }
              };
              initializeImageUrl();
            }
          }

          // Handle categories result
          try {

            // Handle different possible response structures
            let categoryData = [];
            if (categoriesResult.tree) {
              categoryData = categoriesResult.tree;
            } else if (categoriesResult.categories) {
              categoryData = categoriesResult.categories;
            } else if (Array.isArray(categoriesResult)) {
              categoryData = categoriesResult;
            }

            setCategories(categoryData);
          } catch (e) {
            console.warn("Failed to process categories:", e);
          }

          // Handle stores result
          try {
            if (Array.isArray(storesResult)) {
              setStores(storesResult);
            }
          } catch (e) {
            console.warn("Failed to process stores:", e);
          }
        }
      } catch (e: any) {
        if (alive) {
          console.error("Error in product detail:", e);

          // Handle specific error types
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
            setError(e?.message ?? "Алдаа гарлаа.");
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setUploadingImages(true);

      // Get token first
      const token = await getAccessToken();

      let uploadedImagePath = formData.img;
      let uploadedImageUrl = formData.img;

      // Upload new images if any
      if (imageFiles.length > 0) {
        try {
          const uploadResult = await uploadProductImageOnly(imageFiles[0], {
            prefix: "product_img",
          });
          uploadedImagePath = uploadResult.path; // Store path in database
          uploadedImageUrl = uploadResult.signedUrl; // Use signed URL for display
        } catch (e) {
          // Зураг upload алдаа гарсан ч алдаа гаргахгүй
          alert("Зураг upload хийхэд алдаа гарлаа.");
          setUploadingImages(false);
          return;
        }
      }

      const updateData = {
        id: String(id),
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        img: uploadedImagePath || null, // Store the path in database
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

      const result = await updateProduct(token, updateData); // Fixed: pass token as first parameter

      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        setVariants(result.variants || []);
        setVariantToRemove([]);
        setIsEditing(false);
        setImageFiles([]);
        // Update previews with the new uploaded image URL or keep existing one
        if (uploadedImageUrl) {
          setImagePreviews([uploadedImageUrl]);
        } else if (result.product.img) {
          // Convert the storage path to signed URL for display
          try {
            const imageUrl = await getImageUrl(result.product.img);
            if (imageUrl && imageUrl !== "/default.png") {
              setImagePreviews([imageUrl]);
            } else {
              setImageError("Зураг ачаалахад алдаа гарлаа");
              setImagePreviews(["/default.png"]);
            }
          } catch (error) {
            // Зураг ачаалахад алдаа гарсан ч алдаа гаргахгүй
            setImageError("Зураг ачаалахад алдаа гарлаа");
            setImagePreviews(["/default.png"]);
          }
        } else {
          setImagePreviews([]);
        }
        alert("Барааны мэдээлэл амжилттай шинэчлэгдлээ!");
      }
    } catch (e: any) {
      console.error("Error saving product:", e);

      // Handle specific error types
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
      setUploadingImages(false);
    }
  };

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

  // Variant management functions
  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: `temp-${Date.now()}`, // Temporary ID for new variants
      product_id: String(id),
      name: "",
      sku: "",
      price: variants.length > 0 ? variants[0].price : 0,
      cost: variants.length > 0 ? variants[0].cost : null,
      attrs: {
        color: "",
        size: "",
      },
      created_at: new Date().toISOString(),
      qty: 0,
    };
    setVariants([...variants, newVariant]);
  };

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
      // Mark existing variant for removal
      setVariantToRemove([...variantToRemove, variant.id]);
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Store inventory management functions
  const updateStoreInventory = (variantId: string, storeId: string, quantity: number) => {
    setStoreInventory(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [storeId]: quantity,
      },
    }));
  };

  const getStoreInventory = (variantId: string, storeId: string): number => {
    return storeInventory[variantId]?.[storeId] ?? 0;
  };

  // New function to handle inventory adjustments
  const adjustInventory = async (variantId: string, storeId: string, newQuantity: number, reason: "PURCHASE" | "ADJUSTMENT" = "ADJUSTMENT") => {
    const currentQuantity = getStoreInventory(variantId, storeId);
    const delta = newQuantity - currentQuantity;
    
    if (delta === 0) return;

    const adjustKey = `${variantId}-${storeId}`;
    setAdjustingInventory(prev => ({ ...prev, [adjustKey]: true }));

    try {
      const token = await getAccessToken();
      
      await productAddToInventory(token, {
        store_id: storeId,
        variant_id: variantId,
        delta: delta,
        reason: reason,
        note: `Manual adjustment: ${delta > 0 ? '+' : ''}${delta}`,
      });

      // Update local state
      updateStoreInventory(variantId, storeId, newQuantity);
      
      // Update variant total quantity
      const updatedVariants = variants.map(variant => {
        if (variant.id === variantId) {
          const newTotal = stores.reduce((total, store) => {
            const storeQty = store.id === storeId ? newQuantity : getStoreInventory(variantId, store.id);
            return total + storeQty;
          }, 0);
          return { ...variant, qty: newTotal };
        }
        return variant;
      });
      setVariants(updatedVariants);

      // Show success message
      alert(`Үлдэгдэл амжилттай шинэчлэгдлээ! (${delta > 0 ? '+' : ''}${delta})`);
      
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      alert('Үлдэгдэл өөрчлөхөд алдаа гарлаа: ' + (error as Error).message);
    } finally {
      setAdjustingInventory(prev => ({ ...prev, [adjustKey]: false }));
    }
  };

  // Bulk inventory adjustment
  const bulkAdjustInventory = async (variantId: string, adjustments: Record<string, number>) => {
    setInventoryLoading(true);
    try {
      const token = await getAccessToken();
      
      // Execute all adjustments in parallel
      const promises = Object.entries(adjustments).map(async ([storeId, newQuantity]) => {
        const currentQuantity = getStoreInventory(variantId, storeId);
        const delta = newQuantity - currentQuantity;
        
        if (delta !== 0) {
          await productAddToInventory(token, {
            store_id: storeId,
            variant_id: variantId,
            delta: delta,
            reason: "ADJUSTMENT",
            note: `Bulk adjustment: ${delta > 0 ? '+' : ''}${delta}`,
          });
        }
        
        return { storeId, newQuantity };
      });

      const results = await Promise.all(promises);
      
      // Update local state with all changes
      results.forEach(({ storeId, newQuantity }) => {
        updateStoreInventory(variantId, storeId, newQuantity);
      });
      
      // Update variant total quantity
      const newTotal = Object.values(adjustments).reduce((sum, qty) => sum + qty, 0);
      const updatedVariants = variants.map(variant => 
        variant.id === variantId ? { ...variant, qty: newTotal } : variant
      );
      setVariants(updatedVariants);

      alert('Бүх салбарын үлдэгдэл амжилттай шинэчлэгдлээ!');
      
    } catch (error) {
      console.error('Error in bulk adjustment:', error);
      alert('Үлдэгдэл өөрчлөхөд алдаа гарлаа: ' + (error as Error).message);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) return;

    const fileArr = Array.from(files);
    const accepted = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    const maxSizeMB = 8;

    const urls: string[] = [];
    const picked: File[] = [];

    for (const f of fileArr) {
      if (!accepted.includes(f.type)) {
        alert(`Дэмжигдэхгүй төрөл: ${f.name}`);
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        alert(`Хэт том файл (${maxSizeMB}MB+): ${f.name}`);
        continue;
      }
      // Create blob URL for immediate preview
      urls.push(URL.createObjectURL(f));
      picked.push(f);
    }

    if (!picked.length) return;

    setImagePreviews((prev) => [...prev, ...urls]);
    setImageFiles((prev) => [...prev, ...picked]);

    if (imgInputRef.current) imgInputRef.current.value = "";
  };

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
    setImageFiles((prev) => prev.filter((_, i) => i !== index));

    // If removing from existing images, update form data
    if (index === 0 && imagePreviews.length > 1) {
      setFormData((prev) => ({ ...prev, img: imagePreviews[1] || "" }));
    } else if (imagePreviews.length === 1) {
      setFormData((prev) => ({ ...prev, img: "" }));
    }
  };

  if (loading) return <Loading open label="Ачаалж байна…" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 md:p-6">
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <header className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all duration-200 backdrop-blur-sm"
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Буцах
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Барааны дэлгэрэнгүй
                  </h1>
                  <p className="text-blue-100 text-sm font-mono mt-1">
                    ID: {id}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 border border-transparent transition-all duration-200 font-medium shadow-sm"
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
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Засах
                  </button>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        setIsEditing(false);
                        setImageFiles([]);
                        setImageError(null);
                        setVariantToRemove([]);
                        if (data) {
                          setFormData({
                            name: data.product.name || "",
                            description: data.product.description || "",
                            category_id: data.product.category_id || "",
                            img: data.product.img || "",
                          });
                          setVariants(data.variants || []);
                          // Convert storage path to signed URL for display
                          if (data.product.img) {
                            try {
                              const imageUrl = await getImageUrl(
                                data.product.img
                              );
                              if (imageUrl && imageUrl !== "/default.png") {
                                setImagePreviews([imageUrl]);
                              } else {
                                setImageError("Зураг ачаалахад алдаа гарлаа");
                                setImagePreviews(["/default.png"]);
                              }
                            } catch (error) {
                              console.error(
                                "Error loading image on reset:",
                                error
                              );
                              setImageError("Зураг ачаалахад алдаа гарлаа");
                              setImagePreviews(["/default.png"]);
                            }
                          } else {
                            setImagePreviews([]);
                          }
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all duration-200 font-medium backdrop-blur-sm"
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
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
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

            {!data ? (
              <div className="text-center py-24">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-10 h-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">Өгөгдөл олдсонгүй.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Product Card */}
                <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
                      {imagePreviews.length > 0 &&
                      imagePreviews[0] &&
                      imagePreviews[0] !== "/default.png" &&
                      isValidImageUrl(imagePreviews[0]) ? (
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
                            // Зураг ачаалахад алдаа гарсан ч алдаа гаргахгүй - default.png fallback ашиглана
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
                      {isEditing && (
                        <button
                          onClick={() => imgInputRef.current?.click()}
                          className="absolute top-0 right-0 p-2 rounded-full hover:bg-gray-100 border border-gray-200 bg-white shadow-sm transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-gray-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      )}

                      {/* Product Name */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          Барааны нэр
                        </label>
                        {isEditing ? (
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
                        ) : (
                          <div className="text-xl font-bold text-gray-900">
                            {data.product.name}
                          </div>
                        )}
                      </div>

                      {/* Product Description */}
                      {(isEditing || data.product.description) && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-600 mb-2">
                            Тайлбар
                          </label>
                          {isEditing ? (
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
                          ) : (
                            <div className="text-gray-700 text-base leading-relaxed">
                              {data.product.description || "Тайлбар байхгүй"}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Category and Date Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Category */}
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">
                            Ангилал
                          </label>
                          {isEditing ? (
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
                          ) : (
                            <div className="text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border">
                              {data.product.category_id
                                ? flattenCategories(categories).find(
                                    (c) => c.id === data.product.category_id
                                  )?.name ||
                                  `Тодорхойгүй (${data.product.category_id})`
                                : "Ангилал байхгүй"}
                            </div>
                          )}
                        </div>

                        {/* Created Date */}
                        <div>
                          <label className="block text-sm font-medium text-gray-600 mb-2">
                            Үүсгэсэн огноо
                          </label>
                          <div className="text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border">
                            {new Date(
                              data.product.created_at
                            ).toLocaleDateString("mn-MN")}
                          </div>
                        </div>
                      </div>

                      {/* Hidden file input */}
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>

                  {/* Image Upload Section (when editing) */}
                  {isEditing && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="text-base font-medium mb-4 text-gray-700">
                        Зураг солих
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="url"
                          value={formData.img}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              img: e.target.value,
                            }))
                          }
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Зургийн холбоос оруулах"
                        />
                        <span className="text-gray-500 font-medium">эсвэл</span>
                        <button
                          type="button"
                          onClick={() => imgInputRef.current?.click()}
                          className="px-6 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition-colors shadow-sm"
                          disabled={uploadingImages}
                        >
                          {uploadingImages ? "Ачаалж байна..." : "Файл сонгох"}
                        </button>
                      </div>
                      {imageError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                          {imageError}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Product Variants Section */}
                {(variants.length > 0 || isEditing) && (
                  <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                    {isEditing && (
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-900">
                          Хувилбар удирдлага
                        </h2>
                        <div className="flex gap-3">
                          <button
                            onClick={addVariant}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-sm"
                          >
                            + Хувилбар нэмэх
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inventory Loading Indicator */}
                    {inventoryLoading && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-blue-700">Үлдэгдлийн мэдээлэл ачаалж байна...</span>
                        </div>
                      </div>
                    )}

                    {/* Selected Variant Display */}
                    {!isEditing &&
                      selectedVariantIndex !== null &&
                      variants[selectedVariantIndex] && (
                        <div className="mb-4 bg-white border border-[#efefef] p-3 rounded-md">
                          <div className="text-sm text-[#6b6b6b]">
                            Сонгосон хувилбар:
                          </div>
                          <div className="mt-2 flex justify-between">
                            <div>
                              <div className="text-sm font-semibold">
                                {variants[selectedVariantIndex].attrs?.color ||
                                  "N/A"}{" "}
                                /{" "}
                                {variants[selectedVariantIndex].attrs?.size ||
                                  "N/A"}
                              </div>
                              <div className="text-xs text-[#6b6b6b] mt-1">
                                SKU:{" "}
                                {variants[selectedVariantIndex].sku || "N/A"}
                              </div>
                            </div>
                            <div className="text-sm text-[#6b6b6b]">
                              Нийт үлдэгдэл:{" "}
                              <span className={`font-semibold ${
                                (variants[selectedVariantIndex].qty || 0) > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}>
                                {variants[selectedVariantIndex].qty || 0}
                              </span>
                            </div>
                          </div>

                          {/* Store Inventory */}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#444]">
                            {stores.map((store) => {
                              const qty = getStoreInventory(variants[selectedVariantIndex].id, store.id);
                              return (
                                <div key={store.id} className="flex justify-between">
                                  <span>{store.name}:</span>
                                  <span className={`font-semibold ${
                                    qty > 0 ? "text-green-600" : "text-gray-400"
                                  }`}>
                                    {qty}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Product Variant Selection (View Mode Only) */}
                    {!isEditing && variants.length > 0 && (
                      <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-6 rounded-xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                          Хувилбар сонгох
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Color Selection */}
                          <div>
                            <div className="text-base font-semibold mb-3 text-gray-800">
                              Өнгө
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {[
                                ...new Set(
                                  variants
                                    .map((v) => v.attrs?.color)
                                    .filter(Boolean)
                                ),
                              ].map((color) => (
                                <button
                                  key={color}
                                  onClick={() => {
                                    const variantIndex = variants.findIndex(
                                      (v) =>
                                        v.attrs?.color === color &&
                                        (selectedVariantIndex === null ||
                                          variants[selectedVariantIndex]?.attrs
                                            ?.size === v.attrs?.size)
                                    );
                                    setSelectedVariantIndex(
                                      variantIndex >= 0 ? variantIndex : 0
                                    );
                                  }}
                                  className={`px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                                    selectedVariantIndex !== null &&
                                    variants[selectedVariantIndex]?.attrs
                                      ?.color === color
                                      ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                                  }`}
                                >
                                  {color}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Size Selection */}
                          <div>
                            <div className="text-base font-semibold mb-3 text-gray-800">
                              Хэмжээ
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {[
                                ...new Set(
                                  variants
                                    .map((v) => v.attrs?.size)
                                    .filter(Boolean)
                                ),
                              ].map((size) => (
                                <button
                                  key={size}
                                  onClick={() => {
                                    const variantIndex = variants.findIndex(
                                      (v) =>
                                        v.attrs?.size === size &&
                                        (selectedVariantIndex === null ||
                                          variants[selectedVariantIndex].attrs
                                            ?.color === v.attrs?.color)
                                    );
                                    setSelectedVariantIndex(
                                      variantIndex >= 0 ? variantIndex : 0
                                    );
                                  }}
                                  className={`px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 ${
                                    selectedVariantIndex !== null &&
                                    variants[selectedVariantIndex]?.attrs
                                      ?.size === size
                                      ? "border-green-600 bg-green-50 text-green-800 font-semibold"
                                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                                  }`}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Selected Variant Details */}
                        {selectedVariantIndex !== null &&
                          variants[selectedVariantIndex] && (
                            <div className="mt-6 pt-6 border-t border-blue-200">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                  <div className="text-sm font-medium text-gray-600 mb-1">
                                    SKU
                                  </div>
                                  <div className="font-mono text-gray-900 font-semibold">
                                    {variants[selectedVariantIndex].sku ||
                                      "SKU байхгүй"}
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                  <div className="text-sm font-medium text-gray-600 mb-1">
                                    Үнэ
                                  </div>
                                  <div className="text-lg font-bold text-green-600">
                                    ₮
                                    {variants[
                                      selectedVariantIndex
                                    ].price.toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                  <div className="text-sm font-medium text-gray-600 mb-1">
                                    Өртөг
                                  </div>
                                  <div className="text-gray-700 font-semibold">
                                    {variants[selectedVariantIndex].cost !==
                                    null
                                      ? `₮${variants[
                                          selectedVariantIndex
                                        ].cost.toLocaleString()}`
                                      : "Өртөг байхгүй"}
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                  <div className="text-sm font-medium text-gray-600 mb-1">
                                    Үлдэгдэл
                                  </div>
                                  <div
                                    className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                                      (variants[selectedVariantIndex].qty ||
                                        0) > 0
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {variants[selectedVariantIndex].qty || 0}
                                  </div>
                                </div>
                              </div>

                              {/* Store Inventory */}
                              <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <div className="text-sm font-medium text-gray-600 mb-3">
                                  Салбарын үлдэгдэл
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                  {stores.map((store) => (
                                    <div
                                      key={store.id}
                                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                                    >
                                      <span className="text-gray-700 font-medium">
                                        {store.name}
                                      </span>
                                      <span className="font-bold text-gray-900 bg-white px-2 py-1 rounded">
                                        {getStoreInventory(variants[selectedVariantIndex].id, store.id)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Edit Mode - Variant Management */}
                    {isEditing && (
                      <div className="space-y-3">
                        {variants.map((variant, index) => (
                          <div
                            key={variant.id}
                            className="bg-white border border-[#efefef] p-3 rounded-md"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              {/* Color Input */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  Өнгө:
                                </div>
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
                                  className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                  placeholder="Өнгө оруулах"
                                />
                              </div>

                              {/* Size Input */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  Хэмжээ:
                                </div>
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
                                  className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                  placeholder="Хэмжээ оруулах"
                                />
                              </div>

                              {/* SKU */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  SKU:
                                </div>
                                <input
                                  type="text"
                                  value={variant.sku || ""}
                                  onChange={(e) =>
                                    updateVariant(index, "sku", e.target.value)
                                  }
                                  className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                  placeholder="SKU код"
                                />
                              </div>

                              {/* Price */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  Үнэ:
                                </div>
                                <input
                                  type="number"
                                  value={variant.price}
                                  onChange={(e) =>
                                    updateVariant(
                                      index,
                                      "price",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                  placeholder="0"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                            </div>

                            {/* Second row - Cost, Stock, Actions */}
                            <div className="mt-3 pt-2 border-t border-[#f0f0f0] grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Cost */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  Өртөг:
                                </div>
                                <input
                                  type="number"
                                  value={variant.cost || ""}
                                  onChange={(e) =>
                                    updateVariant(
                                      index,
                                      "cost",
                                      e.target.value
                                        ? Number(e.target.value)
                                        : null
                                    )
                                  }
                                  className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                  placeholder="0"
                                  min="0"
                                  step="0.01"
                                />
                              </div>

                              {/* Total Stock */}
                              <div>
                                <div className="text-xs text-[#6b6b6b] mb-1">
                                  Нийт үлдэгдэл:
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
                                      (variant.qty || 0) > 0
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {variant.qty || 0}
                                  </div>
                                  {inventoryLoading && (
                                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    // Auto-generate name and SKU from color/size
                                    const color = variant.attrs?.color || "";
                                    const size = variant.attrs?.size || "";
                                    if (color && size) {
                                      updateVariant(
                                        index,
                                        "name",
                                        `${color} / ${size}`
                                      );
                                      updateVariant(
                                        index,
                                        "sku",
                                        `${
                                          data?.product.name
                                            ?.substring(0, 3)
                                            .toUpperCase() || "PRD"
                                        }-${color
                                          .substring(0, 2)
                                          .toUpperCase()}-${size}`
                                      );
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs border border-blue-200 hover:bg-blue-200 transition-colors"
                                  title="Өнгө/хэмжээнээс нэр болон SKU автомат үүсгэх"
                                >
                                  🔄 Auto
                                </button>
                                <button
                                  onClick={() => removeVariant(index)}
                                  className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                                  aria-label="Хувилбар устгах"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Store Inventory Management */}
                            <div className="mt-3 pt-2 border-t border-[#f0f0f0]">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-[#6b6b6b]">
                                  Салбар тус бүрийн үлдэгдэл:
                                </div>
                                <button
                                  onClick={() => {
                                    const adjustments: Record<string, number> = {};
                                    stores.forEach(store => {
                                      const currentQty = getStoreInventory(variant.id, store.id);
                                      const newQty = prompt(`${store.name}-ийн үлдэгдэл:`, currentQty.toString());
                                      if (newQty !== null && !isNaN(parseInt(newQty))) {
                                        adjustments[store.id] = parseInt(newQty);
                                      }
                                    });
                                    if (Object.keys(adjustments).length > 0) {
                                      bulkAdjustInventory(variant.id, adjustments);
                                    }
                                  }}
                                  className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200 transition-colors"
                                  disabled={inventoryLoading}
                                >
                                  Бүгдийг засах
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {stores.map((store) => {
                                  const qty = getStoreInventory(variant.id, store.id);
                                  const adjustKey = `${variant.id}-${store.id}`;
                                  const isAdjusting = adjustingInventory[adjustKey];
                                  
                                  return (
                                    <div
                                      key={store.id}
                                      className="flex items-center gap-2 p-2 bg-gray-50 rounded border"
                                    >
                                      <span className="text-xs text-[#6b6b6b] flex-1 font-medium">
                                        {store.name}:
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={qty}
                                          onChange={(e) => {
                                            const newQty = parseInt(e.target.value) || 0;
                                            updateStoreInventory(variant.id, store.id, newQty);
                                          }}
                                          onBlur={(e) => {
                                            const newQty = parseInt(e.target.value) || 0;
                                            const currentQty = getStoreInventory(variant.id, store.id);
                                            if (newQty !== currentQty) {
                                              adjustInventory(variant.id, store.id, newQty);
                                            }
                                          }}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              const newQty = parseInt((e.target as HTMLInputElement).value) || 0;
                                              const currentQty = getStoreInventory(variant.id, store.id);
                                              if (newQty !== currentQty) {
                                                adjustInventory(variant.id, store.id, newQty);
                                              }
                                              (e.target as HTMLInputElement).blur();
                                            }
                                          }}
                                          className="w-16 px-2 py-1 border border-[#e6e6e6] rounded text-xs text-center focus:outline-none focus:border-[#bcd0ff] bg-white"
                                          min="0"
                                          placeholder="0"
                                          disabled={isAdjusting || inventoryLoading}
                                        />
                                        {isAdjusting && (
                                          <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {!isAdjusting && qty > 0 && (
                                          <span className="text-xs text-green-600">✓</span>
                                        )}
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={() => adjustInventory(variant.id, store.id, qty + 1)}
                                            className="w-5 h-5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors flex items-center justify-center font-bold"
                                            disabled={isAdjusting || inventoryLoading}
                                            title="Нэмэх"
                                          >
                                            +
                                          </button>
                                          <button
                                            onClick={() => adjustInventory(variant.id, store.id, Math.max(0, qty - 1))}
                                            className="w-5 h-5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors flex items-center justify-center font-bold"
                                            disabled={isAdjusting || inventoryLoading || qty <= 0}
                                            title="Хасах"
                                          >
                                            -
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {(inventoryLoading || Object.values(adjustingInventory).some(Boolean)) && (
                                <div className="mt-2 text-xs text-blue-600 flex items-center gap-2">
                                  <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                  Үлдэгдлийн мэдээлэл шинэчлэж байна...
                                </div>
                              )}
                              
                              {/* Quick Actions */}
                              <div className="mt-3 pt-2 border-t border-[#f5f5f5]">
                                <div className="text-xs text-[#6b6b6b] mb-2">Хурдан үйлдэл:</div>
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    onClick={() => {
                                      const amount = prompt('Бүх салбарт нэмэх тоо:', '10');
                                      if (amount && !isNaN(parseInt(amount))) {
                                        const adjustments: Record<string, number> = {};
                                        stores.forEach(store => {
                                          adjustments[store.id] = getStoreInventory(variant.id, store.id) + parseInt(amount);
                                        });
                                        bulkAdjustInventory(variant.id, adjustments);
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded border border-green-200 hover:bg-green-200 transition-colors font-medium"
                                    disabled={inventoryLoading}
                                  >
                                    + Бүгдэд нэмэх
                                  </button>
                                  <button
                                    onClick={() => {
                                      const amount = prompt('Бүх салбараас хасах тоо:', '1');
                                      if (amount && !isNaN(parseInt(amount))) {
                                        const adjustments: Record<string, number> = {};
                                        stores.forEach(store => {
                                          const current = getStoreInventory(variant.id, store.id);
                                          adjustments[store.id] = Math.max(0, current - parseInt(amount));
                                        });
                                        bulkAdjustInventory(variant.id, adjustments);
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded border border-orange-200 hover:bg-orange-200 transition-colors font-medium"
                                    disabled={inventoryLoading}
                                  >
                                    - Бүгдээс хасах
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Бүх салбарын үлдэгдлийг 0 болгох уу?')) {
                                        const adjustments: Record<string, number> = {};
                                        stores.forEach(store => {
                                          adjustments[store.id] = 0;
                                        });
                                        bulkAdjustInventory(variant.id, adjustments);
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded border border-red-200 hover:bg-red-200 transition-colors font-medium"
                                    disabled={inventoryLoading}
                                  >
                                    Бүгдийг 0 болгох
                                  </button>
                                  <button
                                    onClick={() => {
                                      const amount = prompt('Бүх салбарт тохируулах тоо:', '50');
                                      if (amount && !isNaN(parseInt(amount))) {
                                        const adjustments: Record<string, number> = {};
                                        stores.forEach(store => {
                                          adjustments[store.id] = parseInt(amount);
                                        });
                                        bulkAdjustInventory(variant.id, adjustments);
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded border border-blue-200 hover:bg-blue-200 transition-colors font-medium"
                                    disabled={inventoryLoading}
                                  >
                                    = Бүгдийг тохируулах
                                  </button>
                                </div>
                              </div>
                            </div>
                            {/* Variant Name (auto-generated or manual) */}
                            <div className="mt-3 pt-2 border-t border-[#f0f0f0]">
                              <div className="text-xs text-[#6b6b6b] mb-1">
                                Хувилбарын нэр:
                              </div>
                              <input
                                type="text"
                                value={variant.name || ""}
                                onChange={(e) =>
                                  updateVariant(index, "name", e.target.value)
                                }
                                className="w-full px-2 py-1 border border-[#e6e6e6] rounded text-sm bg-white focus:outline-none focus:border-[#bcd0ff]"
                                placeholder="Хувилбарын нэр (жишээ: Хар / XL)"
                              />
                            </div>

                            {/* Creation date */}
                            <div className="mt-2 pt-2 border-t border-[#f0f0f0] text-xs text-[#9aa0a6]">
                              Үүсгэсэн:{" "}
                              {new Date(variant.created_at).toLocaleDateString(
                                "mn-MN"
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Add Variant Button (when no variants exist) */}
                {variants.length === 0 && isEditing && (
                  <section className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-blue-600"
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
                    <div className="text-lg font-medium text-gray-600 mb-4">
                      Хувилбар байхгүй байна
                    </div>
                    <button
                      onClick={addVariant}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium shadow-sm"
                    >
                      Анхны хувилбар үүсгэх
                    </button>
                  </section>
                )}

                {/* Debug Section - Collapsible */}
                {data && (
                  <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <summary className="cursor-pointer p-4 text-base font-medium text-gray-700 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100">
                      🔍 Debug: API Response (Click to expand)
                    </summary>
                    <div className="p-4 border-t border-gray-200">
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4">
                        <div className="font-semibold mb-3 text-gray-800">
                          Product Data:
                        </div>
                        <pre className="text-gray-600 overflow-auto max-h-40 text-sm font-mono bg-white p-3 rounded border">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>
                      {categories.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-4">
                          <div className="font-semibold mb-3 text-gray-800">
                            Categories:
                          </div>
                          <pre className="text-gray-600 overflow-auto max-h-32 text-sm font-mono bg-white p-3 rounded border">
                            {JSON.stringify(categories, null, 2)}
                          </pre>
                        </div>
                      )}
                      {inventoryData.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                          <div className="font-semibold mb-3 text-gray-800">
                            Inventory Data:
                          </div>
                          <pre className="text-gray-600 overflow-auto max-h-32 text-sm font-mono bg-white p-3 rounded border">
                            {JSON.stringify(inventoryData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
