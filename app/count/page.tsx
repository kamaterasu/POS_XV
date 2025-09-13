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

  // Pagination and search state
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [searchDebounceTimeout, setSearchDebounceTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load system inventory data with search and pagination
  const loadSystemData = async (search?: string, page: number = 0) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const token = await getAccessToken();
      const storeId = await getStoredID(token);

      if (!token || !storeId) {
        throw new Error("Authentication or store information not available");
      }

      const systemData = await getSystemCount({
        store_id: storeId,
        search: search || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      const newProducts = systemData.items.map((item: any) => ({
        id: item.variant_id,
        name: item.product_name || "Unknown Product",
        sku: item.sku,
        variant_name: item.variant_name,
        system_qty: item.system_qty,
        physical_qty: 0,
      }));

      if (page === 0) {
        setProducts(newProducts);
      } else {
        // Append to existing products for pagination
        setProducts((prev) => [...prev, ...newProducts]);
      }

      setTotalCount(systemData.count);
      setCurrentPage(page);
    } catch (error) {
      console.error("Failed to load system data:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMessage(`Системийн мэдээлэл татахад алдаа гарлаа: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();

    // Cleanup timeout on unmount
    return () => {
      if (searchDebounceTimeout) {
        clearTimeout(searchDebounceTimeout);
      }
    };
  }, []);

  // Handle search with debouncing
  const handleSearch = (term: string) => {
    setSearchTerm(term);

    // Clear existing timeout
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }

    // Set new timeout for server-side search
    const timeout = setTimeout(() => {
      loadSystemData(term.trim() || undefined, 0);
    }, 500); // 500ms debounce

    setSearchDebounceTimeout(timeout);
  };

  // Load more products (pagination)
  const loadMoreProducts = () => {
    const nextPage = currentPage + 1;
    const maxPage = Math.ceil(totalCount / pageSize) - 1;

    if (nextPage <= maxPage && !loading) {
      loadSystemData(searchTerm.trim() || undefined, nextPage);
    }
  };

  // Products are now filtered server-side, no need for client-side filtering
  const filteredProducts = products;

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
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMessage(`Харьцуулахад алдаа гарлаа: ${errorMsg}`);
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
    setErrorMessage(null);
    setActiveTab("count");

    // Clear search and reload from beginning
    setSearchTerm("");
    setCurrentPage(0);
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    loadSystemData(undefined, 0);
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
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMessage(`Тохируулга хадгалахад алдаа гарлаа: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const summary = getCountSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
              >
                <FaArrowLeft className="text-gray-600" size={18} />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <FaBox className="text-white" size={24} />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      Барааны тоолголт
                    </h1>
                    <p className="text-gray-600 text-lg">
                      Агуулахын барааны тоо хэмжээ тоолох
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Summary Stats */}
            <div className="flex gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-w-[120px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FaBox className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {summary.itemsCounted}
                    </div>
                    <div className="text-gray-500 text-sm">Тоолсон төрөл</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-w-[120px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <FaCheck className="text-green-600" size={18} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {summary.totalQuantity}
                    </div>
                    <div className="text-gray-500 text-sm">Нийт тоо ширхэг</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Error Display */}
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-400 rounded-r-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FaExclamationTriangle className="text-red-600" size={18} />
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 font-semibold text-lg mb-1">
                  Алдаа гарлаа
                </h3>
                <p className="text-red-700 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="w-8 h-8 flex items-center justify-center hover:bg-red-100 rounded-full transition-colors duration-200"
              >
                <FaTimes className="text-red-500" size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Modern Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-2 bg-gray-50 border-b border-gray-100">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("count")}
                className={`flex-1 px-6 py-4 font-medium text-sm rounded-xl transition-all duration-200 ${
                  activeTab === "count"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <FaBox size={18} />
                  <span className="text-base">Тоолох</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("compare")}
                disabled={comparisonResults.length === 0}
                className={`flex-1 px-6 py-4 font-medium text-sm rounded-xl transition-all duration-200 relative ${
                  activeTab === "compare"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <FaSync size={18} />
                  <span className="text-base">Харьцуулах</span>
                  {comparisonResults.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-sm min-w-[24px] h-6 flex items-center justify-center">
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

          {activeTab === "count" && (
            <CountTab
              products={filteredProducts}
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              onQuantityUpdate={updatePhysicalQty}
              onCompare={handleCompare}
              onReset={handleReset}
              loading={loading}
              totalCount={totalCount}
              hasMore={products.length < totalCount}
              onLoadMore={loadMoreProducts}
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
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
}

function CountTab({
  products,
  searchTerm,
  onSearchChange,
  onQuantityUpdate,
  onCompare,
  onReset,
  loading,
  totalCount,
  hasMore,
  onLoadMore,
}: CountTabProps) {
  return (
    <div className="space-y-8 p-6">
      {/* Enhanced Search and Actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <FaSearch className="text-gray-400" size={20} />
          </div>
          <input
            type="text"
            placeholder="Барааны нэр, SKU эсвэл variant хайх..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 bg-white shadow-sm"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCompare}
            disabled={loading || products.every((p) => !p.physical_qty)}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
          >
            <FaSync size={18} />
            Харьцуулах
          </button>
          <button
            onClick={onReset}
            className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl hover:from-gray-700 hover:to-gray-800 flex items-center gap-3 font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <FaUndo size={18} />
            Дахин эхлэх
          </button>
        </div>
      </div>

      {/* Enhanced Products List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Барааны жагсаалт
              </h3>
              <p className="text-gray-600 mt-1">
                {products.length} / {totalCount} бараа
              </p>
            </div>
            {searchTerm && (
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                "{searchTerm}" хайлт
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="relative">
              <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FaBox className="text-blue-300" size={20} />
              </div>
            </div>
            <p className="text-gray-600 text-lg">
              Барааны мэдээлэл татаж байна...
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  className="p-6 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">
                            {index + 1}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900 text-lg truncate">
                            {product.name}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {product.sku && (
                              <span className="bg-gray-100 px-2 py-1 rounded-md font-mono">
                                SKU: {product.sku}
                              </span>
                            )}
                            {product.variant_name && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                                {product.variant_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Системийн тоо:
                        </span>
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {product.system_qty}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-2">
                      <button
                        onClick={() =>
                          onQuantityUpdate(
                            product.id,
                            Math.max(0, (product.physical_qty || 0) - 1)
                          )
                        }
                        className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-md"
                      >
                        <FaMinus size={16} />
                      </button>

                      <div className="relative">
                        <input
                          type="number"
                          value={product.physical_qty || 0}
                          onChange={(e) =>
                            onQuantityUpdate(
                              product.id,
                              Math.max(0, parseInt(e.target.value) || 0)
                            )
                          }
                          className="w-20 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 bg-white"
                          min="0"
                        />
                      </div>

                      <button
                        onClick={() =>
                          onQuantityUpdate(
                            product.id,
                            (product.physical_qty || 0) + 1
                          )
                        }
                        className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-md"
                      >
                        <FaPlus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {products.length === 0 && !loading && (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FaBox className="text-gray-400" size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    {searchTerm ? "Хайлтын илэрц олдсонгүй" : "Бараа олдсонгүй"}
                  </h3>
                  <p className="text-gray-500">
                    {searchTerm
                      ? `"${searchTerm}" хайлтад тохирох бараа байхгүй байна`
                      : "Энэ дэлгүүрт бараа бүртгэгдээгүй байна"}
                  </p>
                </div>
              )}
            </div>

            {/* Enhanced Load More Button */}
            {hasMore && !loading && (
              <div className="bg-gradient-to-t from-white via-gray-50 to-transparent p-6">
                <button
                  onClick={onLoadMore}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-3 font-medium text-lg shadow-lg hover:shadow-xl hover:scale-105"
                >
                  <FaArrowDown size={18} />
                  Дараагийн {Math.min(50, totalCount - products.length)} бараа
                  ачаалах
                </button>
              </div>
            )}
          </>
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
        return "bg-green-500 text-white";
      case "SHORT":
        return "bg-red-500 text-white";
      case "OVER":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
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
    <div className="space-y-8 p-6">
      {/* Enhanced Summary Cards */}
      {comparisonSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FaCheck className="text-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-green-900 mb-1">
                  {comparisonSummary.matched}
                </div>
                <div className="text-green-700 font-medium">Тохирч байна</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FaArrowDown className="text-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-red-900 mb-1">
                  {comparisonSummary.short}
                </div>
                <div className="text-red-700 font-medium">Дутуу</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FaArrowUp className="text-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-900 mb-1">
                  {comparisonSummary.over}
                </div>
                <div className="text-orange-700 font-medium">Илүү</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                <FaSync className="text-white" size={24} />
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-900 mb-1">
                  {Math.abs(comparisonSummary.delta_total)}
                </div>
                <div className="text-blue-700 font-medium">Нийт зөрүү</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Actions Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Зөрүүтэй барааны жагсаалт
            </h3>
            <p className="text-gray-600">
              {filteredResults.length} бараанд тохируулга шаардлагатай
            </p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <button
              onClick={onReset}
              className="flex-1 lg:flex-none px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <FaUndo size={16} />
              Дахин эхлэх
            </button>

            {filteredResults.length > 0 && (
              <button
                onClick={onApplyAdjustments}
                className="flex-1 lg:flex-none px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl hover:scale-105"
              >
                <FaSync size={16} />
                Тохируулга хийх ({filteredResults.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredResults.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredResults.map((item, index) => (
              <div
                key={item.variant_id}
                className="p-6 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg mb-1 truncate">
                        {item.product_name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {item.sku && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-sm font-mono">
                            SKU: {item.sku}
                          </span>
                        )}
                        {item.variant_name && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-sm">
                            {item.variant_name}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Систем:</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                            {item.system_qty}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Тоолсон:</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                            {item.physical_qty}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Зөрүү:</span>
                          <span
                            className={`px-2 py-1 rounded-full font-semibold ${
                              item.delta > 0
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.delta > 0 ? "+" : ""}
                            {item.delta}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-4 py-2 rounded-2xl text-sm font-bold shadow-sm ${getStatusColor(
                        item.status
                      )}`}
                    >
                      {getStatusText(item.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <FaCheck size={64} className="text-green-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Маш сайн! 🎉
          </h3>
          <p className="text-gray-600 text-lg mb-6">
            Бүх бараа тохирч байна! Тохируулга хийх шаардлага байхгүй.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-md mx-auto">
            <p className="text-green-800 text-sm">
              Таны тоолголт системтэй яг тохирч байна. Агуулахын бүртгэл зөв
              байна.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Adjustment Dialog Component
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
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-8 border-b border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <FaExclamationTriangle className="text-white" size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                Тохируулга баталгаажуулах
              </h3>
              <p className="text-gray-600">Агуулахын тоо хэмжээг шинэчлэх</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">{adjustmentCount}</span>
              </div>
              <div>
                <h4 className="font-semibold text-orange-900 text-lg">
                  Тохируулга хийгдэх барааны тоо
                </h4>
                <p className="text-orange-700 text-sm">
                  Дараах бараанууд автоматаар шинэчлэгдэнэ
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 max-h-60 overflow-y-auto">
              <div className="space-y-3">
                {filteredResults.slice(0, 8).map((item) => (
                  <div
                    key={item.variant_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.sku && `SKU: ${item.sku}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                        {item.system_qty}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        {item.physical_qty}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          item.status === "SHORT"
                            ? "bg-red-500 text-white"
                            : "bg-orange-500 text-white"
                        }`}
                      >
                        {item.status === "SHORT" ? "Дутуу" : "Илүү"}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredResults.length > 8 && (
                  <div className="text-center py-2">
                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                      ... дахин {filteredResults.length - 8} бараа
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading && progress && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="font-semibold text-blue-900">
                  Тохируулга хадгалж байна...
                </span>
              </div>
              <div className="flex justify-between text-sm text-blue-700 mb-2">
                <span>Явц</span>
                <span className="font-medium">
                  {progress.current}/{progress.total} (
                  {Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 border-2 border-gray-200 rounded-2xl transition-all duration-200 disabled:opacity-50 font-medium text-lg"
            >
              Цуцлах
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-3 font-medium text-lg shadow-lg hover:shadow-xl disabled:hover:shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Хадгалж байна...
                </>
              ) : (
                <>
                  <FaCheck size={18} />
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
