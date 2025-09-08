"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Loading } from "@/components/Loading";
import { getProductById, updateProduct } from "@/lib/product/productApi";
import { getCategories } from "@/lib/category/categoryApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { uploadProductImageOnly } from "@/lib/product/productImages";
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

type ProductData = {
  product: Product;
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

        // Fetch product data and categories
        const [productResult, token] = await Promise.all([
          getProductById(String(id)),
          getAccessToken(),
        ]);

        if (alive) {
          if (productResult.error) {
            setError(productResult.error);
          } else {
            console.log("Product result:", productResult); // Debug log
            setData(productResult);
            setFormData({
              name: productResult.product.name || "",
              description: productResult.product.description || "",
              category_id: productResult.product.category_id || "",
              img: productResult.product.img || "",
            });
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
                  console.error("Error loading image:", error);
                  setImageError("Зураг ачаалахад алдаа гарлаа");
                  setImagePreviews(["/default.png"]);
                }
              };
              initializeImageUrl();
            }
          }

          // Fetch categories
          if (token) {
            try {
              const categoriesResult = await getCategories(token);
              console.log("Categories result:", categoriesResult); // Debug log

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
              console.warn("Failed to load categories:", e);
            }
          }
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Алдаа гарлаа.");
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
          console.error("Image upload failed:", e);
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
      };

      const result = await updateProduct(updateData);

      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
        setIsEditing(false);
        setImageFiles([]);
        // Update previews with the new uploaded image URL or keep existing one
        if (uploadedImageUrl) {
          setImagePreviews([uploadedImageUrl]);
        } else if (result.product.img) {
          // Convert the storage path to signed URL for display
          try {
            const imageUrl = await getImageUrl(result.product.img);
            console.log("Updated image URL:", imageUrl); // Debug log
            if (imageUrl && imageUrl !== "/default.png") {
              setImagePreviews([imageUrl]);
            } else {
              setImageError("Зураг ачаалахад алдаа гарлаа");
              setImagePreviews(["/default.png"]);
            }
          } catch (error) {
            console.error("Error loading updated image:", error);
            setImageError("Зураг ачаалахад алдаа гарлаа");
            setImagePreviews(["/default.png"]);
          }
        } else {
          setImagePreviews([]);
        }
        alert("Барааны мэдээлэл амжилттай шинэчлэгдлээ!");
      }
    } catch (e: any) {
      setError(e?.message ?? "Хадгалахад алдаа гарлаа.");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-md rounded-xl border border-slate-200 bg-white/60 backdrop-blur-sm transition-all duration-200"
            >
              <svg
                className="w-5 h-5"
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
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                Барааны дэлгэрэнгүй
              </h1>
              <p className="text-sm text-slate-500 font-mono mt-1 flex items-center gap-2">
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
                    d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                  />
                </svg>
                ID: {id}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200"
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
                    if (data) {
                      setFormData({
                        name: data.product.name || "",
                        description: data.product.description || "",
                        category_id: data.product.category_id || "",
                        img: data.product.img || "",
                      });
                      // Convert storage path to signed URL for display
                      if (data.product.img) {
                        try {
                          const imageUrl = await getImageUrl(data.product.img);
                          console.log("Reset image URL:", imageUrl); // Debug log
                          if (imageUrl && imageUrl !== "/default.png") {
                            setImagePreviews([imageUrl]);
                          } else {
                            setImageError("Зураг ачаалахад алдаа гарлаа");
                            setImagePreviews(["/default.png"]);
                          }
                        } catch (error) {
                          console.error("Error loading image on reset:", error);
                          setImageError("Зураг ачаалахад алдаа гарлаа");
                          setImagePreviews(["/default.png"]);
                        }
                      } else {
                        setImagePreviews([]);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-700 shadow-lg hover:shadow-xl transition-all duration-200"
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
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200"
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl shadow-sm">
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

        {/* Debug info */}
        {data && (
          <details className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
            <summary className="cursor-pointer text-amber-700 font-medium flex items-center gap-2 hover:text-amber-800 transition-colors">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Debug: API Response Structure (Click to expand)
            </summary>
            <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
              <pre className="text-xs text-slate-600 overflow-auto max-h-40 font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-700 mb-2">
                Categories Debug:
              </p>
              <pre className="text-xs text-blue-600 overflow-auto max-h-32 font-mono">
                {JSON.stringify(categories, null, 2)}
              </pre>
            </div>
          </details>
        )}

        {!data ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-slate-400"
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
            <p className="text-slate-500 text-lg">Өгөгдөл олдсонгүй.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Product Information Card */}
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-100/50 border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
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
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Ерөнхий мэдээлэл
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
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
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                        placeholder="Барааны нэрийг оруулна уу"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-slate-900 font-medium">
                          {data.product.name}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 12h16M4 18h7"
                        />
                      </svg>
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
                        rows={4}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white resize-none"
                        placeholder="Барааны тайлбарыг оруулна уу"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[100px]">
                        <p className="text-slate-900">
                          {data.product.description || (
                            <span className="text-slate-400 italic">
                              Тайлбар байхгүй
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
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
                          d="M19 11H5m14-7l-7 7-7-7m14 18l-7-7-7 7"
                        />
                      </svg>
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
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                      >
                        <option value="">Ангилал сонгох</option>
                        {flattenCategories(categories).map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-slate-900">
                          {data.product.category_id ? (
                            flattenCategories(categories).find(
                              (c) => c.id === data.product.category_id
                            )?.name || (
                              <span className="text-orange-600">
                                Тодорхойгүй (ID: {data.product.category_id})
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic">
                              Ангилал байхгүй
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-indigo-600"
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
                      Зураг
                    </label>
                    {isEditing ? (
                      <div className="space-y-4">
                        <input
                          type="url"
                          value={formData.img}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              img: e.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                          placeholder="Зургийн холбоосыг оруулна уу"
                        />
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-300" />
                          </div>
                          <div className="relative flex justify-center text-sm">
                            <span className="px-3 bg-white text-slate-500">
                              эсвэл
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => imgInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 text-sm font-medium transition-all duration-200"
                            disabled={uploadingImages}
                          >
                            {uploadingImages ? (
                              <>
                                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                Ачаалж байна...
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
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                  />
                                </svg>
                                Зураг сонгох
                              </>
                            )}
                          </button>
                          <input
                            ref={imgInputRef}
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          {imagePreviews.length > 0 && (
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                              {imagePreviews.length} зураг
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-slate-900 font-mono text-sm break-all">
                          {data.product.img || (
                            <span className="text-slate-400 italic">
                              Зураг байхгүй
                            </span>
                          )}
                        </p>
                        {imageError && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 text-xs flex items-center gap-1">
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
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              {imageError}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-emerald-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Үүсгэсэн огноо
                    </label>
                    <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-slate-900 font-medium">
                        {new Date(data.product.created_at).toLocaleString(
                          "mn-MN",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
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
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Нэмэлт мэдээлэл
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Tenant ID:</span>
                        <span className="text-blue-900 font-mono text-xs">
                          {data.product.tenant_id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Product ID:</span>
                        <span className="text-blue-900 font-mono text-xs">
                          {data.product.id}
                        </span>
                      </div>
                      {data.product.category_id && (
                        <div className="flex justify-between">
                          <span className="text-blue-700">Category ID:</span>
                          <span className="text-blue-900 font-mono text-xs">
                            {data.product.category_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image Preview */}
                  {imagePreviews.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-pink-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Зургийн урьдчилан харах
                      </label>
                      {imagePreviews.length === 1 ? (
                        <div className="relative w-full max-w-sm mx-auto">
                          <div className="aspect-square border-2 border-slate-200 rounded-2xl overflow-hidden bg-slate-100 shadow-lg">
                            {imagePreviews[0] &&
                            imagePreviews[0] !== "/default.png" &&
                            isValidImageUrl(imagePreviews[0]) ? (
                              <Image
                                src={imagePreviews[0]}
                                alt="Product"
                                fill
                                sizes="(min-width: 1024px) 384px, (min-width: 768px) 256px, 192px"
                                className="object-cover"
                                unoptimized={
                                  imagePreviews[0].startsWith("blob:") ||
                                  imagePreviews[0].startsWith("data:")
                                }
                                onError={(e) => {
                                  console.error(
                                    "Image failed to load:",
                                    imagePreviews[0]
                                  );
                                  (e.target as HTMLImageElement).src =
                                    "/default.png";
                                }}
                                onLoad={() => setImageError(null)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                <div className="text-center">
                                  <svg
                                    className="w-12 h-12 text-slate-400 mx-auto mb-2"
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
                                  <p className="text-slate-400 text-sm">
                                    {imagePreviews[0] &&
                                    !isValidImageUrl(imagePreviews[0])
                                      ? "Буруу зургийн холбоос"
                                      : "Зураг алга"}
                                  </p>
                                  {imagePreviews[0] &&
                                    !isValidImageUrl(imagePreviews[0]) && (
                                      <p className="text-red-400 text-xs mt-1 font-mono break-all px-2">
                                        {imagePreviews[0]}
                                      </p>
                                    )}
                                </div>
                              </div>
                            )}
                            {isEditing && (
                              <button
                                onClick={() => removeImage(0)}
                                className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200"
                                aria-label="remove"
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
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {imagePreviews.map((src, i) => (
                            <div
                              key={`${src}-${i}`}
                              className="relative aspect-square group"
                            >
                              <div className="w-full h-full border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-100 shadow-md hover:shadow-lg transition-shadow duration-200">
                                {src &&
                                src !== "/default.png" &&
                                isValidImageUrl(src) ? (
                                  <Image
                                    src={src}
                                    alt={`Барааны зураг ${i + 1}`}
                                    fill
                                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                                    unoptimized={
                                      src.startsWith("blob:") ||
                                      src.startsWith("data:")
                                    }
                                    priority={i === 0}
                                    onError={(e) => {
                                      console.error(
                                        "Image failed to load:",
                                        src
                                      );
                                      (e.target as HTMLImageElement).src =
                                        "/default.png";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                    <svg
                                      className="w-8 h-8 text-slate-400"
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
                                  </div>
                                )}
                                {isEditing && (
                                  <button
                                    onClick={() => removeImage(i)}
                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    aria-label="remove"
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
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
