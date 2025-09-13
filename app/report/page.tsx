"use client";
import React, { useState, useEffect } from "react";
import {
  FaPrint,
  FaUndo,
  FaChartBar,
  FaDownload,
  FaCalendarAlt,
  FaArrowLeft,
  FaChartLine,
  FaMoneyBillWave,
  FaBox,
  FaPercentage,
  FaQuestionCircle,
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
  getReturnsByStore,
  getTopReturnedVariants,
  getRefundsByMethod,
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
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ReportType =
  | "sales"
  | "finance"
  | "inventory"
  | "overview"
  | "products"
  | "returns";

// Chart colors
const CHART_COLORS = {
  primary: "#3B82F6",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  rose: "#F43F5E",
  indigo: "#6366F1",
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.accent,
  CHART_COLORS.purple,
  CHART_COLORS.teal,
  CHART_COLORS.rose,
  CHART_COLORS.indigo,
  CHART_COLORS.danger,
];

// Helper function to format chart data
const formatSalesChartData = (salesData: SalesSummaryItem[]) => {
  return salesData.map((item) => ({
    name: item.period,
    value: item.total_gross,
    orders: item.orders,
    net: item.total_net,
  }));
};

const formatPaymentChartData = (financeData: PaymentsByMethodItem[]) => {
  return financeData.map((item, index) => ({
    name: item.method,
    value: item.amount,
    count: item.count,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));
};

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
  const [productsData, setProductsData] = useState<{
    topVariants: TopVariantItem[];
    categories: CategorySummaryItem[];
    salesByStore: SalesByStoreItem[];
  }>({ topVariants: [], categories: [], salesByStore: [] });
  const [returnsData, setReturnsData] = useState<{
    summary: ReturnsSummaryItem[];
    byStore: any[];
    topReturned: any[];
    refundsByMethod: any[];
  }>({ summary: [], byStore: [], topReturned: [], refundsByMethod: [] });

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

        case "products":
          const [
            topVariantsResponse,
            categoriesResponse,
            salesByStoreResponse,
          ] = await Promise.all([
            getTopVariants({
              limit: 10,
              from: dateRange.from,
              to: dateRange.to,
            }),
            getCategorySummary({
              from: dateRange.from,
              to: dateRange.to,
            }),
            getSalesByStore({
              from: dateRange.from,
              to: dateRange.to,
            }),
          ]);

          setProductsData({
            topVariants: topVariantsResponse.items,
            categories: categoriesResponse.items,
            salesByStore: salesByStoreResponse.items,
          });
          break;

        case "returns":
          const [
            returnsSummaryResponse,
            returnsByStoreResponse,
            topReturnedResponse,
            refundsByMethodResponse,
          ] = await Promise.all([
            getReturnsSummary({
              period: "day",
              from: dateRange.from,
              to: dateRange.to,
            }),
            getReturnsByStore({
              from: dateRange.from,
              to: dateRange.to,
            }),
            getTopReturnedVariants({
              limit: 10,
              from: dateRange.from,
              to: dateRange.to,
            }),
            getRefundsByMethod({
              from: dateRange.from,
              to: dateRange.to,
            }),
          ]);

          setReturnsData({
            summary: returnsSummaryResponse.items,
            byStore: returnsByStoreResponse.items,
            topReturned: topReturnedResponse.items,
            refundsByMethod: refundsByMethodResponse.items,
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
      color: "bg-gradient-to-r from-purple-500 to-purple-600",
      hoverColor: "hover:from-purple-600 hover:to-purple-700",
    },
    {
      id: "sales" as ReportType,
      label: "Борлуулалт",
      icon: FaChartBar,
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
    },
    {
      id: "finance" as ReportType,
      label: "Санхүү",
      icon: FaMoneyBillWave,
      color: "bg-gradient-to-r from-green-500 to-green-600",
      hoverColor: "hover:from-green-600 hover:to-green-700",
    },
    {
      id: "inventory" as ReportType,
      label: "Бараа материал",
      icon: FaBox,
      color: "bg-gradient-to-r from-orange-500 to-orange-600",
      hoverColor: "hover:from-orange-600 hover:to-orange-700",
    },
    {
      id: "products" as ReportType,
      label: "Барааны тайлан",
      icon: FaChartLine,
      color: "bg-gradient-to-r from-indigo-500 to-indigo-600",
      hoverColor: "hover:from-indigo-600 hover:to-indigo-700",
    },
    {
      id: "returns" as ReportType,
      label: "Буцаалтын тайлан",
      icon: FaUndo,
      color: "bg-gradient-to-r from-red-500 to-red-600",
      hoverColor: "hover:from-red-600 hover:to-red-700",
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
          <div className="space-y-8">
            {/* Sales Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {salesData.slice(0, 4).map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border-l-4 border-blue-500 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      {item.period}
                    </h3>
                    <FaChartLine className="text-blue-500 text-lg" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(item.total_gross)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                      {item.orders} захиалга
                    </span>
                    <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      {formatCurrency(item.total_net)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sales Trend Chart */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <FaChartBar className="mr-3 text-blue-500" />
                  Борлуулалтын хандлага
                </h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formatSalesChartData(salesData)}>
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.primary}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: any, name: string) => [
                        formatCurrency(value),
                        name === "value"
                          ? "Нийт борлуулалт"
                          : name === "net"
                          ? "Цэвэр орлого"
                          : name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.primary}
                      fillOpacity={1}
                      fill="url(#salesGradient)"
                      strokeWidth={3}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke={CHART_COLORS.secondary}
                      fillOpacity={0.6}
                      fill={CHART_COLORS.secondary}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Sales Table */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaChartBar className="mr-3 text-blue-500" />
                Борлуулалтын дэлгэрэнгүй
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tl-lg">
                        Хугацаа
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Захиалга
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Нийт дүн
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Цэвэр дүн
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tr-lg">
                        Буцаалт
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesData.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors duration-200"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {item.period}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {item.orders}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {formatCurrency(item.total_gross)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-green-600">
                          {formatCurrency(item.total_net)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-red-600">
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
          <div className="space-y-8">
            {/* Payment Method Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {financeData.slice(0, 4).map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      {item.method}
                    </h3>
                    <FaMoneyBillWave className="text-green-500 text-lg" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-2">
                    {formatCurrency(item.amount)}
                  </p>
                  <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {item.count} гүйлгээ
                  </span>
                </div>
              ))}
            </div>

            {/* Payment Methods Distribution Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaMoneyBillWave className="mr-3 text-green-500" />
                  Төлбөрийн хэлбэрийн хуваарилалт
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={formatPaymentChartData(financeData)}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {formatPaymentChartData(financeData).map(
                          (entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          )
                        )}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: any) => [
                          formatCurrency(value),
                          "Дүн",
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-sm font-medium">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods Bar Chart */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaChartBar className="mr-3 text-blue-500" />
                  Гүйлгээний тоо
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formatPaymentChartData(financeData)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: any) => [value, "Гүйлгээний тоо"]}
                      />
                      <Bar
                        dataKey="count"
                        fill={CHART_COLORS.primary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Payment Table */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaMoneyBillWave className="mr-3 text-green-500" />
                Төлбөрийн дэлгэрэнгүй
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tl-lg">
                        Төлбөрийн арга
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Дүн
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tr-lg">
                        Тоо ширхэг
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {financeData.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors duration-200"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {item.method}
                        </td>
                        <td className="px-6 py-4 font-semibold text-green-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {item.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
        const inStockItems = totalItems - outOfStockItems;

        const inventoryChartData = [
          {
            name: "Хангалттай",
            value: inStockItems - lowStockItems,
            color: CHART_COLORS.secondary,
          },
          {
            name: "Дуусч байгаа",
            value: lowStockItems,
            color: CHART_COLORS.accent,
          },
          {
            name: "Дууссан",
            value: outOfStockItems,
            color: CHART_COLORS.danger,
          },
        ];

        return (
          <div className="space-y-8">
            {/* Inventory Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Нийт бараа
                  </h3>
                  <FaBox className="text-blue-500 text-xl" />
                </div>
                <p className="text-4xl font-bold text-gray-900">{totalItems}</p>
                <p className="text-sm text-gray-500 mt-2">Нийт барааны тоо</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Дуусч байгаа
                  </h3>
                  <FaBox className="text-yellow-500 text-xl" />
                </div>
                <p className="text-4xl font-bold text-yellow-600">
                  {lowStockItems}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  10-аас доош үлдэгдэлтэй
                </p>
              </div>
              <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                    Дууссан
                  </h3>
                  <FaBox className="text-red-500 text-xl" />
                </div>
                <p className="text-4xl font-bold text-red-600">
                  {outOfStockItems}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Үлдэгдэлгүй барааууд
                </p>
              </div>
            </div>

            {/* Inventory Status Chart */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaChartBar className="mr-3 text-blue-500" />
                Агуулахын төлөв
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      innerRadius={50}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {inventoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: any) => [value, "Барааны тоо"]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-sm font-medium">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Details Table */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaBox className="mr-3 text-blue-500" />
                Барааны жагсаалт
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tl-lg">
                        Барааны нэр
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        SKU
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Үлдэгдэл
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Үнэ
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tr-lg">
                        Төлөв
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inventoryData.slice(0, 20).map((item, index) => {
                      const status =
                        item.qty === 0
                          ? "Дууссан"
                          : item.qty < 10
                          ? "Бага"
                          : "Хангалттай";

                      const statusColor =
                        item.qty === 0
                          ? "bg-red-100 text-red-800"
                          : item.qty < 10
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800";

                      return (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {item.product_name || item.variant_name || "Нэргүй"}
                          </td>
                          <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                            {item.sku || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-lg font-bold text-gray-900">
                              {item.qty}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {formatCurrency(item.cost)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
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

      case "products":
        return (
          <div className="space-y-8">
            {/* Top Selling Products */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaChartLine className="mr-3 text-indigo-500" />
                Хамгийн их зарагдсан барааууд
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tl-lg">
                        Барааны нэр
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        SKU
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Зарагдсан тоо
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Орлого
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tr-lg">
                        Цэвэр орлого
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productsData.topVariants
                      .slice(0, 10)
                      .map((item, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {item.product_name || item.variant_name || "Нэргүй"}
                          </td>
                          <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                            {item.sku || "-"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {item.net_qty}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-green-600">
                            {formatCurrency(item.sold_revenue)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-green-700">
                            {formatCurrency(item.net_revenue)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Sales Chart */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaChartBar className="mr-3 text-indigo-500" />
                Ангиллаар борлуулалт
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productsData.categories.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="category_name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: any, name: string) => [
                        formatCurrency(value),
                        name === "net_revenue" ? "Цэвэр орлого" : "Орлого",
                      ]}
                    />
                    <Bar
                      dataKey="net_revenue"
                      fill={CHART_COLORS.indigo}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Store */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaBox className="mr-3 text-indigo-500" />
                Дэлгүүрээр борлуулалт
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productsData.salesByStore.map((store, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6"
                  >
                    <h4 className="font-semibold text-gray-900 mb-3">
                      {store.store_name || `Дэлгүүр ${store.store_id}`}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Захиалга:</span>
                        <span className="font-medium">{store.orders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Нийт дүн:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(store.total_gross)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">
                          Цэвэр дүн:
                        </span>
                        <span className="font-bold text-green-700">
                          {formatCurrency(store.total_net)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "returns":
        if (!returnsData) {
          return (
            <div className="flex items-center justify-center h-64">
              <Loading open={true} />
            </div>
          );
        }

        return (
          <div className="space-y-8">
            {/* Returns Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white shadow-lg">
                <FaUndo className="text-3xl mb-3 opacity-80" />
                <h3 className="text-sm font-medium opacity-90 uppercase tracking-wide">
                  Нийт буцаалт
                </h3>
                <p className="text-2xl font-bold">
                  {returnsData.summary?.length || 0}
                </p>
                <p className="text-sm opacity-80 mt-2">Өнөөдрийн буцаалт</p>
              </div>

              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                <FaMoneyBillWave className="text-3xl mb-3 opacity-80" />
                <h3 className="text-sm font-medium opacity-90 uppercase tracking-wide">
                  Буцаасан дүн
                </h3>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    returnsData.summary?.reduce(
                      (sum, item) => sum + (item.refunds_value || 0),
                      0
                    ) || 0
                  )}
                </p>
                <p className="text-sm opacity-80 mt-2">Нийт буцаасан мөнгө</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white shadow-lg">
                <FaPercentage className="text-3xl mb-3 opacity-80" />
                <h3 className="text-sm font-medium opacity-90 uppercase tracking-wide">
                  Буцаалтын хувь
                </h3>
                <p className="text-2xl font-bold">5.2%</p>
                <p className="text-sm opacity-80 mt-2">Нийт борлуулалтаас</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <FaBox className="text-3xl mb-3 opacity-80" />
                <h3 className="text-sm font-medium opacity-90 uppercase tracking-wide">
                  Буцаасан барааны тоо
                </h3>
                <p className="text-2xl font-bold">
                  {returnsData.summary?.reduce(
                    (sum, item) => sum + (item.qty || 0),
                    0
                  ) || 0}
                </p>
                <p className="text-sm opacity-80 mt-2">Өнөөдрийн буцаалт</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Return Trends Chart */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaChartLine className="mr-3 text-red-500" />
                  Буцаалтын чиг хандлага
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={returnsData.summary}>
                      <defs>
                        <linearGradient
                          id="returnsTrend"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={CHART_COLORS.danger}
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor={CHART_COLORS.danger}
                            stopOpacity={0.1}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="period"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6B7280" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: any, name: string) => [
                          value,
                          name === "returns" ? "Буцаалт" : "Дүн",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="refunds_value"
                        stroke={CHART_COLORS.danger}
                        fillOpacity={1}
                        fill="url(#returnsTrend)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Refunds by Payment Method */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaMoneyBillWave className="mr-3 text-orange-500" />
                  Төлбөрийн аргаар буцаалт
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={returnsData.refundsByMethod}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) =>
                          `${name} ${(percent || 0 * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {returnsData.refundsByMethod.map(
                          (entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                Object.values(CHART_COLORS)[
                                  index % Object.values(CHART_COLORS).length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: any) => [
                          formatCurrency(value),
                          "Буцаасан дүн",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Returned Products */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaBox className="mr-3 text-red-500" />
                Хамгийн их буцаагдсан бараанууд
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tl-lg">
                        Барааны нэр
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Буцаасан тоо
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Буцаасан дүн
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700">
                        Буцаалтын шалтгаан
                      </th>
                      <th className="px-6 py-4 text-left font-semibold text-gray-700 rounded-tr-lg">
                        Буцаалтын хувь
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {returnsData.topReturned
                      .slice(0, 10)
                      .map((item: any, index: number) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 transition-colors duration-200"
                        >
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            {item.product_name || item.variant_name || "Нэргүй"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                              {item.qty || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-red-600">
                            {formatCurrency(item.refund_amount || 0)}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {item.reason || "Тодорхойгүй"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                              0%
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return Reasons - Using store data as example */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <FaQuestionCircle className="mr-3 text-purple-500" />
                Дэлгүүрээр буцаалт
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={returnsData.byStore.slice(0, 5)}
                    layout="horizontal"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6B7280" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="store_name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: any) => [value, "Тоо хэмжээ"]}
                    />
                    <Bar
                      dataKey="qty"
                      fill={CHART_COLORS.purple}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      default:
        if (!overviewData) {
          return (
            <div className="flex items-center justify-center h-64">
              <Loading open={true} label="Ерөнхий тойм ачаалж байна..." />
            </div>
          );
        }

        const todayData = overviewData.sales?.items?.[0];
        const totalInventoryValue = overviewData.inventory?.totals?.value || 0;
        const totalOrders = todayData?.orders || 0;
        const totalRevenue = todayData?.total_gross || 0;

        return (
          <div className="space-y-8">
            {/* Overview Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
                    Өнөөдрийн орлого
                  </h3>
                  <FaChartLine className="text-white text-xl opacity-80" />
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(totalRevenue)}
                </p>
                <p className="text-sm opacity-80 mt-2">Нийт борлуулалт</p>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
                    Захиалга
                  </h3>
                  <FaChartBar className="text-white text-xl opacity-80" />
                </div>
                <p className="text-3xl font-bold">{totalOrders}</p>
                <p className="text-sm opacity-80 mt-2">Өнөөдрийн захиалгууд</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
                    Агуулахын үнэ цэнэ
                  </h3>
                  <FaBox className="text-white text-xl opacity-80" />
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(totalInventoryValue)}
                </p>
                <p className="text-sm opacity-80 mt-2">Нийт барааны үнэ</p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 text-white transform hover:-translate-y-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide opacity-90">
                    Буцаалт
                  </h3>
                  <FaUndo className="text-white text-xl opacity-80" />
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(todayData?.returns_value || 0)}
                </p>
                <p className="text-sm opacity-80 mt-2">Өнөөдрийн буцаалт</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Methods */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaMoneyBillWave className="mr-3 text-green-500" />
                  Төлбөрийн аргууд
                </h3>
                <div className="space-y-4">
                  {overviewData.payments?.payments
                    ?.slice(0, 5)
                    .map((payment: PaymentsByMethodItem, index: number) => {
                      const percentage = overviewData.payments?.payments
                        ? (payment.amount /
                            overviewData.payments.payments.reduce(
                              (sum: number, p: PaymentsByMethodItem) =>
                                sum + p.amount,
                              0
                            )) *
                          100
                        : 0;

                      return (
                        <div key={index} className="group">
                          <div className="flex justify-between items-center py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                            <div className="flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-3"
                                style={{
                                  backgroundColor:
                                    PIE_COLORS[index % PIE_COLORS.length],
                                }}
                              ></div>
                              <div>
                                <span className="font-semibold text-gray-900">
                                  {payment.method}
                                </span>
                                <div className="text-sm text-gray-500">
                                  {payment.count} гүйлгээ
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-green-600 text-lg">
                                {formatCurrency(payment.amount)}
                              </span>
                              <div className="text-sm text-gray-500">
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* System Status */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                  <FaChartBar className="mr-3 text-blue-500" />
                  Системийн тайлан
                </h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Нийт бараа:
                    </span>
                    <span className="font-bold text-gray-900 text-lg">
                      {overviewData.inventory?.items?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Агуулахын үнэ цэнэ:
                    </span>
                    <span className="font-bold text-purple-600 text-lg">
                      {formatCurrency(totalInventoryValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">
                      Өнөөдрийн борлуулалт:
                    </span>
                    <span className="font-bold text-green-600 text-lg">
                      {formatCurrency(totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                    <span className="font-medium text-gray-700">
                      Системийн статус:
                    </span>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="font-bold text-green-700">Хэвийн</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="bg-white rounded-xl border border-gray-200 shadow-md h-11 px-5 text-gray-700 inline-flex items-center justify-center hover:bg-gray-50 hover:shadow-lg transition-all duration-200 font-medium"
            >
              <FaArrowLeft className="mr-2" />
              Буцах
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Тайлан</h1>
              <p className="text-sm text-gray-500 mt-1">
                Борлуулалт болон агуулахын тайлан
              </p>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 shadow-md">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 min-w-max">
                Эхлэх:
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 min-w-max">
                Дуусах:
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadReportData}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow-md hover:shadow-lg"
                disabled={loading}
              >
                <FaUndo className={loading ? "animate-spin" : ""} />
                Сэргээх
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white shadow-xl border-r border-gray-200 min-h-[calc(100vh-88px)]">
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              Тайлангийн төрөл
            </h2>
            <div className="space-y-3">
              {reportTypes.map((report) => {
                const IconComponent = report.icon;
                return (
                  <button
                    key={report.id}
                    onClick={() => setActiveReport(report.id)}
                    className={`w-full flex items-center px-4 py-4 rounded-xl transition-all duration-200 group ${
                      activeReport === report.id
                        ? "bg-blue-50 text-blue-700 shadow-md border-2 border-blue-200 transform scale-[1.02]"
                        : "text-gray-700 hover:bg-gray-50 hover:shadow-md hover:transform hover:scale-[1.01]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl ${report.color} ${report.hoverColor} flex items-center justify-center mr-4 transition-all duration-200 shadow-md`}
                    >
                      <IconComponent className="text-white text-lg" />
                    </div>
                    <span className="font-semibold text-base">
                      {report.label}
                    </span>
                    {activeReport === report.id && (
                      <div className="ml-auto">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8">{renderContent()}</main>
      </div>
    </div>
  );
}
