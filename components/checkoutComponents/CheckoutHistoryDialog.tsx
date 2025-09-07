"use client";
import { useEffect, useState } from "react";
import {
  getCheckoutOrders,
  type CheckoutOrdersList,
  type CheckoutOrder,
} from "@/lib/checkout/checkoutApi";
import { fmt } from "@/lib/sales/salesUtils";

export default function CheckoutHistoryDialog({
  open,
  onClose,
  onSelectOrder,
}: {
  open: boolean;
  onClose: () => void;
  onSelectOrder?: (order: CheckoutOrder) => void;
}) {
  const [orders, setOrders] = useState<CheckoutOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadOrders();
    }
  }, [open]);

  const loadOrders = async () => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white text-black w-full max-w-2xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Сүүлийн захиалгууд</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Ачаалж байна...</span>
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
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Захиалга олдсонгүй
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (onSelectOrder) {
                      onSelectOrder(order);
                    }
                    onClose();
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
          {orders.length > 0 && (
            <button
              onClick={loadOrders}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Шинэчлэх
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
