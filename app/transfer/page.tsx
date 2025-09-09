"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Building2,
  TrendingUp,
  Package,
} from "lucide-react";
import {
  getTransfers,
  type Transfer,
  type TransferStatus,
  type TransferListResponse,
} from "@/lib/transfer/transferApi";
import { getStore } from "@/lib/store/storeApi";
import { getAllProductVariants } from "@/lib/product/productApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import TransferCreateForm from "@/components/transferComponents/TransferCreateForm";
import TransferList from "@/components/transferComponents/TransferList";
import TransferDetailModal from "@/components/transferComponents/TransferDetailModal";

type Store = {
  id: string;
  name: string;
};

type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_name?: string;
};

export default function TransferPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    null
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [storeFilter, setStoreFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalTransfers: 0,
    pendingTransfers: 0,
    completedTransfers: 0,
    cancelledTransfers: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [statusFilter, storeFilter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      // Load all required data
      await Promise.all([loadTransfers(), loadStores(), loadVariants()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (storeFilter) {
        params.src_store_id = storeFilter;
      }

      const data = await getTransfers(params);

      // Handle both list and single transfer response
      if ("items" in data) {
        const transfersList = (data as TransferListResponse).items;
        setTransfers(transfersList);
        updateAnalytics(transfersList);
      } else {
        // This shouldn't happen when loading transfers without id
        setTransfers([]);
        updateAnalytics([]);
      }
    } catch (err) {
      console.error("Error loading transfers:", err);
      if (!loading) {
        setError(
          err instanceof Error
            ? err.message
            : "Шилжүүлгийн мэдээлэл татахад алдаа гарлаа"
        );
      }
    }
  };

  const updateAnalytics = (transfersList: Transfer[]) => {
    const total = transfersList.length;
    const pending = transfersList.filter(
      (t) =>
        t.status === "REQUESTED" ||
        t.status === "APPROVED" ||
        t.status === "SHIPPED"
    ).length;
    const completed = transfersList.filter(
      (t) => t.status === "RECEIVED"
    ).length;
    const cancelled = transfersList.filter(
      (t) => t.status === "CANCELLED"
    ).length;

    setAnalytics({
      totalTransfers: total,
      pendingTransfers: pending,
      completedTransfers: completed,
      cancelledTransfers: cancelled,
    });
  };

  const loadStores = async () => {
    try {
      const token = await getAccessToken();
      const storesData = await getStore(token);
      setStores(storesData);
    } catch (err) {
      console.error("Error loading stores:", err);
      // For now, return empty array to prevent blocking
      setStores([]);
    }
  };

  const loadVariants = async () => {
    try {
      console.log("Starting to load variants...");
      const token = await getAccessToken();
      console.log("Got access token for variants:", token ? "✓" : "✗");

      const variantsData = await getAllProductVariants(token);
      console.log("Raw variants response:", variantsData);
      console.log("Loaded variants:", variantsData.length, "variants");

      // Log first few variants for debugging
      if (variantsData.length > 0) {
        console.log("First variant:", variantsData[0]);
      }

      setVariants(variantsData);
    } catch (err) {
      console.error("Error loading variants:", err);
      setError(
        "Барааны мэдээлэл татахад алдаа гарлаа: " +
          (err instanceof Error ? err.message : String(err))
      );
      setVariants([]);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadTransfers();
  };

  const handleTransferUpdate = () => {
    loadTransfers();
  };

  const handleViewTransfer = (transfer: Transfer) => {
    setSelectedTransferId(transfer.id);
  };

  const handleRefresh = () => {
    loadTransfers();
  };

  const handleTestProductAPI = async () => {
    try {
      console.log("Testing product API...");
      const token = await getAccessToken();
      console.log("Got token for test:", token ? "✓" : "✗");

      // Test basic product list first
      const { jwtDecode } = await import("jwt-decode");
      const decoded: any = jwtDecode(token);
      const tenant_id = decoded?.app_metadata?.tenants?.[0];
      console.log("Tenant ID:", tenant_id);

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/product?tenant_id=${tenant_id}&limit=10`;
      console.log("Testing URL:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Test response status:", response.status);
      const testData = await response.json();
      console.log("Test response data:", testData);

      if (response.ok) {
        setError(
          `API тест амжилттай: ${testData.items?.length || 0} бараа олдлоо`
        );
        // Try to reload variants after successful test
        await loadVariants();
      } else {
        setError(`API тест алдаа: ${testData.error || "Тодорхойгүй алдаа"}`);
      }
    } catch (err) {
      console.error("API test error:", err);
      setError(
        `API тест алдаа: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Filter transfers based on search term
  const filteredTransfers = transfers.filter((transfer) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    const srcStore =
      stores.find((s) => s.id === transfer.src_store_id)?.name || "";
    const dstStore =
      stores.find((s) => s.id === transfer.dst_store_id)?.name || "";

    return (
      transfer.id.toLowerCase().includes(searchLower) ||
      srcStore.toLowerCase().includes(searchLower) ||
      dstStore.toLowerCase().includes(searchLower) ||
      (transfer.note || "").toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Мэдээлэл татаж байна...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Page Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Барааны Шилжүүлэг Удирдлага
                </h1>
              </div>
              <p className="text-gray-600">
                Дэлгүүрүүдийн хоорондох барааны шилжүүлгийг бодит цагт хянаж, үр
                ашигтай удирдах
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTestProductAPI}
                className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
              >
                <Package className="h-4 w-4 mr-2" />
                API тест
              </button>

              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Шинэ Шилжүүлэг
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Нийт Шилжүүлэг
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {analytics.totalTransfers}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Хүлээгдэж байгаа
                </p>
                <p className="text-3xl font-bold text-yellow-600">
                  {analytics.pendingTransfers}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Package className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Дууссан</p>
                <p className="text-3xl font-bold text-green-600">
                  {analytics.completedTransfers}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Цуцлагдсан</p>
                <p className="text-3xl font-bold text-red-600">
                  {analytics.cancelledTransfers}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Системийн сэрэмжлүүлэг
                </h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Filters & Search */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Шилжүүлэг, дэлгүүр, тэмдэглэлээр хайх..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Шүүлтүүр:
                  </span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as TransferStatus | "")
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Бүх төлөв</option>
                  <option value="REQUESTED">Хүсэлт</option>
                  <option value="APPROVED">Зөвшөөрөгдсөн</option>
                  <option value="SHIPPED">Илгээгдсэн</option>
                  <option value="RECEIVED">Хүлээн авсан</option>
                  <option value="CANCELLED">Цуцлагдсан</option>
                </select>

                <div className="flex items-center gap-1">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Бүх дэлгүүр</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleRefresh}
                  className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Шинэчлэх
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer List */}
        <TransferList
          transfers={filteredTransfers}
          stores={stores}
          onTransferUpdate={handleTransferUpdate}
          onViewTransfer={handleViewTransfer}
        />

        {/* Create Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <TransferCreateForm
                stores={stores}
                variants={variants}
                onSuccess={handleCreateSuccess}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        )}

        {/* Transfer Detail Modal */}
        {selectedTransferId && (
          <TransferDetailModal
            transferId={selectedTransferId}
            stores={stores}
            variants={variants}
            onClose={() => setSelectedTransferId(null)}
            onUpdate={handleTransferUpdate}
          />
        )}
      </div>
    </div>
  );
}
