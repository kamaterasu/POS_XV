"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentRow } from "@/lib/sales/salesTypes";
import { fmt } from "@/lib/sales/salesUtils";

export default function PayDialogMulti({
  open,
  onClose,
  total,
  onPaidMulti,
  disabled = false,
}: {
  open: boolean;
  onClose: () => void;
  total: number; // tugriks
  onPaidMulti: (
    rows: PaymentRow[],
    totalReceived: number,
    change: number
  ) => void;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<PaymentRow[]>([
    { method: "cash", amount: 0 },
  ]);
  const firstAmountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      // reset per open, or keep last? choose reset for safety
      setRows([{ method: "cash", amount: total }]);
      setTimeout(() => firstAmountRef.current?.focus(), 10);
    }
  }, [open, total]);

  const totalReceived = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows]
  );
  const change = Math.max(0, totalReceived - total);
  const remaining = Math.max(0, total - totalReceived);
  const canConfirm =
    !disabled &&
    totalReceived >= total &&
    rows.length > 0 &&
    rows.every((r) => (r.amount ?? 0) >= 0);

  function setRow(i: number, patch: Partial<PaymentRow>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }
  function addRow(method: PaymentRow["method"] = "card", amount = remaining) {
    setRows((prev) => [...prev, { method, amount }]);
  }
  function removeRow(i: number) {
    setRows((prev) =>
      prev.length === 1
        ? [{ method: "cash", amount: total }]
        : prev.filter((_, idx) => idx !== i)
    );
  }

  function handleConfirm() {
    if (!canConfirm) return;
    // normalize numbers
    const norm = rows.map((r) => ({
      ...r,
      amount: Math.round(Number(r.amount) || 0),
    }));
    onPaidMulti(norm, totalReceived, change);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-blue-900/50 to-indigo-900/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative bg-white/98 backdrop-blur-xl text-black w-full max-w-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden animate-in slide-in-from-bottom duration-400">
        {/* Enhanced Header */}
        <div className="relative px-8 py-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                {disabled ? (
                  <div className="w-6 h-6 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                ) : (
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
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  {disabled ? "Төлбөр боловсруулж байна..." : "Төлбөр тооцох"}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {disabled
                    ? "Та түр хүлээнэ үү"
                    : "Олон төлбөрийн хэрэгсэл ашиглах боломжтой"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={disabled}
              className={`group w-10 h-10 rounded-xl bg-white/80 hover:bg-white border border-gray-200/50 hover:border-gray-300 flex items-center justify-center transition-all duration-200 hover:shadow-md ${
                disabled ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              <svg
                className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors"
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

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
        </div>

        {/* Enhanced Payment Rows */}
        <div className="px-8 py-6 bg-gradient-to-b from-white/50 to-gray-50/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Төлбөрийн хэрэгслүүд</h3>
              <p className="text-sm text-gray-500">
                Төлбөрийн аргуудыг нэмж, дүнгээ оруулна уу
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {rows.map((r, i) => (
              <div
                key={i}
                className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="grid grid-cols-[140px_1fr_40px] gap-4 items-center">
                  {/* Payment Method Selector */}
                  <div className="relative">
                    <select
                      className="w-full h-12 border-2 border-gray-200 rounded-xl px-4 bg-white/90 text-gray-800 font-medium focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200 appearance-none cursor-pointer"
                      value={r.method}
                      disabled={disabled}
                      onChange={(e) =>
                        setRow(i, {
                          method: e.target.value as PaymentRow["method"],
                        })
                      }
                    >
                      <option value="cash">💵 Бэлэн</option>
                      <option value="card">💳 Карт</option>
                      <option value="qpay">📱 QPay</option>
                      <option value="wallet">👝 Wallet</option>
                      <option value="other">➕ Бусад</option>
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="relative">
                    <input
                      ref={i === 0 ? firstAmountRef : null}
                      type="number"
                      inputMode="numeric"
                      className="w-full h-12 border-2 border-gray-200 rounded-xl px-4 pr-8 bg-white/90 text-gray-800 font-semibold focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                      value={r.amount ?? 0}
                      disabled={disabled}
                      placeholder="0"
                      onChange={(e) =>
                        setRow(i, { amount: Number(e.target.value || 0) })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleConfirm();
                      }}
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">
                      ₮
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    className="w-10 h-10 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 hover:from-red-100 hover:to-pink-100 hover:border-red-300 text-red-600 hover:text-red-700 flex items-center justify-center transition-all duration-200 hover:shadow-md disabled:opacity-50 group"
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    title="Устгах"
                  >
                    <svg
                      className="w-4 h-4 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Add Payment Method Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <div className="flex items-center gap-2">
                <button
                  className="group flex items-center gap-2 h-11 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:shadow-md text-blue-700 font-medium"
                  onClick={() => addRow("card")}
                  disabled={disabled}
                >
                  <svg
                    className="w-4 h-4 group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  💳 Карт
                </button>

                <button
                  className="group flex items-center gap-2 h-11 px-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 hover:border-purple-300 rounded-xl transition-all duration-200 hover:shadow-md text-purple-700 font-medium"
                  onClick={() => addRow("qpay")}
                  disabled={disabled}
                >
                  <svg
                    className="w-4 h-4 group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  📱 QPay
                </button>

                <button
                  className="group flex items-center gap-2 h-11 px-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 hover:border-green-300 rounded-xl transition-all duration-200 hover:shadow-md text-green-700 font-medium"
                  onClick={() => addRow("cash")}
                  disabled={disabled}
                >
                  <svg
                    className="w-4 h-4 group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  💵 Бэлэн
                </button>
              </div>

              <button
                className="group ml-auto flex items-center gap-2 h-11 px-6 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border-2 border-orange-200 hover:border-orange-300 rounded-xl transition-all duration-200 hover:shadow-lg text-orange-700 font-bold disabled:opacity-50"
                onClick={() => {
                  // one-click fill remaining into last row
                  setRows((prev) => {
                    if (prev.length === 0)
                      return [{ method: "cash", amount: total }];
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      amount: (copy[copy.length - 1].amount || 0) + remaining,
                    };
                    return copy;
                  });
                }}
                disabled={remaining === 0 || disabled}
              >
                <svg
                  className="w-4 h-4 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Үлдэгдэл {fmt(remaining)}
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Summary Section */}
        <div className="px-8 py-6 bg-gradient-to-r from-gray-50 via-blue-50/30 to-indigo-50/30 border-t border-gray-200/50">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-bold text-gray-800">Төлбөрийн дүн</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 font-medium">
                  Нийт төлөх дүн
                </span>
                <span className="text-xl font-bold text-gray-900">
                  {fmt(total)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Авагдсан дүн</span>
                <span
                  className={`text-lg font-bold ${
                    totalReceived >= total ? "text-green-600" : "text-blue-600"
                  }`}
                >
                  {fmt(totalReceived)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Дутуу дүн</span>
                <span
                  className={`text-lg font-bold ${
                    remaining > 0 ? "text-red-600" : "text-gray-400"
                  }`}
                >
                  {fmt(remaining)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-t-2 border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl px-4 -mx-2">
                <span className="text-green-800 font-bold">Хариулт өгөх</span>
                <span className="text-xl font-bold text-green-600">
                  {fmt(change)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="px-8 py-6 bg-gradient-to-r from-white/60 to-gray-50/60 border-t border-gray-200/50">
          <div className="flex gap-4">
            <button
              className="flex-1 h-14 px-6 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50"
              onClick={onClose}
              disabled={disabled}
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Болих
            </button>

            <button
              className={`flex-1 h-14 px-6 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl ${
                canConfirm
                  ? "bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 active:scale-95 border-2 border-blue-400"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-gray-200"
              }`}
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {disabled ? (
                <>
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  Хүлээнэ үү...
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
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Төлбөр батлах
                </>
              )}
            </button>
          </div>

          {/* Status indicator */}
          {remaining > 0 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span className="text-red-800 font-medium text-sm">
                  Төлбөр дутуу байна. {fmt(remaining)} нэмж оруулна уу.
                </span>
              </div>
            </div>
          )}

          {change > 0 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-green-800 font-medium text-sm">
                  Хариулт: {fmt(change)} өгнө үү.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
