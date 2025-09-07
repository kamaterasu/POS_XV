"use client";
import React, { useState } from "react";
import {
  FaPrint,
  FaUndo,
  FaChartBar,
  FaDownload,
  FaCalendarAlt,
  FaArrowLeft,
} from "react-icons/fa";
import { useRouter } from "next/navigation";

type ReportType = "sales" | "finance" | "inventory" | "overview";

export default function ReportPage() {
  const router = useRouter();
  const [activeReport, setActiveReport] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState({
    from: "2024-01-01",
    to: "2024-12-31",
  });

  const reportTypes = [
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
    {
      id: "overview" as ReportType,
      label: "Ерөнхий тойм",
      icon: FaCalendarAlt,
      color: "bg-purple-500",
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
    switch (activeReport) {
      case "sales":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockSalesData.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500"
                >
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    {item.period}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {item.sales}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      {item.orders} захиалга
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {item.growth}
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
                Шилдэг бүтээгдэхүүн
              </h3>
              <div className="space-y-3">
                {["Бүтээгдэхүүн 1", "Бүтээгдэхүүн 2", "Бүтээгдэхүүн 3"].map(
                  (product, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2 border-b"
                    >
                      <span className="font-medium">{product}</span>
                      <span className="text-gray-600">
                        {150 - index * 20} ширхэг
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        );

      case "finance":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockFinanceData.map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    {item.category}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {item.amount}
                  </p>
                  <span className={`text-sm font-medium ${item.color}`}>
                    {item.change}
                  </span>
                </div>
              ))}
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
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Нийт бараа
                </h3>
                <p className="text-2xl font-bold text-gray-900">1,234</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Дуусч байгаа
                </h3>
                <p className="text-2xl font-bold text-red-600">23</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Дууссан
                </h3>
                <p className="text-2xl font-bold text-orange-600">5</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Барааны жагсаалт</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Барааны нэр</th>
                      <th className="px-4 py-2 text-left">Үлдэгдэл</th>
                      <th className="px-4 py-2 text-left">Үнэ</th>
                      <th className="px-4 py-2 text-left">Төлөв</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {[
                      {
                        name: "Бараа 1",
                        stock: 45,
                        price: "15,000₮",
                        status: "Хангалттай",
                      },
                      {
                        name: "Бараа 2",
                        stock: 12,
                        price: "25,000₮",
                        status: "Бага",
                      },
                      {
                        name: "Бараа 3",
                        stock: 0,
                        price: "30,000₮",
                        status: "Дууссан",
                      },
                    ].map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">{item.stock}</td>
                        <td className="px-4 py-2">{item.price}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              item.status === "Хангалттай"
                                ? "bg-green-100 text-green-800"
                                : item.status === "Бага"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.status}
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

      case "overview":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Өнөөдрийн орлого
                </h3>
                <p className="text-2xl font-bold text-gray-900">1,250,000₮</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Захиалга
                </h3>
                <p className="text-2xl font-bold text-gray-900">45</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Үйлчлүүлэгч
                </h3>
                <p className="text-2xl font-bold text-gray-900">38</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Буцаалт
                </h3>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Сүүлийн гүйлгээ</h3>
                <div className="space-y-3">
                  {[
                    { time: "14:30", amount: "25,000₮", type: "Борлуулалт" },
                    { time: "14:15", amount: "15,000₮", type: "Борлуулалт" },
                    { time: "13:45", amount: "-5,000₮", type: "Буцаалт" },
                  ].map((transaction, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2 border-b"
                    >
                      <div>
                        <span className="font-medium">{transaction.type}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {transaction.time}
                        </span>
                      </div>
                      <span
                        className={`font-bold ${
                          transaction.amount.startsWith("-")
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {transaction.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Системийн тайлан</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Идэвхтэй хэрэглэгч:</span>
                    <span className="font-medium">5</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Салбар:</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Сүүлийн backup:</span>
                    <span className="font-medium">Өнөөдөр 09:00</span>
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
