"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getOrderById } from "@/lib/order/orderApi";
import { fmt } from "@/lib/sales/salesUtils";

export default function ReceiptPage() {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get("orderId") || "";

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setErr(null);
    getOrderById(orderId)
      .then(setOrder)
      .catch((e) => setErr(e?.message || "Order fetch error"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    router.push("/checkout");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Баримт ачааллаж байна...</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Алдаа гарлаа</h2>
          <p className="text-gray-600 mb-4">{err}</p>
          <button
            onClick={handleBack}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Буцах
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Баримт олдсонгүй
          </h2>
          <p className="text-gray-600 mb-4">
            Захиалгын ID буруу эсвэл устсан байна
          </p>
          <button
            onClick={handleBack}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Буцах
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("mn-MN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-md mx-auto">
        {/* Screen Controls - Hide when printing */}
        <div className="mb-6 flex gap-3 print:hidden">
          <button
            onClick={handleBack}
            className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Буцах
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Хэвлэх
          </button>
        </div>

        {/* Receipt */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="bg-blue-600 text-white p-6 text-center print:bg-black">
            <h1 className="text-2xl font-bold">POS_XV</h1>
            <p className="text-blue-100 mt-1">Борлуулалтын баримт</p>
          </div>

          {/* Receipt Content */}
          <div className="p-6 font-mono text-sm">
            {/* Order Info */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Захиалга №:</span>
                  <div className="font-semibold break-all">
                    #{order.id.slice(-8)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Огноо:</span>
                  <div className="font-semibold">
                    {formatDate(order.created_at)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Дэлгүүр:</span>
                  <div className="font-semibold break-all">
                    {order.store_id.slice(-8)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Статус:</span>
                  <div className="font-semibold text-green-600">Төлөгдсөн</div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-3">Бүтээгдэхүүн</h3>
              <div className="space-y-2">
                {order.items.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="flex justify-between items-start"
                  >
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-gray-900">
                        {item.product_name || "Нэргүй бүтээгдэхүүн"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.quantity} × {fmt(item.unit_price)}
                      </div>
                    </div>
                    <div className="font-bold text-gray-900">
                      {fmt(item.quantity * item.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Дэд дүн:</span>
                  <span>{fmt(order.subtotal || order.total)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Хөнгөлөлт:</span>
                    <span>-{fmt(order.discount)}</span>
                  </div>
                )}
                {order.tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>НӨАТ:</span>
                    <span>{fmt(order.tax)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Нийт дүн:</span>
                    <span>{fmt(order.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 print:bg-white">
            <p>Худалдан авалт хийсэнд баярлалаа!</p>
            <p className="mt-1">Асуулт гарвал 7700-0000 руу залгана уу</p>
            <div className="mt-3 text-xs border-t pt-3">
              <p>Баримт хэвлэсэн: {new Date().toLocaleString("mn-MN")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
