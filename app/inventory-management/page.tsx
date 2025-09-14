"use client";

import React, { useState } from 'react';
import { useProducts } from "@/lib/hooks/useProducts";
import { InventoryAdjustmentModal } from "@/components/inventoryComponents/InventoryAdjustmentModal";

export default function InventoryManagementPage() {
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  
  const { data: products, isLoading } = useProducts();

  const openAdjustmentModal = (productId?: string, variantId?: string) => {
    setSelectedProductId(productId);
    setSelectedVariantId(variantId);
    setAdjustmentModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Ачааллаж байна...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Барааны үлдэгдэл удирдах</h1>
        <p className="text-gray-600">Барааны тоо ширхэгийг нэмэгдүүлэх, хасах</p>
      </div>

      {/* Add General Adjustment Button */}
      <div className="mb-6">
        <button
          onClick={() => openAdjustmentModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + Барааны тоо ширхэг тохируулах
        </button>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Барааны жагсаалт</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {products?.map((product: any) => (
            <div key={product.id} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">{product.name}</h3>
                <button
                  onClick={() => openAdjustmentModal(product.id)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Тохируулах
                </button>
              </div>
              
              {/* Product Variants */}
              {product.variants && product.variants.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {product.variants.map((variant: any) => (
                    <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">
                          {variant.name || variant.value || 'Үндсэн хувилбар'}
                        </div>
                        <button
                          onClick={() => openAdjustmentModal(product.id, variant.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Засах
                        </button>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Үлдэгдэл: <span className="font-medium">{variant.current_stock || 0} ширхэг</span></div>
                        {variant.price && (
                          <div>Үнэ: <span className="font-medium">{variant.price.toLocaleString()}₮</span></div>
                        )}
                        {variant.sku && (
                          <div>SKU: <span className="font-medium">{variant.sku}</span></div>
                        )}
                      </div>

                      {/* Stock Status Indicator */}
                      <div className="mt-2">
                        {variant.current_stock === 0 ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            Дууссан
                          </span>
                        ) : variant.current_stock < 10 ? (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            Бага үлдэгдэл
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Хангалттай
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">Хувилбар олдсонгүй</div>
              )}
            </div>
          ))}
        </div>

        {(!products || products.length === 0) && (
          <div className="text-center py-12">
            <div className="text-gray-500">Бараа олдсонгүй</div>
          </div>
        )}
      </div>

      {/* Inventory Adjustment Modal */}
      <InventoryAdjustmentModal
        open={adjustmentModalOpen}
        onOpenChange={setAdjustmentModalOpen}
        preselectedProductId={selectedProductId}
        preselectedVariantId={selectedVariantId}
      />
    </div>
  );
}