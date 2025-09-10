"use client";
import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/sales/salesTypes";
import {
  saveDraftToBackend,
  transformItemsToDraft,
  type DraftData,
} from "@/lib/draft/draftApi";
import { getStoredID } from "@/lib/store/storeApi";
import { getAccessToken } from "@/lib/helper/getAccessToken";

export default function SaveDraftDialog({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const { totalQty, totalAmount } = useMemo(() => {
    const qty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
    const amt = items.reduce((s, it) => s + it.qty * it.price, 0);
    return { totalQty: qty, totalAmount: amt };
  }, [items]);

  const disabled = items.length === 0 || !name.trim() || saving;

  // Esc дархад хаах
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Dialog нээгдэх бүрт талбар цэвэрлэе
  useEffect(() => {
    if (open) {
      setName("");
      setNote("");
      setSaveSuccess(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (disabled) return;

    setSaving(true);
    try {
      // Prepare draft data for local storage (fallback)
      const localDraft = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        name: name.trim(),
        notes: note.trim() || undefined,
        items,
        totalQty,
        totalAmount,
        createdAt: new Date().toISOString(),
      };

      // Try backend first, fallback to localStorage
      let savedToBackend = false;
      try {
        // Get store ID and access token
        const token = await getAccessToken();
        const storeId = await getStoredID(token);

        if (token && storeId) {
          // Prepare draft data for backend
          const draftData: DraftData = {
            name: name.trim(),
            notes: note.trim() || undefined,
            items: transformItemsToDraft(items),
            total_amount: totalAmount,
            total_quantity: totalQty,
            store_id: storeId,
          };

          // Try to save to backend
          await saveDraftToBackend(draftData);
          savedToBackend = true;
          setSaveSuccess("backend");
          console.log("✅ Draft saved to backend successfully");
        }
      } catch (backendError) {
        console.warn(
          "⚠️ Backend save failed, using localStorage fallback:",
          backendError
        );
        savedToBackend = false;
      }

      // Fallback to localStorage if backend failed
      if (!savedToBackend) {
        try {
          const DRAFTS_KEY = "pos_drafts";
          const raw = localStorage.getItem(DRAFTS_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          arr.unshift(localDraft);
          localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr.slice(0, 100))); // Keep only last 100
          setSaveSuccess("local");
          console.log("✅ Draft saved to localStorage successfully");
        } catch (localError) {
          throw new Error("Локал хадгалалт болон бэкэнд хоёулаа алдаа гарлаа");
        }
      }

      // Show success feedback briefly before closing
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("❌ Failed to save draft:", error);
      alert(
        `Түр хадгалах үед алдаа гарлаа: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900/60 via-blue-900/50 to-indigo-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
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
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Түр хадгалах
                </h2>
                <p className="text-sm text-gray-600">
                  Сагсны агуулгыг түр хадгална уу
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
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
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Нэр <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full h-12 border-2 border-gray-200 rounded-xl px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 placeholder-gray-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ж: Хэрэглэгч A — борлуулалт"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тайлбар
              </label>
              <textarea
                className="w-full min-h-[100px] border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 placeholder-gray-400 resize-none"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ж: Хүргэлтээр, 18:00-д авах..."
                disabled={saving}
              />
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200/50">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg
                className="w-4 h-4 text-blue-500"
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
              Хураангуй
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {items.length}
                </div>
                <div className="text-xs text-gray-600">Барааны төрөл</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {totalQty}
                </div>
                <div className="text-xs text-gray-600">Нийт ширхэг</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">
                  {formatMNT(totalAmount)}
                </div>
                <div className="text-xs text-gray-600">Нийт дүн</div>
              </div>
            </div>
          </div>

          {/* Items Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">
                Барааны жагсаалт
              </h3>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">Сагс хоосон байна</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Эхлээд бараа нэмнэ үү
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((it, index) => (
                    <div
                      key={it.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {it.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {it.size && it.size !== "Default" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 mr-1">
                              {it.size}
                            </span>
                          )}
                          {it.color && it.color !== "Default" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              {it.color}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900">
                          {it.qty} × {formatMNT(it.price)}
                        </div>
                        <div className="text-sm text-gray-500">
                          = {formatMNT(it.qty * it.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          {saveSuccess && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
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
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <div className="text-green-800 font-medium">
                  Амжилттай хадгалагдлаа!
                </div>
                <div className="text-green-600 text-sm">
                  {saveSuccess === "backend"
                    ? "Сервер дээр хадгалагдлаа"
                    : "Локал хадгалалт дээр хадгалагдлаа"}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={disabled}
              className={
                "px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 " +
                (disabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : saveSuccess
                  ? "bg-green-500 text-white"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl active:scale-95")
              }
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Хадгалж байна...
                </>
              ) : saveSuccess ? (
                <>
                  <svg
                    className="w-4 h-4"
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
                  Хадгалагдлаа
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Хадгалах
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Төгрөг форматлагч (локал) */
function formatMNT(n: number) {
  if (!Number.isFinite(n)) return "0 ₮";
  return new Intl.NumberFormat("mn-MN").format(Math.floor(n)) + " ₮";
}
