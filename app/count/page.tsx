"use client";

import React, { useState, useEffect } from "react";
import {
  FaBox,
  FaSearch,
  FaPlus,
  FaMinus,
  FaCheck,
  FaTimes,
  FaUndo,
  FaSync,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
  FaArrowLeft,
} from "react-icons/fa";
import { useRouter } from "next/navigation";
import {
  getSystemCount,
  compareCount,
  type CountComparisonItem,
  type CountComparisonSummary,
} from "@/lib/count/countApi";
import {
  applyCountAdjustmentsWithProgress,
  getAdjustmentSummary,
  validateAdjustments,
  type AdjustmentResult,
} from "@/lib/count/inventoryAdjustment";
import { getStoredID } from "@/lib/store/storeApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  variant_name: string | null;
  system_qty: number;
  physical_qty?: number;
}

interface CountItem {
  variant_id: string;
  sku: string | null;
  product_name: string | null;
  variant_name: string | null;
  physical_qty: number;
}

export default function CountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"count" | "compare">("count");
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [comparisonResults, setComparisonResults] = useState<
    CountComparisonItem[]
  >([]);
  const [comparisonSummary, setComparisonSummary] =
    useState<CountComparisonSummary | null>(null);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustmentResults, setAdjustmentResults] = useState<
    AdjustmentResult[]
  >([]);
  const [adjustmentProgress, setAdjustmentProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Load system inventory data
  const loadSystemData = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const storeId = await getStoredID(token);

      if (!token || !storeId) {
        throw new Error("Authentication or store information not available");
      }

      const systemData = await getSystemCount({ store_id: storeId });
      setProducts(
        systemData.items.map((item: any) => ({
          id: item.variant_id,
          name: item.product_name || "Unknown Product",
          sku: item.sku,
          variant_name: item.variant_name,
          system_qty: item.system_qty,
          physical_qty: 0,
        }))
      );
    } catch (error) {
      console.error("Failed to load system data:", error);
      alert("Системийн мэдээлэл татахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();
  }, []);

  // Filter products based on search term
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku &&
        product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.variant_name &&
        product.variant_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Update physical quantity
  const updatePhysicalQty = (productId: string, quantity: number) => {
    const validQty = Math.max(0, quantity);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, physical_qty: validQty } : p
      )
    );
  };

  // Get count summary
  const getCountSummary = () => {
    const countedItems = products.filter((p) => (p.physical_qty || 0) > 0);
    const totalCounted = countedItems.reduce(
      (sum, p) => sum + (p.physical_qty || 0),
      0
    );
    return {
      itemsCounted: countedItems.length,
      totalQuantity: totalCounted,
    };
  };

  // Handle compare
  const handleCompare = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const storeId = await getStoredID(token);

      if (!token || !storeId) {
        throw new Error("Authentication required");
      }

      // Prepare count data - only include items that have been counted
      const countData = products
        .filter((p) => (p.physical_qty || 0) > 0 || p.physical_qty === 0) // Include zero counts
        .map((p) => ({
          variant_id: p.id,
          physical_qty: p.physical_qty || 0,
        }));

      if (countData.length === 0) {
        alert("Эхлээд барааны тоо оруулна уу");
        return;
      }

      const comparison = await compareCount({
        store_id: storeId,
        items: countData,
      });
      setComparisonResults(comparison.items);
      setComparisonSummary(comparison.summary);
      setActiveTab("compare");
    } catch (error) {
      console.error("Comparison failed:", error);
      alert("Харьцуулахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    setProducts((prev) => prev.map((p) => ({ ...p, physical_qty: 0 })));
    setComparisonResults([]);
    setComparisonSummary(null);
    setAdjustmentResults([]);
    setActiveTab("count");
  };

  // Handle apply adjustments
  const handleApplyAdjustments = () => {
    setShowAdjustmentDialog(true);
  };

  const confirmAdjustments = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const storeId = await getStoredID(token);

      if (!storeId) {
        throw new Error("Store ID not available");
      }

      // Use the progress version of the adjustment function
      await applyCountAdjustmentsWithProgress(
        storeId,
        comparisonResults,
        (current: number, total: number) => {
          setAdjustmentProgress({ current, total });
        }
      );

      alert("Тохируулга амжилттай хадгалагдлаа");
      setShowAdjustmentDialog(false);
      setAdjustmentProgress(null);

      // Reload data to reflect changes
      await loadSystemData();
      setComparisonResults([]);
      setComparisonSummary(null);
      setActiveTab("count");
    } catch (error) {
      console.error("Adjustment failed:", error);
      alert("Тохируулга хадгалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const summary = getCountSummary();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FaArrowLeft className="text-gray-600" size={20} />
              </button>
              <div className="flex items-center gap-3">
                <FaBox className="text-blue-600" size={28} />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Барааны тоолголт
                  </h1>
                  <p className="text-gray-600">
                    Агуулахын барааны тоо хэмжээ тоолох
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {summary.itemsCounted}
                </div>
                <div className="text-gray-600">Тоолсон төрөл</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.totalQuantity}
                </div>
                <div className="text-gray-600">Нийт тоо ширхэг</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("count")}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "count"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FaBox />
                  Тоолох
                </div>
              </button>

              <button
                onClick={() => setActiveTab("compare")}
                disabled={comparisonResults.length === 0}
                className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "compare"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FaSync />
                  Харьцуулах
                  {comparisonResults.length > 0 && (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                      {
                        comparisonResults.filter((r) => r.status !== "MATCH")
                          .length
                      }
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === "count" && (
              <CountTab
                products={filteredProducts}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onQuantityUpdate={updatePhysicalQty}
                onCompare={handleCompare}
                onReset={handleReset}
                loading={loading}
              />
            )}

            {activeTab === "compare" && (
              <CompareTab
                comparisonResults={comparisonResults}
                comparisonSummary={comparisonSummary}
                onReset={handleReset}
                onApplyAdjustments={handleApplyAdjustments}
                adjustmentResults={adjustmentResults}
              />
            )}
          </div>
        </div>
      </div>

      {/* Adjustment Dialog */}
      {showAdjustmentDialog && (
        <AdjustmentDialog
          comparisonResults={comparisonResults}
          onConfirm={confirmAdjustments}
          onCancel={() => setShowAdjustmentDialog(false)}
          loading={loading}
          progress={adjustmentProgress}
        />
      )}
    </div>
  );
}

// Count Tab Component
interface CountTabProps {
  products: Product[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onQuantityUpdate: (productId: string, quantity: number) => void;
  onCompare: () => void;
  onReset: () => void;
  loading: boolean;
}

function CountTab({
  products,
  searchTerm,
  onSearchChange,
  onQuantityUpdate,
  onCompare,
  onReset,
  loading,
}: CountTabProps) {
  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Барааны нэр, SKU эсвэл variant хайх..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={onCompare}
          disabled={loading || products.every((p) => !p.physical_qty)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <FaSync />
          Харьцуулах
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <FaUndo />
          Дахин эхлэх
        </button>
      </div>

      {/* Products List */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-4">
          Барааны жагсаалт ({products.length})
        </h3>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Барааны мэдээлэл татаж байна...</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {product.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {product.sku && `SKU: ${product.sku}`}
                    {product.variant_name && ` • ${product.variant_name}`}
                  </div>
                  <div className="text-sm text-blue-600">
                    Системийн тоо: {product.system_qty}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      onQuantityUpdate(
                        product.id,
                        (product.physical_qty || 0) - 1
                      )
                    }
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <FaMinus />
                  </button>

                  <input
                    type="number"
                    value={product.physical_qty || 0}
                    onChange={(e) =>
                      onQuantityUpdate(
                        product.id,
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="w-20 text-center py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />

                  <button
                    onClick={() =>
                      onQuantityUpdate(
                        product.id,
                        (product.physical_qty || 0) + 1
                      )
                    }
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Илэрц олдсонгүй
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Compare Tab Component
interface CompareTabProps {
  comparisonResults: CountComparisonItem[];
  comparisonSummary: CountComparisonSummary | null;
  onReset: () => void;
  onApplyAdjustments: () => void;
  adjustmentResults?: AdjustmentResult[];
}

function CompareTab({
  comparisonResults,
  comparisonSummary,
  onReset,
  onApplyAdjustments,
  adjustmentResults,
}: CompareTabProps) {
  const filteredResults = comparisonResults.filter(
    (item) => item.status !== "MATCH"
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "MATCH":
        return "bg-green-100 text-green-800";
      case "SHORT":
        return "bg-red-100 text-red-800";
      case "OVER":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "MATCH":
        return "Тохирч байна";
      case "SHORT":
        return "Дутуу";
      case "OVER":
        return "Илүү";
      default:
        return "Тодорхойгүй";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {comparisonSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaCheck className="text-green-600" size={20} />
              <div>
                <div className="text-2xl font-bold text-green-900">
                  {comparisonSummary.matched}
                </div>
                <div className="text-green-700 text-sm">Тохирч байна</div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaArrowDown className="text-red-600" size={20} />
              <div>
                <div className="text-2xl font-bold text-red-900">
                  {comparisonSummary.short}
                </div>
                <div className="text-red-700 text-sm">Дутуу</div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaArrowUp className="text-orange-600" size={20} />
              <div>
                <div className="text-2xl font-bold text-orange-900">
                  {comparisonSummary.over}
                </div>
                <div className="text-orange-700 text-sm">Илүү</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaSync className="text-blue-600" size={20} />
              <div>
                <div className="text-2xl font-bold text-blue-900">
                  {Math.abs(comparisonSummary.delta_total)}
                </div>
                <div className="text-blue-700 text-sm">Нийт зөрүү</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Зөрүүтэй барааны жагсаалт ({filteredResults.length})
        </h3>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Дахин эхлэх
          </button>

          {filteredResults.length > 0 && (
            <button
              onClick={onApplyAdjustments}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <FaSync size={16} />
              Тохируулга хийх ({filteredResults.length})
            </button>
          )}
        </div>
      </div>

      {filteredResults.length > 0 ? (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="space-y-3">
            {filteredResults.map((item) => (
              <div
                key={item.variant_id}
                className="bg-white rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {item.product_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {item.sku && `SKU: ${item.sku}`}
                    {item.variant_name && ` • ${item.variant_name}`}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Систем: {item.system_qty} • Тоолсон: {item.physical_qty} •
                    Зөрүү: {item.delta}
                  </div>
                </div>

                <div className="text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      item.status
                    )}`}
                  >
                    {getStatusText(item.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FaCheck size={48} className="mx-auto text-green-300 mb-4" />
          <p className="text-gray-500">Бүх бараа тохирч байна!</p>
        </div>
      )}
    </div>
  );
}

// Adjustment Dialog Component
function AdjustmentDialog({
  comparisonResults,
  onConfirm,
  onCancel,
  loading,
  progress,
}: {
  comparisonResults: CountComparisonItem[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  progress?: { current: number; total: number } | null;
}) {
  const filteredResults =
    comparisonResults?.filter((item) => item.status !== "MATCH") || [];
  const adjustmentCount = filteredResults.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center gap-3 mb-6">
          <FaExclamationTriangle className="text-orange-600" size={24} />
          <h3 className="text-xl font-bold text-gray-900">
            Тохируулга баталгаажуулах
          </h3>
        </div>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800 mb-2">
              <strong>{adjustmentCount}</strong> бараанд тохируулга хийхээр
              байна:
            </p>
            <ul className="text-xs text-orange-700 space-y-1">
              {filteredResults.slice(0, 5).map((item) => (
                <li key={item.variant_id} className="flex justify-between">
                  <span>{item.product_name}</span>
                  <span>
                    {item.system_qty} → {item.physical_qty}
                    {item.status === "SHORT" ? " (дутуу)" : " (илүү)"}
                  </span>
                </li>
              ))}
              {filteredResults.length > 5 && (
                <li className="text-orange-600 italic">
                  ... дахин {filteredResults.length - 5} бараа
                </li>
              )}
            </ul>
          </div>

          {loading && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Тохируулга хадгалж байна...</span>
                <span>
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              Цуцлах
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Хадгалж байна...
                </>
              ) : (
                <>
                  <FaCheck />
                  Тохируулга хийх
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
