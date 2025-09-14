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
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom duration-400 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header */}
        <div className="relative p-6 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
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
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Түр хадгалах
                </h2>
                <p className="text-sm text-gray-600 mt-1 font-medium">
                  Сагсны агуулгыг түр хадгална уу
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="group w-12 h-12 rounded-2xl bg-white/90 hover:bg-white border border-gray-200/50 hover:border-gray-300 flex items-center justify-center transition-all duration-300 hover:shadow-xl"
            >
              <svg
                className="w-6 h-6 text-gray-600 group-hover:text-gray-800 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Elegant gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-t-[2rem] pointer-events-none"></div>
        </div>

        {/* Enhanced Content */}
        <div className="p-8 space-y-8">
          {/* Enhanced Form Fields */}
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-3">
                <span>Нэр</span>
                <span className="text-red-500 text-lg">*</span>
              </label>
              <input
                className="w-full h-14 border-2 border-gray-200/60 rounded-2xl px-6 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder-gray-500 bg-white/90 backdrop-blur-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="📝 Ж: Хэрэглэгч A — борлуулалт"
                disabled={saving}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-3">
                <span>Тайлбар</span>
                <span className="text-xs text-gray-500 font-normal">
                  (заавал бус)
                </span>
              </label>
              <textarea
                className="w-full min-h-[120px] border-2 border-gray-200/60 rounded-2xl px-6 py-4 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-300 placeholder-gray-500 resize-none bg-white/90 backdrop-blur-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="💭 Ж: Хүргэлтээр, 18:00-д авах..."
                disabled={saving}
              />
            </div>
          </div>

          {/* Enhanced Summary Card */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-6 border border-blue-200/40 shadow-lg shadow-blue-500/10 backdrop-blur-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span>Хураангуй</span>
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {items.length}
                </div>
                <div className="text-sm text-gray-700 font-medium">
                  Барааны төрөл
                </div>
              </div>
              <div className="text-center p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {totalQty}
                </div>
                <div className="text-sm text-gray-700 font-medium">
                  Нийт ширхэг
                </div>
              </div>
              <div className="text-center p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50">
                <div className="text-xl font-bold text-purple-600 mb-1 leading-tight">
                  {formatMNT(totalAmount)}
                </div>
                <div className="text-sm text-gray-700 font-medium">
                  Нийт дүн
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Items Preview */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/50 overflow-hidden shadow-lg shadow-blue-500/10">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50/50 border-b border-gray-200/40">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                </div>
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
          {/* Enhanced Action Buttons */}
          <div className="flex justify-end gap-4 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-8 py-4 rounded-2xl border-2 border-gray-300/60 bg-white/90 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 disabled:opacity-50 shadow-sm hover:shadow-lg backdrop-blur-sm"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={disabled}
              className={
                "px-8 py-4 rounded-2xl font-bold transition-all duration-300 flex items-center gap-3 shadow-xl " +
                (disabled
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : saveSuccess
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/30"
                  : "bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 shadow-blue-500/30 hover:shadow-blue-600/40 active:scale-95 transform")
              }
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent"></div>
                  <span>Хадгалж байна...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Хадгалагдлаа</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span>Хадгалах</span>
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
