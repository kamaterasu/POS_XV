// components/countComponents/CountPanel.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  MdOutlineCalculate,
  MdCompare,
  MdSearch,
  MdClose,
  MdAutoFixHigh,
} from "react-icons/md";
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
} from "react-icons/fa";
import {
  getSystemCount,
  compareCount,
  getCountItemsBySearch,
  validateCountData,
  getStatusColor,
  getStatusText,
  type CountItem,
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

interface CountPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CountEntry {
  variant_id: string;
  physical_qty: number;
}

export default function CountPanel({ isOpen, onClose }: CountPanelProps) {
  const [activeTab, setActiveTab] = useState<"count" | "compare">("count");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [storeId, setStoreId] = useState<string>("");

  // Count data
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [countEntries, setCountEntries] = useState<CountEntry[]>([]);

  // Comparison results
  const [comparisonResults, setComparisonResults] = useState<
    CountComparisonItem[]
  >([]);
  const [comparisonSummary, setComparisonSummary] =
    useState<CountComparisonSummary | null>(null);

  // Adjustment state
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [adjustmentProgress, setAdjustmentProgress] = useState({
    current: 0,
    total: 0,
  });
  const [adjustmentResults, setAdjustmentResults] = useState<
    AdjustmentResult[]
  >([]);

  // Initialize store ID
  useEffect(() => {
    const initStoreId = async () => {
      try {
        const token = await getAccessToken();
        const storedId = await getStoredID(token);
        if (storedId) {
          setStoreId(storedId);
        }
      } catch (error) {
        console.error("Failed to get store ID:", error);
      }
    };

    if (isOpen) {
      initStoreId();
    }
  }, [isOpen]);

  // Search for count items
  const handleSearch = async () => {
    if (!storeId || !searchTerm.trim()) return;

    setLoading(true);
    try {
      const items = await getCountItemsBySearch(storeId, searchTerm.trim(), 50);
      setCountItems(items);

      // Initialize count entries
      const entries: CountEntry[] = items.map((item) => ({
        variant_id: item.variant_id,
        physical_qty: item.system_qty, // Default to system quantity
      }));
      setCountEntries(entries);
    } catch (error) {
      console.error("Search failed:", error);
      alert("Хайлт амжилтгүй боллоо: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Update physical quantity
  const updatePhysicalQty = (variant_id: string, physical_qty: number) => {
    setCountEntries((prev) =>
      prev.map((entry) =>
        entry.variant_id === variant_id
          ? { ...entry, physical_qty: Math.max(0, physical_qty) }
          : entry
      )
    );
  };

  // Compare counts
  const handleCompare = async () => {
    if (!storeId || countEntries.length === 0) return;

    if (!validateCountData(countEntries)) {
      alert("Оруулсан тоо баримтын өгөгдөл буруу байна!");
      return;
    }

    setLoading(true);
    try {
      const result = await compareCount({
        store_id: storeId,
        items: countEntries,
      });

      setComparisonResults(result.items);
      setComparisonSummary(result.summary);
      setActiveTab("compare");
    } catch (error) {
      console.error("Count comparison failed:", error);
      alert(
        "Тооллого харьцуулах явцад алдаа гарлаа: " + (error as Error).message
      );
    } finally {
      setLoading(false);
    }
  };

  // Apply adjustments
  const handleApplyAdjustments = async () => {
    if (!storeId || comparisonResults.length === 0) return;

    const validation = validateAdjustments(comparisonResults);
    if (!validation.valid) {
      alert("Засвар хийхэд асуудал байна:\n" + validation.issues.join("\n"));
      return;
    }

    setLoading(true);
    try {
      const results = await applyCountAdjustmentsWithProgress(
        storeId,
        comparisonResults,
        (current, total) => {
          setAdjustmentProgress({ current, total });
        }
      );

      setAdjustmentResults(results);
      setShowAdjustmentDialog(false);

      // Show success message
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      if (errorCount > 0) {
        alert(
          `Засвар дуусав: ${successCount} амжилттай, ${errorCount} алдаатай`
        );
      } else {
        alert(`Бүх засвар амжилттай хийгдлээ! (${successCount} зүйл)`);
      }
    } catch (error) {
      console.error("Adjustment failed:", error);
      alert("Засвар хийхэд алдаа гарлаа: " + (error as Error).message);
    } finally {
      setLoading(false);
      setAdjustmentProgress({ current: 0, total: 0 });
    }
  };
  const handleReset = () => {
    setCountItems([]);
    setCountEntries([]);
    setComparisonResults([]);
    setComparisonSummary(null);
    setAdjustmentResults([]);
    setSearchTerm("");
    setActiveTab("count");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MdOutlineCalculate size={24} />
              <div>
                <h2 className="text-xl font-bold">Тооллого</h2>
                <p className="text-indigo-100 text-sm">
                  Барааны тооллого хийж, харьцуулалт авах
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <MdClose size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab("count")}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === "count"
                  ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <MdOutlineCalculate size={18} />
                Тооллого
              </div>
            </button>
            <button
              onClick={() => setActiveTab("compare")}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === "compare"
                  ? "border-indigo-500 text-indigo-600 bg-indigo-50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              disabled={comparisonResults.length === 0}
            >
              <div className="flex items-center gap-2">
                <MdCompare size={18} />
                Харьцуулалт
                {comparisonSummary && (
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                    {comparisonSummary.short + comparisonSummary.over}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === "count" && (
            <CountTab
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSearch={handleSearch}
              countItems={countItems}
              countEntries={countEntries}
              updatePhysicalQty={updatePhysicalQty}
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
              onApplyAdjustments={() => setShowAdjustmentDialog(true)}
              adjustmentResults={adjustmentResults}
            />
          )}
        </div>
      </div>

      {/* Adjustment Dialog */}
      {showAdjustmentDialog && (
        <AdjustmentDialog
          comparisonResults={comparisonResults}
          onConfirm={handleApplyAdjustments}
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
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onSearch: () => void;
  countItems: CountItem[];
  countEntries: CountEntry[];
  updatePhysicalQty: (variant_id: string, qty: number) => void;
  onCompare: () => void;
  onReset: () => void;
  loading: boolean;
}

function CountTab({
  searchTerm,
  setSearchTerm,
  onSearch,
  countItems,
  countEntries,
  updatePhysicalQty,
  onCompare,
  onReset,
  loading,
}: CountTabProps) {
  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Бараа хайх (нэр, SKU)..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
          </div>
          <button
            onClick={onSearch}
            disabled={loading || !searchTerm.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <MdSearch size={18} />
            Хайх
          </button>
        </div>
      </div>

      {/* Count Items List */}
      {countItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Барааны жагсаалт ({countItems.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={onCompare}
                disabled={loading || countEntries.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <MdCompare size={16} />
                Харьцуулах
              </button>
              <button
                onClick={onReset}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Цэвэрлэх
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-700">
              <div>SKU</div>
              <div className="col-span-2">Бараа</div>
              <div className="text-center">Системийн тоо</div>
              <div className="text-center">Бодит тоо</div>
              <div className="text-center">Зөрүү</div>
            </div>

            <div className="divide-y divide-gray-200">
              {countItems.map((item) => {
                const entry = countEntries.find(
                  (e) => e.variant_id === item.variant_id
                );
                const delta = (entry?.physical_qty || 0) - item.system_qty;

                return (
                  <div
                    key={item.variant_id}
                    className="grid grid-cols-6 gap-4 p-4 hover:bg-gray-50"
                  >
                    <div className="text-sm text-gray-600">
                      {item.sku || "N/A"}
                    </div>
                    <div className="col-span-2">
                      <div className="font-medium text-gray-900">
                        {item.product_name || "Нэргүй"}
                      </div>
                      {item.variant_name && (
                        <div className="text-sm text-gray-500">
                          {item.variant_name}
                        </div>
                      )}
                    </div>
                    <div className="text-center font-medium">
                      {item.system_qty}
                    </div>
                    <div className="text-center">
                      <input
                        type="number"
                        min="0"
                        value={entry?.physical_qty || 0}
                        onChange={(e) =>
                          updatePhysicalQty(
                            item.variant_id,
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div
                      className={`text-center font-medium ${
                        delta > 0
                          ? "text-blue-600"
                          : delta < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {countItems.length === 0 && !loading && (
        <div className="text-center py-12">
          <MdSearch size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Тооллого хийх барааг хайж эхлэнэ үү</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500">Ачааллаж байна...</p>
        </div>
      )}
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

interface AdjustmentDialogProps {
  comparisonResults: CountComparisonItem[] | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  progress?: {
    current: number;
    total: number;
  };
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {comparisonSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaCheck className="text-green-600" size={20} />
              <div>
                <p className="text-sm text-green-600">Тохирч байна</p>
                <p className="text-2xl font-bold text-green-700">
                  {comparisonSummary.matched}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaExclamationTriangle className="text-red-600" size={20} />
              <div>
                <p className="text-sm text-red-600">Дутуу</p>
                <p className="text-2xl font-bold text-red-700">
                  {comparisonSummary.short}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FaArrowUp className="text-blue-600" size={20} />
              <div>
                <p className="text-sm text-blue-600">Илүү</p>
                <p className="text-2xl font-bold text-blue-700">
                  {comparisonSummary.over}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div>
              <p className="text-sm text-gray-600">Нийт зөрүү</p>
              <p
                className={`text-2xl font-bold ${
                  comparisonSummary.delta_total > 0
                    ? "text-blue-700"
                    : comparisonSummary.delta_total < 0
                    ? "text-red-700"
                    : "text-green-700"
                }`}
              >
                {comparisonSummary.delta_total > 0
                  ? `+${comparisonSummary.delta_total}`
                  : comparisonSummary.delta_total}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
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
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 gap-4 p-4 bg-gray-50 border-b text-sm font-medium text-gray-700">
              <div>SKU</div>
              <div className="col-span-2">Бараа</div>
              <div className="text-center">Системийн тоо</div>
              <div className="text-center">Бодит тоо</div>
              <div className="text-center">Зөрүү</div>
              <div className="text-center">Төлөв</div>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredResults.map((item) => (
                <div
                  key={item.variant_id}
                  className="grid grid-cols-7 gap-4 p-4 hover:bg-gray-50"
                >
                  <div className="text-sm text-gray-600">
                    {item.sku || "N/A"}
                  </div>
                  <div className="col-span-2">
                    <div className="font-medium text-gray-900">
                      {item.product_name || "Нэргүй"}
                    </div>
                    {item.variant_name && (
                      <div className="text-sm text-gray-500">
                        {item.variant_name}
                      </div>
                    )}
                  </div>
                  <div className="text-center font-medium">
                    {item.system_qty}
                  </div>
                  <div className="text-center font-medium">
                    {item.physical_qty}
                  </div>
                  <div
                    className={`text-center font-medium ${
                      item.delta > 0
                        ? "text-blue-600"
                        : item.delta < 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {item.delta > 0 ? `+${item.delta}` : item.delta}
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
}: AdjustmentDialogProps) {
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
                <li key={item.product_id} className="flex justify-between">
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
