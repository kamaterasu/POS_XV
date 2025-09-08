"use client";
import React, { useState, useEffect } from "react";
import {
  FaPrint,
  FaUndo,
  FaChartBar,
  FaDownload,
  FaCalendarAlt,
  FaArrowLeft,
} from "react-icons/fa";
import { useRouter } from "next/navigation";
import {
  getSalesSummary,
  getSalesByStore,
  getPaymentsByMethod,
  getTopVariants,
  getCategorySummary,
  getInventorySnapshot,
  getReturnsSummary,
  formatCurrency,
  formatPercentage,
  type SalesSummaryItem,
  type SalesByStoreItem,
  type PaymentsByMethodItem,
  type TopVariantItem,
  type CategorySummaryItem,
  type InventorySnapshotItem,
  type ReturnsSummaryItem,
} from "@/lib/report/reportApi";
import { Loading } from "@/components/Loading";

type ReportType = "sales" | "finance" | "inventory" | "overview";

export default function ReportPage() {
  const router = useRouter();
  const [activeReport, setActiveReport] = useState<ReportType>("overview");
  const [dateRange, setDateRange] = useState({
    from: "2025-01-01",
    to: new Date().toISOString().split("T")[0], // Today's date
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states for each report type
  const [salesData, setSalesData] = useState<SalesSummaryItem[]>([]);
  const [financeData, setFinanceData] = useState<PaymentsByMethodItem[]>([]);
  const [inventoryData, setInventoryData] = useState<InventorySnapshotItem[]>(
    []
  );
  const [overviewData, setOverviewData] = useState<any>(null);

  // Load data when report type or date range changes
  useEffect(() => {
    loadReportData();
  }, [activeReport, dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (activeReport) {
        case "sales":
          const salesResponse = await getSalesSummary({
            period: "day",
            from: dateRange.from,
            to: dateRange.to,
          });
          setSalesData(salesResponse.items);
          break;

        case "finance":
          const financeResponse = await getPaymentsByMethod({
            from: dateRange.from,
            to: dateRange.to,
          });
          setFinanceData(financeResponse.payments);
          break;

        case "inventory":
          const inventoryResponse = await getInventorySnapshot({
            only_in_stock: true,
          });
          setInventoryData(inventoryResponse.items);
          break;

        case "overview":
          // Load overview data (combination of multiple reports)
          const [salesOverview, paymentsOverview, inventoryOverview] =
            await Promise.all([
              getSalesSummary({
                period: "day",
                from: dateRange.from,
                to: dateRange.to,
              }),
              getPaymentsByMethod({ from: dateRange.from, to: dateRange.to }),
              getInventorySnapshot({ only_in_stock: true }),
            ]);

          setOverviewData({
            sales: salesOverview,
            payments: paymentsOverview,
            inventory: inventoryOverview,
          });
          break;
      }
    } catch (err) {
      console.error("Error loading report data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load report data"
      );
    } finally {
      setLoading(false);
    }
  };

  const reportTypes = [
    {
      id: "overview" as ReportType,
      label: "Ерөнхий тойм",
      icon: FaCalendarAlt,
      color: "bg-purple-500",
    },
    {
      id: "sales" as ReportType,
      label: "Борлуулалт",
      icon: FaChartBar,
      color: "bg-blue-500",
    },
    {
      id: "finance" as ReportType,
      label: "Санхүү",
      icon: FaUndo,
      color: "bg-green-500",
    },
    {
      id: "inventory" as ReportType,
      label: "Бараа материал",
      icon: FaPrint,
      color: "bg-orange-500",
    },
  ];

  const mockSalesData = [
    { period: "Өнөөдөр", sales: "1,250,000₮", orders: 45, growth: "+12%" },
    { period: "7 хоног", sales: "8,750,000₮", orders: 312, growth: "+8%" },
    { period: "Сар", sales: "35,400,000₮", orders: 1234, growth: "+15%" },
    { period: "Жил", sales: "420,000,000₮", orders: 15678, growth: "+25%" },
  ];

  const mockFinanceData = [
    {
      category: "Орлого",
      amount: "42,500,000₮",
      change: "+18%",
      color: "text-green-600",
    },
    {
      category: "Зардал",
      amount: "28,750,000₮",
      change: "-5%",
      color: "text-red-600",
    },
    {
      category: "Ашиг",
      amount: "13,750,000₮",
      change: "+45%",
      color: "text-green-600",
    },
    {
      category: "Татвар",
      amount: "4,125,000₮",
      change: "+12%",
      color: "text-orange-600",
    },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loading open={true} label="Тайлан ачаалж байна..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Алдаа гарлаа
          </h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadReportData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Дахин оролдох
          </button>
        </div>
      );
    }

    switch (activeReport) {
      case "sales":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {salesData.slice(0, 4).map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
                >
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    {item.period}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(item.total_gross)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {item.orders} захиалга
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(item.total_net)} цэвэр
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                Борлуулалтын график
              </h3>
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">График энд харагдана</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">
                Борлуулалтын дэлгэрэнгүй
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Хугацаа</th>
                      <th className="px-4 py-2 text-left">Захиалга</th>
                      <th className="px-4 py-2 text-left">Нийт дүн</th>
                      <th className="px-4 py-2 text-left">Цэвэр дүн</th>
                      <th className="px-4 py-2 text-left">Буцаалт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2 font-medium">{item.period}</td>
                        <td className="px-4 py-2">{item.orders}</td>
                        <td className="px-4 py-2">
                          {formatCurrency(item.total_gross)}
                        </td>
                        <td className="px-4 py-2">
                          {formatCurrency(item.total_net)}
                        </td>
                        <td className="px-4 py-2">
                          {formatCurrency(item.returns_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "finance":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {financeData.slice(0, 4).map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    {item.method}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(item.amount)}
                  </p>
                  <span className="text-sm font-medium text-blue-600">
                    {item.count} гүйлгээ
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Төлбөрийн арга</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Төлбөрийн арга</th>
                      <th className="px-4 py-2 text-left">Дүн</th>
                      <th className="px-4 py-2 text-left">Тоо ширхэг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeData.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2 font-medium">{item.method}</td>
                        <td className="px-4 py-2">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-2">{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Санхүүгийн тойм</h3>
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Санхүүгийн график энд харагдана</p>
              </div>
            </div>
          </div>
        );

      case "inventory":
        const totalItems = inventoryData.length;
        const lowStockItems = inventoryData.filter(
          (item) => item.qty > 0 && item.qty < 10
        ).length;
        const outOfStockItems = inventoryData.filter(
          (item) => item.qty === 0
        ).length;

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Нийт бараа
                </h3>
                <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Дуусч байгаа
                </h3>
                <p className="text-2xl font-bold text-red-600">
                  {lowStockItems}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Дууссан
                </h3>
                <p className="text-2xl font-bold text-orange-600">
                  {outOfStockItems}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Барааны жагсаалт</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Барааны нэр</th>
                      <th className="px-4 py-2 text-left">SKU</th>
                      <th className="px-4 py-2 text-left">Үлдэгдэл</th>
                      <th className="px-4 py-2 text-left">Үнэ</th>
                      <th className="px-4 py-2 text-left">Төлөв</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {inventoryData.slice(0, 20).map((item, index) => {
                      const status =
                        item.qty === 0
                          ? "Дууссан"
                          : item.qty < 10
                          ? "Бага"
                          : "Хангалттай";

                      return (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2">
                            {item.product_name || item.variant_name || "Нэргүй"}
                          </td>
                          <td className="px-4 py-2">{item.sku || "-"}</td>
                          <td className="px-4 py-2">{item.qty}</td>
                          <td className="px-4 py-2">
                            {formatCurrency(item.cost)}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                status === "Хангалттай"
                                  ? "bg-green-100 text-green-800"
                                  : status === "Бага"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "overview":
        if (!overviewData) {
          return (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">Ерөнхий тойм ачаалж байна...</p>
            </div>
          );
        }

        const todayData = overviewData.sales?.items?.[0];
        const totalInventoryValue = overviewData.inventory?.totals?.value || 0;
        const totalOrders = todayData?.orders || 0;
        const totalRevenue = todayData?.total_gross || 0;

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Өнөөдрийн орлого
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Захиалга
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  {totalOrders}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Агуулахын үнэ цэнэ
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalInventoryValue)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Буцаалт
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(todayData?.returns_value || 0)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Төлбөрийн аргууд</h3>
                <div className="space-y-3">
                  {overviewData.payments?.payments
                    ?.slice(0, 5)
                    .map((payment: PaymentsByMethodItem, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center py-2 border-b"
                      >
                        <div>
                          <span className="font-medium">{payment.method}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {payment.count} гүйлгээ
                          </span>
                        </div>
                        <span className="font-bold text-green-600">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Системийн тайлан</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Нийт бараа:</span>
                    <span className="font-medium">
                      {overviewData.inventory?.items?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Агуулахын үнэ цэнэ:</span>
                    <span className="font-medium">
                      {formatCurrency(totalInventoryValue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Өнөөдрийн борлуулалт:</span>
                    <span className="font-medium">
                      {formatCurrency(totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Системийн статус:</span>
                    <span className="font-medium text-green-600">Хэвийн</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Тайлан сонгоно уу</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-4 text-black inline-flex items-center justify-center hover:bg-gray-50 transition-colors"
            >
              <FaArrowLeft className="mr-2" />
              Буцах
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Тайлан</h1>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Эхлэх:
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Дуусах:
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              />
            </div>
            <button
              onClick={loadReportData}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors flex items-center gap-2 mr-2"
              disabled={loading}
            >
              <FaUndo className={loading ? "animate-spin" : ""} />
              Сэргээх
            </button>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2">
              <FaDownload />
              Татах
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg border-r border-gray-200 min-h-[calc(100vh-80px)]">
          <div className="p-4">
            <div className="space-y-2">
              {reportTypes.map((report) => {
                const IconComponent = report.icon;
                return (
                  <button
                    key={report.id}
                    onClick={() => setActiveReport(report.id)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                      activeReport === report.id
                        ? "bg-blue-50 text-blue-700 border-l-4 border-blue-500"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${report.color} flex items-center justify-center mr-3`}
                    >
                      <IconComponent className="text-white text-sm" />
                    </div>
                    <span className="font-medium">{report.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">{renderContent()}</main>
      </div>
    </div>
  );
}
