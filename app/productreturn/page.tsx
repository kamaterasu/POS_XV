"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getTenantId } from "@/lib/helper/getTenantId";
import {
  createReturn,
  getReturnsByOrder,
  getTenantIdFromToken,
  mapPaymentMethod,
  mapReturnReason,
  type CreateReturnRequest,
  type ReturnItem as APIReturnItem,
  type Refund,
} from "@/lib/return/returnApi";

type ReturnReason = "size" | "damaged" | "wrong" | "unsatisfied" | "other";
type PaymentMethod = "original" | "cash" | "card";

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
    { id: "original", label: "Анхны төлбөрөөр", icon: "🔄" },
    { id: "cash", label: "Бэлнээр", icon: "💵" },
    { id: "card", label: "Картаар", icon: "💳" },
  ];

  const handleSearch = async (orderNumber?: string) => {
    const searchNumber = orderNumber || documentNumber;
    if (!searchNumber.trim()) {
      setError("Баримтын дугаар оруулна уу");
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

      // TODO: Replace with actual order API call to get order items
      // For now, using mock data
      const mockItems: ReturnItem[] = [
        {
          id: "1",
          name: "Бараа 1",
          price: 1000,
          quantity: 1,
          maxQuantity: 2,
          order_item_id: "order_item_1",
          variant_id: "variant_1",
        },
        {
          id: "2",
          name: "Бараа 2",
          price: 5500,
          quantity: 1,
          maxQuantity: 1,
          order_item_id: "order_item_2",
          variant_id: "variant_2",
        },
      ];

      setItems(mockItems);
      setOrderFound(true);
    } catch (error: any) {
      console.error("Search error:", error);
      setError(error.message || "Баримт хайхад алдаа гарлаа");
      setItems([]);
      setOrderFound(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReturn = async () => {
    if (items.length === 0) {
      setError("Буцаах бараа сонгоно уу");
      return;
    }

    if (!selectedReason) {
      setError("Буцаах шалтгаан сонгоно уу");
      return;
    }

    if (!selectedPayment) {
      setError("Төлбөрийн хэлбэр сонгоно уу");
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

      const returnData = {
        tenant_id: tenantId,
        order_id: documentNumber, // Using document number as order ID
        items: items.map((item) => ({
          order_item_id: item.order_item_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_refund: item.price,
        })),
        refunds: [
          {
            method: selectedPayment.toUpperCase() as
              | "CASH"
              | "CARD"
              | "ORIGINAL",
            amount: subtotal,
          },
        ],
        reason: selectedReason,
        note: customReason.trim() || undefined,
      };

      const result = await createReturn(returnData, token);

      // Success - reset form and show success message
      setDocumentNumber("");
      setItems([]);
      setOrderFound(false);
      setSelectedReason("size");
      setCustomReason("");
      setSelectedPayment("original");

      alert(`Буцаалт амжилттай! Дугаар: ${result.return.id}`);
    } catch (error: any) {
      console.error("Return submission error:", error);
      setError(error.message || "Буцаалт үүсгэхэд алдаа гарлаа");
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

  const handleScan = () => {
    // TODO: Implement barcode scanning
    alert("Скан функц удахгүй нэмэгдэнэ");
  };

  const handlePrint = () => {
    // TODO: Implement printing
    alert("Хэвлэх функц удахгүй нэмэгдэнэ");
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
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="№: POS-2025-08-12-1234"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleScan}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium shadow-md"
              >
                📷 Скан
              </button>
            </div>
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
                          Макс: {item.maxQuantity}
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
              <button
                onClick={handlePrint}
                className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                🖨️ Хэвлэх (буцаалтын баримт)
              </button>
              <button
                onClick={handleConfirm}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg transform hover:scale-105"
                disabled={items.length === 0 || totalReturn <= 0}
              >
                ✅ Буцаалтыг баталгаажуулах
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
