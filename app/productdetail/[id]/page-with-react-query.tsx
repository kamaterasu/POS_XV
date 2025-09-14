"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

// Import React Query hooks
import { useProduct, useCategories, useUpdateProduct } from "@/lib/hooks";
import { getImageShowUrl } from "@/lib/product/productImages";

type FormData = {
  name: string;
  description: string;
  category_id: string;
  img: string;
};

type Variant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  qty?: number;
};

export default function ProductDetailPageWithReactQuery() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // State
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    category_id: "",
    img: "",
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // React Query hooks
  const {
    data: productData,
    isLoading: loadingProduct,
    error: productError,
    refetch: refetchProduct
  } = useProduct(id, { withVariants: true });

  const {
    data: categoriesData,
    isLoading: loadingCategories
  } = useCategories();

  const updateProductMutation = useUpdateProduct();

  // Process data
  const categories = useMemo(() => {
    if (!categoriesData) return [];
    const tree = categoriesData?.tree || categoriesData?.categories || [];
    return Array.isArray(tree) ? tree : [];
  }, [categoriesData]);

  const product = productData?.product;
  const productVariants = productData?.variants || [];

  // Initialize form data when product loads
  useState(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        category_id: product.category_id || "",
        img: product.img || "",
      });
      setVariants(productVariants);
    }
  });

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product?.id) return;

    try {
      await updateProductMutation.mutateAsync({
        id: product.id,
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id || null,
        img: formData.img || null,
        upsert_variants: variants.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price
        }))
      });
      
      setIsEditing(false);
      refetchProduct();
    } catch (error) {
      console.error("Failed to update product:", error);
    }
  };

  // Loading state
  if (loadingProduct || loadingCategories) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (productError) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Алдаа гарлаа!</strong>
          <span className="block sm:inline"> {productError.message}</span>
          <button
            onClick={() => refetchProduct()}
            className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
          >
            Дахин оролдох
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="text-center py-8 text-gray-500">
          Бараа олдсонгүй
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            ← Буцах
          </button>
          <h1 className="text-2xl font-bold">Барааны дэлгэрэнгүй</h1>
        </div>
        
        <div className="space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Цуцлах
              </button>
              <button
                onClick={handleSubmit}
                disabled={updateProductMutation.isPending}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {updateProductMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Засах
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="w-full h-64 bg-gray-100 rounded overflow-hidden">
            {product.img ? (
              <Image
                src={product.img}
                alt={product.name}
                width={400}
                height={300}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Зураг байхгүй
              </div>
            )}
          </div>
          
          {isEditing && (
            <div>
              <label className="block text-sm font-medium mb-2">Зургийн URL</label>
              <input
                type="text"
                value={formData.img}
                onChange={(e) => setFormData({ ...formData, img: e.target.value })}
                className="w-full p-2 border rounded-lg"
                placeholder="Зургийн URL оруулах"
              />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Нэр</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2 border rounded-lg"
                placeholder="Барааны нэр"
              />
            ) : (
              <p className="text-lg font-semibold">{product.name}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Ангилал</label>
            {isEditing ? (
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Ангилал сонгох</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p>{categories.find((c: any) => c.id === product.category_id)?.name || "Тодорхойгүй"}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Тайлбар</label>
            {isEditing ? (
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full p-2 border rounded-lg"
                placeholder="Барааны тайлбар"
              />
            ) : (
              <p className="text-gray-600">{product.description || "Тайлбар байхгүй"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Төрөл бүрүүд</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Нэр</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">SKU</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Үнэ</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Үлдэгдэл</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant, index) => (
                  <tr key={variant.id}>
                    <td className="border border-gray-300 px-4 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={variant.name}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].name = e.target.value;
                            setVariants(newVariants);
                          }}
                          className="w-full p-1 border rounded"
                        />
                      ) : (
                        variant.name
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].sku = e.target.value;
                            setVariants(newVariants);
                          }}
                          className="w-full p-1 border rounded"
                        />
                      ) : (
                        variant.sku
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].price = Number(e.target.value);
                            setVariants(newVariants);
                          }}
                          className="w-full p-1 border rounded"
                        />
                      ) : (
                        `₮${variant.price.toLocaleString()}`
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {variant.qty || 0} ш
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}