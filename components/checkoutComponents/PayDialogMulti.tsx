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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white text-black w-full max-w-md rounded-xl shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">
            {disabled
              ? "Захиалга боловсруулж байна..."
              : "Төлбөр төлөх (олон төрөл)"}
          </h2>
          <button
            onClick={onClose}
            disabled={disabled}
            className={`text-black/60 hover:text-black text-sm ${
              disabled ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[120px_1fr_32px] gap-2 items-center"
            >
              <select
                className="h-9 border rounded px-2 bg-white"
                value={r.method}
                disabled={disabled}
                onChange={(e) =>
                  setRow(i, { method: e.target.value as PaymentRow["method"] })
                }
              >
                <option value="cash">Бэлэн</option>
                <option value="card">Карт</option>
                <option value="qpay">QPay</option>
                <option value="wallet">Wallet</option>
                <option value="other">Бусад</option>
              </select>

              <input
                ref={i === 0 ? firstAmountRef : null}
                type="number"
                inputMode="numeric"
                className="h-9 border rounded px-3 bg-white"
                value={r.amount ?? 0}
                disabled={disabled}
                onChange={(e) =>
                  setRow(i, { amount: Number(e.target.value || 0) })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />

              <button
                className="h-9 border rounded bg-[#F4F4F4] hover:bg-[#ececec]"
                onClick={() => removeRow(i)}
                disabled={disabled}
                title="Remove"
              >
                –
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3 border rounded bg-[#F4F4F4] hover:bg-[#ececec]"
              onClick={() => addRow("card")}
              disabled={disabled}
            >
              + Карт
            </button>
            <button
              className="h-9 px-3 border rounded bg-[#F4F4F4] hover:bg-[#ececec]"
              onClick={() => addRow("qpay")}
              disabled={disabled}
            >
              + QPay
            </button>
            <button
              className="h-9 px-3 border rounded bg-[#F4F4F4] hover:bg-[#ececec]"
              onClick={() => addRow("cash")}
              disabled={disabled}
            >
              + Бэлэн
            </button>

            <button
              className="ml-auto h-9 px-3 border rounded bg-[#F2F7FF] border-[#CFE3FF] hover:bg-[#e8f1ff]"
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
              Үлдэгдэл {fmt(remaining)}
            </button>
          </div>
        </div>

        <div className="mt-3 border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Нийт төлөх</span>
            <strong>{fmt(total)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Авагдсан</span>
            <span>{fmt(totalReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span>Зөрүү</span>
            <span className={remaining > 0 ? "text-red-600" : ""}>
              {fmt(remaining)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Хариулт</span>
            <span>{fmt(change)}</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2 justify-end">
          <button
            className="h-9 px-4 border rounded bg-white hover:bg-[#fafafa]"
            onClick={onClose}
            disabled={disabled}
          >
            Болих
          </button>
          <button
            className={`h-9 px-4 rounded text-white ${
              canConfirm
                ? "bg-[#5AA6FF] hover:opacity-90"
                : "bg-[#b6d5ff] cursor-not-allowed"
            }`}
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {disabled ? "Хүлээнэ үү..." : "Батлах"}
          </button>
        </div>
      </div>
    </div>
  );
}
