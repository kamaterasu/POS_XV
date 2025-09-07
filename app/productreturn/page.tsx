"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import {
  createReturn,
  getReturnsByOrder,
  mapPaymentMethod,
  mapReturnReason,
  type CreateReturnRequest,
} from "@/lib/return/returnApi";
import { searchOrderByDocumentNumber, type Order } from "@/lib/order/orderApi";

type ReturnReason = "size" | "damaged" | "wrong" | "unsatisfied" | "other";
type PaymentMethod = "original" | "cash" | "card";

type ToastType = "success" | "error" | "warning" | "info";
type Toast = {
  id: string;
  type: ToastType;
  title: string;
  message: string;
};

interface ReturnItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  order_item_id?: string;
  variant_id?: string;
}

export default function ProductReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [documentNumber, setDocumentNumber] = useState("");
  const [selectedReason, setSelectedReason] = useState<ReturnReason>("size");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethod>("original");
  const [customReason, setCustomReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [orderFound, setOrderFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast functions
  const addToast = (type: ToastType, title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Get order_id from URL params if available
  useEffect(() => {
    const orderId = searchParams.get("order_id");
    if (orderId) {
      setDocumentNumber(orderId);
      handleSearch(orderId);
    }
  }, [searchParams]);

  const reasons = [
    { id: "size", label: "Хэмжээ таараагүй", icon: "📏" },
    { id: "damaged", label: "Эвдэрсэн", icon: "⚠️" },
    { id: "wrong", label: "Буруу бараа", icon: "❌" },
    { id: "unsatisfied", label: "Сэтгэл ханамжгүй", icon: "😞" },
    { id: "other", label: "Бусад", icon: "📝" },
  ];

  const paymentMethods = [
    { id: "bank", label: "Дансаар", icon: "🏦" },
    { id: "qpay", label: "Qpay", icon: "�" },
    { id: "cash", label: "Бэлнээр", icon: "💵" },
    { id: "card", label: "Картаар", icon: "💳" },
  ];

  const handleSearch = useCallback(
    async (orderNumber?: string) => {
      const searchNumber = orderNumber || documentNumber;
      if (!searchNumber.trim()) {
        setError("Баримтын дугаар оруулна уу");
        addToast("warning", "Анхааруулга", "Баримтын дугаар оруулна уу");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        const tenantId = await getTenantId();

        if (!tenantId) {
          throw new Error("Tenant ID олдсонгүй");
        }

        // Fetch the actual order from backend using receipt API
        const order = await searchOrderByDocumentNumber(
          token,
          searchNumber.trim()
        );

        if (!order) {
          throw new Error(
            "Баримт олдсонгүй. Дугаарыг шалгаад дахин оролдоно уу."
          );
        }

        setCurrentOrder(order);

        // Get existing returns for this order to calculate remaining returnable quantities
        let existingReturns: any[] = [];
        try {
          const returnsResponse = await getReturnsByOrder(
            tenantId,
            order.id,
            token
          );
          existingReturns = returnsResponse.items || [];
        } catch (returnError) {
          console.warn("Could not fetch existing returns:", returnError);
          // Continue without existing returns data
        }

        // Calculate returned quantities per item
        const returnedQuantities: Record<string, number> = {};
        existingReturns.forEach((returnRecord: any) => {
          if (returnRecord.items) {
            returnRecord.items.forEach((returnItem: any) => {
              const itemId = returnItem.order_item_id;
              returnedQuantities[itemId] =
                (returnedQuantities[itemId] || 0) + returnItem.quantity;
            });
          }
        });

        // Transform order items to return items with correct remaining quantities
        const returnItems: ReturnItem[] = order.items
          .map((item, index) => {
            const alreadyReturned = returnedQuantities[item.id] || 0;
            const remainingQuantity = Math.max(
              0,
              item.quantity - alreadyReturned
            );

            return {
              id: item.id || `item-${index}`,
              name:
                item.product_name || item.variant_name || `Бараа ${index + 1}`,
              price: item.unit_price,
              quantity: remainingQuantity > 0 ? 1 : 0, // Default return quantity, but 0 if nothing left
              maxQuantity: remainingQuantity, // Max is the remaining returnable quantity
              order_item_id: item.id,
              variant_id: item.variant_id,
            };
          })
          .filter((item) => item.maxQuantity > 0); // Only show items that can still be returned

        setItems(returnItems);
        setOrderFound(true);

        const totalReturnableItems = returnItems.length;
        const hasReturnableItems = totalReturnableItems > 0;

        if (hasReturnableItems) {
          addToast(
            "success",
            "Амжилттай",
            `Баримт олдлоо. Буцаах боломжтой ${totalReturnableItems} бараа байна.`
          );
        } else {
          addToast(
            "warning",
            "Анхааруулга",
            "Баримт олдсон боловч буцаах боломжтой бараа байхгүй байна."
          );
        }
      } catch (error: any) {
        console.error("Search error:", error);
        let errorMessage = "Баримт хайхад алдаа гарлаа";

        if (error.message) {
          errorMessage = error.message;
        } else if (error.status === 404) {
          errorMessage =
            "Баримт олдсонгүй. Дугаарыг шалгаад дахин оролдоно уу.";
        } else if (error.status === 403) {
          errorMessage = "Энэ баримтад хандах эрх байхгүй байна.";
        } else if (error.status >= 500) {
          errorMessage = "Серверийн алдаа гарлаа. Дахин оролдоно уу.";
        }

        setError(errorMessage);
        addToast("error", "Алдаа", errorMessage);
        setItems([]);
        setOrderFound(false);
        setCurrentOrder(null);
      } finally {
        setLoading(false);
      }
    },
    [documentNumber]
  );

  const handleSubmitReturn = async () => {
    if (items.length === 0) {
      const message = "Буцаах бараа сонгоно уу";
      setError(message);
      addToast("warning", "Анхааруулга", message);
      return;
    }

    const itemsToReturn = items.filter((item) => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      const message = "Буцаах барааны тоо ширхэг оруулна уу";
      setError(message);
      addToast("warning", "Анхааруулга", message);
      return;
    }

    // Validate that no item exceeds its maximum returnable quantity
    const invalidItems = itemsToReturn.filter(
      (item) => item.quantity > item.maxQuantity
    );
    if (invalidItems.length > 0) {
      const invalidItemNames = invalidItems.map((item) => item.name).join(", ");
      const message = `Дараах барааны тоо ширхэг хэтэрсэн байна: ${invalidItemNames}`;
      setError(message);
      addToast("error", "Алдаа", message);
      return;
    }

    if (!selectedReason) {
      const message = "Буцаах шалтгаан сонгоно уу";
      setError(message);
      addToast("warning", "Анхааруулга", message);
      return;
    }

    if (!selectedPayment) {
      const message = "Төлбөрийн хэлбэр сонгоно уу";
      setError(message);
      addToast("warning", "Анхааруулга", message);
      return;
    }

    if (!currentOrder) {
      const message = "Захиалгын мэдээлэл олдсонгүй";
      setError(message);
      addToast("error", "Алдаа", message);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const tenantId = await getTenantId();

      if (!tenantId) {
        throw new Error("Tenant ID олдсонгүй");
      }

      // Calculate total refund amount
      const totalRefund = itemsToReturn.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      const returnData: CreateReturnRequest = {
        tenant_id: tenantId,
        order_id: currentOrder.id,
        items: itemsToReturn.map((item) => ({
          order_item_id: item.order_item_id!,
          variant_id: item.variant_id!,
          quantity: item.quantity,
          unit_refund: item.price,
        })),
        refunds: [
          {
            method: mapPaymentMethod(selectedPayment),
            amount: totalRefund,
          },
        ],
        note: mapReturnReason(selectedReason, customReason),
      };

      const result = await createReturn(returnData, token);

      // Success - reset form and show success message
      setDocumentNumber("");
      setItems([]);
      setOrderFound(false);
      setCurrentOrder(null);
      setSelectedReason("size");
      setCustomReason("");
      setSelectedPayment("original");
      setError(null);

      addToast(
        "success",
        "Амжилттай",
        `Буцаалт амжилттай! Дугаар: ${result.return.id}`
      );
    } catch (error: any) {
      console.error("Return submission error:", error);
      let errorMessage = "Буцаалт үүсгэхэд алдаа гарлаа";

      if (error.message) {
        // Check for specific quantity validation errors
        if (error.message.includes("qty exceeds remaining to return")) {
          errorMessage =
            "Буцаах тоо ширхэг хэтэрсэн байна. Хуудсыг дахин ачааллаад дахин оролдоно уу.";
          // Refresh the order data to get updated returnable quantities
          if (documentNumber) {
            setTimeout(() => {
              handleSearch(documentNumber);
            }, 1000);
          }
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      addToast("error", "Алдаа", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get order_id from URL params if available

  const updateQuantity = (id: string, newQuantity: number) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(0, Math.min(newQuantity, item.maxQuantity)),
            }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const vatReduction = Math.round(subtotal * 0.1);
  const totalReturn = subtotal - vatReduction;

  const handlePrint = () => {
    addToast("info", "Мэдээлэл", "Хэвлэх функц удахгүй нэмэгдэнэ");
  };

  const handleConfirm = () => {
    handleSubmitReturn();
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => router.back()}
          className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-6 text-black inline-flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          ← Буцах
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Return Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Search */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              🧾 Баримт хайх
            </h2>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="№: 1234 эсвэл POS-2025-08-12-1234"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleSearch();
                  }
                }}
              />
              {/* <button
                onClick={handleScan}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-md"
                disabled={loading}
              >
                📷 Скан
              </button> */}
              <button
                onClick={() => handleSearch()}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow-md"
                disabled={loading || !documentNumber.trim()}
              >
                {loading ? "🔄 Хайж байна..." : "🔍 Хайх"}
              </button>
            </div>

            {/* Order Information */}
            {currentOrder && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">
                  📋 Захиалгын мэдээлэл
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Дугаар:</span>
                    <span className="ml-2 font-medium">{currentOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Огноо:</span>
                    <span className="ml-2 font-medium">
                      {new Date(currentOrder.created_at).toLocaleDateString(
                        "mn-MN"
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Нийт дүн:</span>
                    <span className="ml-2 font-medium">
                      ₮{currentOrder.total.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Төлөв:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {currentOrder.status === "completed"
                        ? "Дууссан"
                        : currentOrder.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Return Reason */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              📋 Буцаах шалтгаан
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {reasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id as ReturnReason)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                    selectedReason === reason.id
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <div className="text-lg mb-1">{reason.icon}</div>
                  {reason.label}
                </button>
              ))}
            </div>
            {selectedReason === "other" && (
              <textarea
                placeholder="Тайлбар бичнэ үү..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            )}
          </div>

          {/* Product List */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              🛍️ Буцаах барааны жагсаалт
            </h2>
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800">
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              ₮{item.price.toLocaleString()} / ш
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                            disabled={item.quantity <= 0}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(
                                item.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center border border-gray-300 rounded-lg py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max={item.maxQuantity}
                          />
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                            disabled={item.quantity >= item.maxQuantity}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">
                            ₮{(item.price * item.quantity).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Буцаах боломжтой: {item.maxQuantity}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1 transition-colors"
                          title="Устгах"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📦</div>
                <p className="text-lg font-medium mb-2">
                  Барааны жагсаалт хоосон
                </p>
                <p className="text-sm">
                  {orderFound
                    ? "Энэ захиалгад буцаах боломжтой бараа байхгүй байна"
                    : "Эхлээд баримтын дугаар хайж олоорой"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Totals */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              💰 Дүнгийн хураангуй
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Нэгж дүн:</span>
                <span className="font-medium">
                  ₮{subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">НӨАТ бууруулт:</span>
                <span className="font-medium text-green-600">
                  -₮{vatReduction.toLocaleString()}
                </span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between text-xl font-bold">
                <span className="text-gray-800">Буцаах дүн:</span>
                <span className="text-blue-600">
                  ₮{totalReturn.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              💳 Төлбөрийн арга
            </h2>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id as PaymentMethod)}
                  className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                    selectedPayment === method.id
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">{method.icon}</span>
                    {method.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              ⚡ Үйлдэл
            </h2>
            <div className="space-y-3">
              {/* <button
                onClick={handlePrint}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                🖨️ Хэвлэх (буцаалтын баримт)
              </button> */}
              <button
                onClick={handleConfirm}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={
                  items.length === 0 ||
                  totalReturn <= 0 ||
                  loading ||
                  items.every((item) => item.quantity === 0)
                }
              >
                {loading
                  ? "🔄 Төлөв хэвлэж байна..."
                  : "✅ Буцаалтыг баталгаажуулах"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-xl shadow-lg border p-4 transform transition-all duration-300 animate-in slide-in-from-right ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : toast.type === "warning"
                ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {toast.type === "success" && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "error" && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "warning" && (
                  <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  </div>
                )}
                {toast.type === "info" && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{toast.title}</p>
                <p className="text-sm opacity-90">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
