"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loading } from "@/components/Loading";
import { getProductById, updateProduct } from "@/lib/product/productApi";
import { getProductByStore } from "@/lib/product/productApi";
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
  
  // Variant selection for view mode
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");

  // Store management
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeInventory, setStoreInventory] = useState<Record<string, Record<string, number>>>({});
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [adjustingInventory, setAdjustingInventory] = useState<Record<string, boolean>>({});
  const [deltaInputs, setDeltaInputs] = useState<Record<string, number>>({});
  const [storeProductData, setStoreProductData] = useState<Array<{storeId: string, storeName: string, data: any}> | null>(null);

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

        // Also fetch store-specific product data for better inventory tracking
        if (storesResult && Array.isArray(storesResult) && storesResult.length > 0) {
          try {
            // Fetch inventory data for each store for this product
            const storeProductResults = await Promise.all(
              storesResult.map(async (store) => {
                try {
                  const result = await getProductByStore(token, store.id);
                  // Filter items to only include variants from our current product
                  const filteredItems = result.items?.filter((item: any) => 
                    item.product?.id === String(id)
                  ) || [];
                  
                  return { 
                    storeId: store.id, 
                    storeName: store.name, 
                    data: { ...result, items: filteredItems }
                  };
                } catch (error) {
                  console.warn(`Failed to fetch data for store ${store.name}:`, error);
                  return { storeId: store.id, storeName: store.name, data: null };
                }
              })
            );
            setStoreProductData(storeProductResults);
            console.log('Store-specific product data (filtered):', storeProductResults);
            
            // Initialize store inventory from the fetched data
            const storeInventoryMap: Record<string, Record<string, number>> = {};
            storeProductResults.forEach(({ storeId, data }) => {
              if (data?.items) {
                data.items.forEach((item: any) => {
                  if (!storeInventoryMap[item.variant_id]) {
                    storeInventoryMap[item.variant_id] = {};
                  }
                  storeInventoryMap[item.variant_id][storeId] = item.qty || 0;
                });
              }
            });
            
            // Merge with existing storeInventory state
            setStoreInventory(prev => ({ ...prev, ...storeInventoryMap }));
          } catch (error) {
            console.warn('Failed to fetch store-specific product data:', error);
          }
        }

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
                const updatedVariants = productResult.variants.map((variant: any) => ({
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

  // Helper functions for variant selection
  const getUniqueColors = () => {
    const colors = variants
      .map(v => v.attrs?.color)
      .filter(color => color && color.trim() !== "")
      .filter((color, index, arr) => arr.indexOf(color) === index);
    return colors;
  };

  const getUniqueSizes = () => {
    const sizes = variants
      .map(v => v.attrs?.size)
      .filter(size => size && size.trim() !== "")
      .filter((size, index, arr) => arr.indexOf(size) === index);
    return sizes;
  };

  const getAvailableSizesForColor = (color: string) => {
    return variants
      .filter(v => v.attrs?.color === color)
      .map(v => v.attrs?.size)
      .filter(size => size && size.trim() !== "");
  };

  const getSelectedVariant = () => {
    return variants.find(v => 
      v.attrs?.color === selectedColor && v.attrs?.size === selectedSize
    );
  };

  const isColorHexCode = (color: string) => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  };

  // Initialize selection when variants load
  useEffect(() => {
    if (variants.length > 0 && !selectedColor && !selectedSize) {
      const firstVariant = variants[0];
      if (firstVariant.attrs?.color) setSelectedColor(firstVariant.attrs.color);
      if (firstVariant.attrs?.size) setSelectedSize(firstVariant.attrs.size);
    }
  }, [variants, selectedColor, selectedSize]);

  // New function to handle inventory adjustments with delta
  const adjustInventoryByDelta = async (variantId: string, storeId: string, delta: number, reason: "PURCHASE" | "ADJUSTMENT" = "ADJUSTMENT") => {
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
      const currentQuantity = getStoreInventory(variantId, storeId);
      const newQuantity = currentQuantity + delta;
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
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            🆕 Шинэ хувилбар нэмэх
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

                    {/* Variants Display (View Mode) */}
                    {!isEditing && variants.length > 0 && (
                      <div className="mb-6">
                        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
                          {/* Color Selection */}
                          {getUniqueColors().length > 0 && (
                            <div className="mb-6">
                              <div className="text-sm font-medium text-gray-600 mb-3">Өнгө:</div>
                              <div className="flex flex-wrap gap-3">
                                {getUniqueColors().map((color) => {
                                  // Calculate total stock for this color across all sizes
                                  const colorStock = variants
                                    .filter(v => v.attrs?.color === color)
                                    .reduce((total, variant) => 
                                      total + stores.reduce((storeTotal, store) => 
                                        storeTotal + getStoreInventory(variant.id, store.id), 0
                                      ), 0
                                    );
                                  
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
                                        style={{ backgroundColor: color }}
                                      ></div>
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
                                {getUniqueSizes().map((size) => {
                                  const isAvailable = selectedColor ? getAvailableSizesForColor(selectedColor).includes(size) : true;
                                  const sizeVariant = variants.find(v => 
                                    v.attrs?.color === selectedColor && v.attrs?.size === size
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
                                          ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                                          : isAvailable
                                          ? 'bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-400 hover:shadow-sm'
                                          : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                                      }`}
                                    >
                                      <div className="font-medium">{size}</div>
                                      {isAvailable && sizeVariant && (
                                        <div className={`text-xs mt-1 ${
                                          selectedSize === size ? 'text-blue-100' : 'text-gray-500'
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

                          {/* Store Inventory for Selected Variant */}
                          {selectedColor && selectedSize && stores.length > 0 && (() => {
                            const selectedVariant = getSelectedVariant();
                            return selectedVariant ? (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-sm font-medium text-gray-600">Салбарын үлдэгдэл:</div>
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-600">
                                      {!isColorHexCode(selectedColor) && selectedColor} / {selectedSize}
                                    </span>
                                    <span className="font-medium text-green-600">
                                      ₮{selectedVariant.price.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {stores.map((store, storeIndex) => {
                                    const qty = getStoreInventory(selectedVariant.id, store.id);
                                    const storeDisplayName = store.name === "Төв салбар" ? "Төв салбар" : `${store.name || `Салбар-${storeIndex + 1}`}`;
                                    
                                    return (
                                      <div key={store.id} className="flex items-center justify-between py-2">
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
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}



                    {/* Edit Mode - Variant Management */}
                    {isEditing && (
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

                                {/* SKU */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 mb-2">
                                    SKU код
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

                                {/* Variant Name */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 mb-2">
                                    Хувилбарын нэр
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
                                    Борлуулалтын үнэ
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₮</span>
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
                                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                      placeholder="0"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                </div>

                                {/* Cost */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 mb-2">
                                    Өртөг
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₮</span>
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
                                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                      placeholder="Заавал биш"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                </div>

                                {/* Total Stock Display */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 mb-2">
                                    Нийт үлдэгдэл
                                  </label>
                                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                                    <div
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        (variant.qty || 0) > 0
                                          ? "bg-green-100 text-green-800"
                                          : "bg-red-100 text-red-800"
                                      }`}
                                    >
                                      {variant.qty || 0} ширхэг
                                    </div>
                                    {inventoryLoading && (
                                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    )}
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
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    Салбарын үлдэгдэл
                                  </h5>
                                  <button
                                    onClick={() => {
                                      const deltaAdjustments: Record<string, number> = {};
                                      stores.forEach(store => {
                                        const currentQty = getStoreInventory(variant.id, store.id);
                                        const deltaStr = prompt(`${store.name} (одоо ${currentQty} ширхэг)\nНэмэх/Хасах утга (жишээ: +5, -3):`, "0");
                                        if (deltaStr !== null) {
                                          const delta = parseInt(deltaStr);
                                          if (!isNaN(delta) && delta !== 0) {
                                            deltaAdjustments[store.id] = delta;
                                          }
                                        }
                                      });
                                      if (Object.keys(deltaAdjustments).length > 0) {
                                        Object.entries(deltaAdjustments).forEach(([storeId, delta]) => {
                                          adjustInventoryByDelta(variant.id, storeId, delta);
                                        });
                                      }
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-200 transition-colors disabled:opacity-50"
                                    disabled={inventoryLoading}
                                  >
                                    Бүгдийг засах
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {stores.map((store) => {
                                    const qty = getStoreInventory(variant.id, store.id);
                                    const adjustKey = `${variant.id}-${store.id}`;
                                    const isAdjusting = adjustingInventory[adjustKey];
                                    const deltaValue = deltaInputs[adjustKey] || 0;
                                    
                                    return (
                                      <div
                                        key={store.id}
                                        className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                                      >
                                        {/* Store Name and Current Inventory */}
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${qty > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                            <span className="text-sm font-medium text-gray-700">
                                              {store.name}
                                            </span>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-lg font-bold text-gray-900">
                                              {qty} ширхэг
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Одоогийн үлдэгдэл
                                            </div>
                                          </div>
                                        </div>

                                        {/* Delta Input Section */}
                                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                          <div className="text-xs font-medium text-gray-600 mb-2">
                                            Нэмэх/Хасах утга
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {/* Delta input */}
                                            <input
                                              type="number"
                                              value={deltaValue === 0 ? "" : deltaValue}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                const delta = value === "" ? 0 : parseInt(value) || 0;
                                                setDeltaInputs(prev => ({...prev, [adjustKey]: delta}));
                                              }}
                                              className={`w-full px-3 py-2 border rounded text-center focus:outline-none focus:ring-2 focus:border-transparent ${
                                                Math.abs(deltaValue) > qty && deltaValue !== 0
                                                  ? "border-red-300 focus:ring-red-500 bg-red-50"
                                                  : "border-gray-300 focus:ring-blue-500"
                                              }`}
                                              placeholder="0"
                                              disabled={isAdjusting}
                                            />
                                            {/* Warning message */}
                                            {Math.abs(deltaValue) > qty && deltaValue !== 0 && (
                                              <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                                Хасах тоо үлдэгдлээс их байна (Үлдэгдэл: {qty} ширхэг)
                                              </div>
                                            )}
                                          </div>
                                          
                                          {/* Apply buttons */}
                                          <div className="flex items-center justify-between mt-3">
                                            <div className="text-xs text-gray-600">
                                              {deltaValue !== 0 && (
                                                <>
                                                  <span>Нэмэх: <span className="font-medium text-green-600">{qty + Math.abs(deltaValue)} ширхэг</span></span>
                                                  <span className="mx-2">|</span>
                                                  <span>Хасах: 
                                                    <span className={`font-medium ${Math.abs(deltaValue) > qty ? "text-red-600" : "text-orange-600"}`}>
                                                      {Math.abs(deltaValue) > qty 
                                                        ? `Боломжгүй (${Math.abs(deltaValue) - qty} дутагдах)` 
                                                        : `${qty - Math.abs(deltaValue)} ширхэг`
                                                      }
                                                    </span>
                                                  </span>
                                                </>
                                              )}
                                              {deltaValue === 0 && (
                                                <span>Одоогийн үлдэгдэл: <span className="font-medium">{qty} ширхэг</span></span>
                                              )}
                                            </div>
                                            <div className="flex gap-2">
                                              {/* Add button - always show if deltaValue is not 0 */}
                                              {deltaValue !== 0 && (
                                                <button
                                                  onClick={() => {
                                                    // Use the absolute value as positive delta for adding
                                                    adjustInventoryByDelta(variant.id, store.id, Math.abs(deltaValue));
                                                    setDeltaInputs(prev => ({...prev, [adjustKey]: 0}));
                                                  }}
                                                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    )}
                  </section>
                )}

                {/* Add Variant Button (when no variants exist) */}
                {variants.length === 0 && isEditing && (
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
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
