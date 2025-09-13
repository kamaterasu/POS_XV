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
import { generateReturnReceipt } from "@/lib/return/receiptApi";

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
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("cash");
  const [customReason, setCustomReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [orderFound, setOrderFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastReturnId, setLastReturnId] = useState<string | null>(null);

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

      // Refresh return data before submission to prevent stale data issues
      try {
        const freshReturnsResponse = await getReturnsByOrder(
          tenantId,
          currentOrder.id,
          token
        );
        const freshExistingReturns = freshReturnsResponse.items || [];

        // Recalculate returned quantities with fresh data
        const freshReturnedQuantities: Record<string, number> = {};
        freshExistingReturns.forEach((returnRecord: any) => {
          if (returnRecord.items) {
            returnRecord.items.forEach((returnItem: any) => {
              const itemId = returnItem.order_item_id;
              freshReturnedQuantities[itemId] =
                (freshReturnedQuantities[itemId] || 0) + returnItem.quantity;
            });
          }
        });

        // Validate against fresh data
        const freshInvalidItems = itemsToReturn.filter((item) => {
          const alreadyReturned =
            freshReturnedQuantities[item.order_item_id!] || 0;
          const originalItem = currentOrder.items.find(
            (oi) => oi.id === item.order_item_id
          );
          const maxReturnable = Math.max(
            0,
            (originalItem?.quantity || 0) - alreadyReturned
          );
          return item.quantity > maxReturnable;
        });

        if (freshInvalidItems.length > 0) {
          const invalidNames = freshInvalidItems
            .map((item) => item.name)
            .join(", ");
          throw new Error(
            `Дараах барааны тоо ширхэг хэтэрсэн байна (шинээр шалгасан): ${invalidNames}. Хуудсыг дахин ачааллана уу.`
          );
        }
      } catch (refreshError) {
        console.warn("Could not refresh return data:", refreshError);
        // Continue with original validation if refresh fails
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

      console.log("🚀 About to create return with data:", returnData);
      console.log("🔐 Token available:", !!token);
      console.log("🏢 Tenant ID:", tenantId);
      console.log("📋 Order ID:", currentOrder.id);

      const result = await createReturn(returnData, token);

      // Store the return ID for receipt generation
      setLastReturnId(result.return.id);

      // Success - reset form and show success message
      setDocumentNumber("");
      setItems([]);
      setOrderFound(false);
      setCurrentOrder(null);
      setSelectedReason("size");
      setCustomReason("");
      setError(null);

      addToast(
        "success",
        "Амжилттай",
        `Буцаалт амжилттай! Дугаар: ${result.return.id}`
      );
    } catch (error: any) {
      console.error("❌ Return submission error:", error);
      console.error("❌ Error stack:", error.stack);

      let errorMessage = "Буцаалт үүсгэхэд алдаа гарлаа";

      if (error.message) {
        console.log("🔍 Error message:", error.message);

        // Check for specific error types
        if (error.message.includes("qty exceeds remaining to return")) {
          errorMessage =
            "Буцаах тоо ширхэг хэтэрсэн байна. Хуудсыг дахин ачааллаад дахин оролдоно уу.";
          // Refresh the order data to get updated returnable quantities
          if (documentNumber) {
            setTimeout(() => {
              handleSearch(documentNumber);
            }, 1000);
          }
        } else if (error.message.includes("Network request failed")) {
          errorMessage =
            "Сүлжээний холболтод алдаа гарлаа. Интернэт холболтоо шалгана уу.";
        } else if (error.message.includes("unauthenticated")) {
          errorMessage = "Нэвтрэх эрх дуусчээ. Дахин нэвтэрнэ үү.";
        } else if (error.message.includes("forbidden")) {
          errorMessage = "Энэ үйлдлийг хийх эрх танд байхгүй.";
        } else if (error.message.includes("fn_return")) {
          errorMessage =
            "Серверийн функц олдсонгүй. Системийн админтай холбогдоно уу.";
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

  const handlePrint = async () => {
    if (!lastReturnId) {
      addToast("warning", "Анхааруулга", "Эхлээд буцаалт үүсгэнэ үү");
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      const tenantId = await getTenantId();

      if (!tenantId) {
        throw new Error("Tenant ID олдсонгүй");
      }

      // Generate and download receipt PDF
      const pdfBlob = await generateReturnReceipt(
        tenantId,
        lastReturnId,
        token,
        "pdf",
        true
      );

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `return-receipt-${lastReturnId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addToast("success", "Амжилттай", "Буцаалтын баримт татагдлаа");
    } catch (error: any) {
      console.error("Print error:", error);

      let errorMessage = "Хэвлэхэд алдаа гарлаа";
      if (error.message?.includes("WinAnsi cannot encode")) {
        errorMessage = "Валютын тэмдэгтийн асуудалтай. USD-ээр хэвлэж байна...";
      } else if (error.message) {
        errorMessage = error.message;
      }

      addToast("error", "Алдаа", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    handleSubmitReturn();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="group bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-lg shadow-slate-900/5 h-12 px-6 text-slate-700 inline-flex items-center justify-center hover:bg-white hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <svg
                className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Буцах
            </button>
            <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
            <div className="hidden lg:block">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                📦 Бараа буцаах
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Худалдан авсан барааг буцаах систем
              </p>
            </div>
          </div>
          <div className="hidden lg:flex items-center space-x-3">
            <div className="bg-white/60 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-200/60">
              <div className="text-xs text-slate-500 uppercase tracking-wide">
                Өнөөдөр
              </div>
              <div className="text-sm font-semibold text-slate-700">
                {new Date().toLocaleDateString("mn-MN")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Return Form */}
        <div className="lg:col-span-8 space-y-8">
          {/* Document Search */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Баримт хайх
                </h2>
                <p className="text-sm text-slate-600">
                  Буцаах барааны баримтын дугаарыг оруулна уу
                </p>
              </div>
            </div>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="№: 1234 эсвэл POS-2025-08-12-1234"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) {
                      handleSearch();
                    }
                  }}
                />
              </div>
              <button
                onClick={() => handleSearch()}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
                disabled={loading || !documentNumber.trim()}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Хайж байна...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span>Хайх</span>
                  </>
                )}
              </button>
            </div>

            {/* Order Information */}
            {currentOrder && (
              <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/60 shadow-inner">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">
                      Захиалгын мэдээлэл
                    </h3>
                    <p className="text-sm text-blue-700">
                      Амжилттай олдсон захиалгын дэлгэрэнгүй
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">
                        Дугаар:
                      </span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                        {currentOrder.id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Огноо:</span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                        {new Date(currentOrder.created_at).toLocaleDateString(
                          "mn-MN"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">
                        Нийт дүн:
                      </span>
                      <span className="font-bold text-emerald-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                        ₮{currentOrder.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Төлөв:</span>
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-800 shadow-sm">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                        {currentOrder.status === "completed"
                          ? "Дууссан"
                          : currentOrder.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 p-6 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200/60 shadow-inner">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">
                      Алдаа гарлаа
                    </h4>
                    <p className="text-red-700 text-sm leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Return Reason */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Буцаах шалтгаан
                </h2>
                <p className="text-sm text-slate-600">
                  Та яагаад бараагаа буцааж байгаагаа сонгоно уу
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {reasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => setSelectedReason(reason.id as ReturnReason)}
                  className={`group relative p-6 rounded-xl border-2 transition-all duration-300 text-center ${
                    selectedReason === reason.id
                      ? "border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg shadow-purple-500/25 scale-105"
                      : "border-slate-200 bg-white/50 hover:border-purple-300 hover:bg-purple-50/50 hover:scale-102"
                  }`}
                >
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">
                    {reason.icon}
                  </div>
                  <p
                    className={`font-semibold text-sm ${
                      selectedReason === reason.id
                        ? "text-purple-700"
                        : "text-slate-700"
                    }`}
                  >
                    {reason.label}
                  </p>
                  {selectedReason === reason.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedReason === "other" && (
              <div className="relative">
                <textarea
                  placeholder="Тайлбар бичнэ үү..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-4 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-all duration-300"
                  rows={4}
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                  {customReason.length}/500
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-3m0 0a2 2 0 00-2-2H9a2 2 0 00-2 2v3a2 2 0 002 2h10a2 2 0 002-2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Буцааж олгох арга
                </h2>
                <p className="text-sm text-slate-600">
                  Мөнгө буцааж олгох аргыг сонгоно уу
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: "cash", label: "Бэлэн мөнгө", icon: "💵" },
                { id: "card", label: "Картаар", icon: "💳" },
                { id: "original", label: "Анхны аргаар", icon: "🔄" },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id as PaymentMethod)}
                  className={`group relative p-4 rounded-xl border-2 transition-all duration-300 text-center ${
                    selectedPayment === method.id
                      ? "border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-lg shadow-green-500/25 scale-105"
                      : "border-slate-200 bg-white/50 hover:border-green-300 hover:bg-green-50/50 hover:scale-102"
                  }`}
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">
                    {method.icon}
                  </div>
                  <p
                    className={`font-semibold text-sm ${
                      selectedPayment === method.id
                        ? "text-green-700"
                        : "text-slate-700"
                    }`}
                  >
                    {method.label}
                  </p>
                  {selectedPayment === method.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Product List */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Буцаах барааны жагсаалт
                  </h2>
                  <p className="text-sm text-slate-600">
                    {items.length > 0
                      ? `${items.length} бараа олдлоо`
                      : "Баримт хайснаар бараанууд харагдана"}
                  </p>
                </div>
              </div>
              {items.length > 0 && (
                <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
                  <p className="text-sm font-semibold text-emerald-700">
                    {items.filter((item) => item.quantity > 0).length} /{" "}
                    {items.length} сонгогдсон
                  </p>
                </div>
              )}
            </div>

            {items.length > 0 ? (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="group bg-gradient-to-r from-white to-slate-50/50 border border-slate-200/60 rounded-xl p-6 hover:shadow-lg hover:shadow-slate-900/10 transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center group-hover:from-blue-50 group-hover:to-blue-100 transition-all duration-300">
                            <span className="text-slate-600 font-bold text-sm group-hover:text-blue-600">
                              #{index + 1}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">
                            {item.name}
                          </h3>
                          <p className="text-slate-600 font-medium">
                            ₮{item.price.toLocaleString()} / ширхэг
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Буцаах боломжтой:{" "}
                            <span className="font-semibold text-emerald-600">
                              {item.maxQuantity} ширхэг
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        {/* Quantity Controls */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            disabled={item.quantity <= 0}
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
                                d="M20 12H4"
                              />
                            </svg>
                          </button>
                          <div className="relative">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  item.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-20 text-center bg-white border-2 border-slate-200 rounded-xl py-2 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                              min="0"
                              max={item.maxQuantity}
                            />
                          </div>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            disabled={item.quantity >= item.maxQuantity}
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
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </button>
                        </div>

                        {/* Total Price */}
                        <div className="text-right min-w-[120px]">
                          <p className="text-2xl font-bold text-slate-900">
                            ₮{(item.price * item.quantity).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500">нийт дүн</p>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-10 h-10 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 hover:text-red-600 transition-all duration-300 hover:scale-110 group/delete"
                          title="Устгах"
                        >
                          <svg
                            className="w-4 h-4 group-hover/delete:scale-110 transition-transform duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-12 h-12 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Барааны жагсаалт хоосон
                </h3>
                <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                  {orderFound
                    ? "Энэ захиалгад буцаах боломжтой бараа байхгүй байна. Бүх бараа аль хэдийн буцаагдсан байж магадгүй."
                    : "Эхлээд дээр байрлах хайлтын талбараас баримтын дугаараа оруулж хайна уу."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* Totals */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8 sticky top-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Дүнгийн хураангуй
                </h2>
                <p className="text-sm text-slate-600">Буцаах дүнгийн тооцоо</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="text-slate-600 font-medium">Нэгж дүн:</span>
                </div>
                <span className="font-bold text-lg text-slate-900">
                  ₮{subtotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-slate-600 font-medium">
                    НӨАТ бууруулт:
                  </span>
                </div>
                <span className="font-bold text-lg text-emerald-600">
                  -₮{vatReduction.toLocaleString()}
                </span>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200/60">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-800 font-bold text-lg">
                      Буцаах дүн:
                    </span>
                  </div>
                  <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    ₮{totalReturn.toLocaleString()}
                  </span>
                </div>
              </div>

              {items.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="font-bold text-slate-900 text-lg">
                        {items.length}
                      </div>
                      <div className="text-slate-600">Нийт бараа</div>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 rounded-lg">
                      <div className="font-bold text-emerald-600 text-lg">
                        {items.filter((item) => item.quantity > 0).length}
                      </div>
                      <div className="text-slate-600">Буцаах бараа</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200/60 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Үйлдэл</h2>
                <p className="text-sm text-slate-600">
                  Буцаалтыг баталгаажуулах
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleConfirm}
                className={`w-full group relative overflow-hidden px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform ${
                  items.length === 0 ||
                  totalReturn <= 0 ||
                  loading ||
                  items.every((item) => item.quantity === 0)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105"
                }`}
                disabled={
                  items.length === 0 ||
                  totalReturn <= 0 ||
                  loading ||
                  items.every((item) => item.quantity === 0)
                }
              >
                <div className="relative z-10 flex items-center justify-center space-x-3">
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Төлөв хэвлэж байна...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Буцаалтыг баталгаажуулах</span>
                    </>
                  )}
                </div>
                {!loading &&
                  items.length > 0 &&
                  totalReturn > 0 &&
                  !items.every((item) => item.quantity === 0) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
              </button>

              {/* Print Receipt Button */}
              {lastReturnId && (
                <button
                  onClick={handlePrint}
                  className="w-full group relative overflow-hidden px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105"
                >
                  <div className="relative z-10 flex items-center justify-center space-x-3">
                    <svg
                      className="w-5 h-5 group-hover:scale-110 transition-transform duration-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    <span>Буцаалтын баримт хэвлэх</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              )}

              {/* Help Text */}
              <div className="text-center">
                <p className="text-xs text-slate-500 leading-relaxed">
                  {items.length === 0
                    ? "Эхлээд баримт хайж, буцаах бараа сонгоно уу"
                    : items.every((item) => item.quantity === 0)
                    ? "Буцаах барааны тоо ширхэг оруулна уу"
                    : totalReturn <= 0
                    ? "Буцаах дүн 0-ээс их байх ёстой"
                    : "Бүх мэдээлэл зөв эсэхийг шалгаад дарна уу"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 space-y-3 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`group relative overflow-hidden rounded-2xl shadow-2xl border backdrop-blur-sm transform transition-all duration-500 animate-in slide-in-from-right-5 ${
              toast.type === "success"
                ? "bg-emerald-50/90 border-emerald-200/60 shadow-emerald-500/20"
                : toast.type === "error"
                ? "bg-red-50/90 border-red-200/60 shadow-red-500/20"
                : toast.type === "warning"
                ? "bg-amber-50/90 border-amber-200/60 shadow-amber-500/20"
                : "bg-blue-50/90 border-blue-200/60 shadow-blue-500/20"
            }`}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white to-transparent"></div>
            </div>

            <div className="relative p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {toast.type === "success" && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "error" && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "warning" && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                        ></path>
                      </svg>
                    </div>
                  )}
                  {toast.type === "info" && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-bold text-lg mb-1 ${
                      toast.type === "success"
                        ? "text-emerald-900"
                        : toast.type === "error"
                        ? "text-red-900"
                        : toast.type === "warning"
                        ? "text-amber-900"
                        : "text-blue-900"
                    }`}
                  >
                    {toast.title}
                  </h4>
                  <p
                    className={`text-sm leading-relaxed ${
                      toast.type === "success"
                        ? "text-emerald-800"
                        : toast.type === "error"
                        ? "text-red-800"
                        : toast.type === "warning"
                        ? "text-amber-800"
                        : "text-blue-800"
                    }`}
                  >
                    {toast.message}
                  </p>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-110 group-hover:bg-white/50 ${
                    toast.type === "success"
                      ? "text-emerald-600 hover:text-emerald-700"
                      : toast.type === "error"
                      ? "text-red-600 hover:text-red-700"
                      : toast.type === "warning"
                      ? "text-amber-600 hover:text-amber-700"
                      : "text-blue-600 hover:text-blue-700"
                  }`}
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

              {/* Progress Bar */}
              <div
                className={`absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-5000 ease-linear ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : toast.type === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
                style={{
                  width: "100%",
                  animation: "shrink 5s linear forwards",
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Toast Animation Styles */}
      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
