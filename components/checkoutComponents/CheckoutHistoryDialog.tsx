"use client";
import { useEffect, useState } from "react";
import {
  getCheckoutOrders,
  type CheckoutOrdersList,
  type CheckoutOrder,
  type CheckoutOrderDetail,
} from "@/lib/checkout/checkoutApi";
import { fmt } from "@/lib/sales/salesUtils";

interface CheckoutHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectOrder?: (order: CheckoutOrder) => void;
  orderHistory?: CheckoutOrdersList | null;
  loadingHistory?: boolean;
  orderSearchTerm?: string;
  onSearchChange?: (term: string) => void;
  onLoadHistory?: () => void;
  onViewOrderDetail?: (orderId: string) => void;
  selectedOrderDetail?: CheckoutOrderDetail | null;
  loadingOrderDetail?: boolean;
  onCloseOrderDetail?: () => void;
}

export default function CheckoutHistoryDialog({
  open,
  onClose,
  onSelectOrder,
  orderHistory,
  loadingHistory = false,
  orderSearchTerm = "",
  onSearchChange,
  onLoadHistory,
  onViewOrderDetail,
  selectedOrderDetail,
  loadingOrderDetail = false,
  onCloseOrderDetail,
}: CheckoutHistoryDialogProps) {
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && onLoadHistory && !orderHistory) {
      onLoadHistory();
    }
  }, [open, onLoadHistory, orderHistory]);

  // Use parent's order data or fallback to local state
  const displayOrders = orderHistory?.items || orders;
  const displayLoading = loadingHistory || loading;

  const loadOrders = async () => {
    if (onLoadHistory) {
      onLoadHistory();
      return;
    }

    // Fallback to local loading if parent doesn't provide onLoadHistory
    setLoading(true);
    setError(null);
    try {
      const result = await getCheckoutOrders(undefined, 20, 0);
      if (result) {
        setOrders(result.items);
      } else {
        setError("Захиалга ачаалахад алдаа гарлаа");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Тодорхойгүй алдаа");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("mn-MN") +
      " " +
      date.toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "Хүргэгдсэн";
      case "pending":
        return "Хүлээж байна";
      case "cancelled":
        return "Цуцлагдсан";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "text-green-600 bg-green-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white text-black w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom duration-400 ease-out">
        {/* Clean Header */}
        <div className="relative p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Захиалгын түүх
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Хийсэн захиалгуудын түүх болон дэлгэрэнгүй мэдээлэл
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-all duration-200"
            >
              <svg
                className="w-5 h-5 text-gray-600 hover:text-gray-800 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Clean Search Bar */}
          {onSearchChange && (
            <div className="relative group">
              <input
                type="text"
                placeholder="🔍 Захиалгын дугаар эсвэл огноогоор хайх..."
                value={orderSearchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-12 border border-gray-300 rounded-lg px-4 pl-12 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 bg-white placeholder:text-gray-500"
              />
              <svg
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {orderSearchTerm && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                  title="Цэвэрлэх"
                >
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clean Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {displayLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <span className="text-lg font-medium text-gray-700">
                  Ачаалж байна...
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Захиалгын түүх ачаалж байна
                </p>
              </div>
            </div>
          ) : displayLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <span className="text-lg font-medium text-gray-700">
                  Ачаалж байна...
                </span>
                <p className="text-sm text-gray-500 mt-1">
                  Захиалгын түүх ачаалж байна
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              {error}
              <button
                onClick={loadOrders}
                className="block mx-auto mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Дахин оролдох
              </button>
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {orderSearchTerm
                ? "Хайлтын үр дүн олдсонгүй"
                : "Захиалга олдсонгүй"}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {displayOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (onViewOrderDetail) {
                      onViewOrderDetail(order.id);
                    } else if (onSelectOrder) {
                      onSelectOrder(order);
                      onClose();
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          #{order.order_no || order.id.slice(-8)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusText(order.status)}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        {formatDate(order.created_at)}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Дүн:{" "}
                          <span className="font-medium">
                            {fmt(order.subtotal)}
                          </span>
                          {order.discount > 0 && (
                            <span className="text-red-600">
                              {" "}
                              (-{fmt(order.discount)})
                            </span>
                          )}
                          {order.tax > 0 && (
                            <span className="text-amber-600">
                              {" "}
                              (+{fmt(order.tax)})
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-blue-600">
                          {fmt(order.total)}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 text-gray-400">
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Хаах
          </button>
          {displayOrders.length > 0 && (
            <button
              onClick={loadOrders}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Шинэчлэх
            </button>
          )}
        </div>

        {/* Order Detail Modal */}
        {selectedOrderDetail && onCloseOrderDetail && (
          <div className="absolute inset-0 bg-white z-10">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Захиалгын дэлгэрэнгүй #
                {selectedOrderDetail.order.order_no ||
                  selectedOrderDetail.order.id.slice(-8)}
              </h3>
              <button
                onClick={onCloseOrderDetail}
                className="text-gray-500 hover:text-gray-700 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4">
              {loadingOrderDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Ачаалж байна...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Order Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Захиалгын мэдээлэл</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        Дугаар:{" "}
                        {selectedOrderDetail.order.order_no ||
                          selectedOrderDetail.order.id}
                      </div>
                      <div>
                        Статус:{" "}
                        {getStatusText(selectedOrderDetail.order.status)}
                      </div>
                      <div>
                        Огноо:{" "}
                        {formatDate(selectedOrderDetail.order.created_at)}
                      </div>
                      <div>Дэлгүүр: {selectedOrderDetail.order.store_id}</div>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="font-medium mb-2">Бүтээгдэхүүн</h4>
                    <div className="space-y-2">
                      {selectedOrderDetail.items.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3 border rounded"
                        >
                          <div>
                            <div className="font-medium">
                              Variant: {item.variant_id}
                            </div>
                            <div className="text-sm text-gray-600">
                              {item.quantity} × {fmt(item.unit_price)}
                            </div>
                          </div>
                          <div className="font-medium">
                            {fmt(item.quantity * item.unit_price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payments */}
                  <div>
                    <h4 className="font-medium mb-2">Төлбөр</h4>
                    <div className="space-y-2">
                      {selectedOrderDetail.payments.map((payment, index) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-3 border rounded"
                        >
                          <div>
                            <div className="font-medium">{payment.method}</div>
                            <div className="text-sm text-gray-600">
                              {formatDate(payment.paid_at)}
                            </div>
                          </div>
                          <div className="font-medium">
                            {fmt(payment.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Дэд дүн:</span>
                        <span>{fmt(selectedOrderDetail.order.subtotal)}</span>
                      </div>
                      {selectedOrderDetail.order.discount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Хөнгөлөлт:</span>
                          <span>
                            -{fmt(selectedOrderDetail.order.discount)}
                          </span>
                        </div>
                      )}
                      {selectedOrderDetail.order.tax > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Татвар:</span>
                          <span>{fmt(selectedOrderDetail.order.tax)}</span>
                        </div>
                      )}
                      <hr />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Нийт:</span>
                        <span>{fmt(selectedOrderDetail.order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t p-4 flex justify-end gap-2">
              <button
                onClick={onCloseOrderDetail}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Буцах
              </button>
              {onSelectOrder && (
                <button
                  onClick={() => {
                    onSelectOrder(selectedOrderDetail.order);
                    onClose();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Баримт харах
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
