"use client";
import { useEffect, useState } from "react";
import type { Item } from "@/lib/sales/salesTypes";

type LocalDraft = {
  id: string;
  name: string;
  notes?: string;
  items: Item[];
  totalQty: number;
  totalAmount: number;
  createdAt: string;
};

export default function DraftManagerDialog({
  open,
  onClose,
  onLoadDraft,
}: {
  open: boolean;
  onClose: () => void;
  onLoadDraft: (items: Item[]) => void;
}) {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [loading, setLoading] = useState(false);

  // Load drafts from localStorage
  const loadDrafts = () => {
    try {
      const DRAFTS_KEY = "pos_drafts";
      const raw = localStorage.getItem(DRAFTS_KEY);
      const draftList = raw ? JSON.parse(raw) : [];
      setDrafts(draftList);
    } catch (error) {
      console.error("Failed to load drafts:", error);
      setDrafts([]);
    }
  };

  // Delete draft
  const deleteDraft = (draftId: string) => {
    try {
      const DRAFTS_KEY = "pos_drafts";
      const raw = localStorage.getItem(DRAFTS_KEY);
      const draftList = raw ? JSON.parse(raw) : [];
      const updated = draftList.filter((d: LocalDraft) => d.id !== draftId);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      setDrafts(updated);
    } catch (error) {
      console.error("Failed to delete draft:", error);
      alert("Устгах үед алдаа гарлаа");
    }
  };

  // Load draft items into cart
  const handleLoadDraft = (draft: LocalDraft) => {
    onLoadDraft(draft.items);
    onClose();
  };

  // Clear all drafts
  const clearAllDrafts = () => {
    if (confirm("Бүх түр хадгалсан өгөгдлийг устгах уу?")) {
      localStorage.removeItem("pos_drafts");
      setDrafts([]);
    }
  };

  useEffect(() => {
    if (open) {
      loadDrafts();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900/50 via-blue-900/60 to-indigo-900/50 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-500"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-5xl bg-white/98 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/30 overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-600 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Enhanced Modern Header */}
        <div className="relative p-8 pb-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/25">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Түр хадгалсан өгөгдөл
                </h2>
                <p className="text-sm text-gray-600 mt-1 font-medium">
                  {drafts.length} ширхэг түр хадгалагдсан захиалга
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {drafts.length > 0 && (
                <button
                  onClick={clearAllDrafts}
                  className="px-4 py-2.5 text-sm font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-xl transition-all duration-200 border border-red-200/50 hover:border-red-300"
                >
                  Бүгдийг устгах
                </button>
              )}
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
          </div>

          {/* Elegant gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-t-[2rem] pointer-events-none"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Түр хадгалсан өгөгдөл байхгүй
              </h3>
              <p className="text-gray-500 text-center">
                Сагсны агуулгыг түр хадгалсны дараа энд харагдана
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {draft.name}
                      </h3>
                      {draft.notes && (
                        <p className="text-sm text-gray-600 mb-2">
                          {draft.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
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
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {new Date(draft.createdAt).toLocaleString("mn-MN")}
                        </span>
                        <span className="flex items-center gap-1">
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
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                          {draft.items.length} төрөл
                        </span>
                        <span className="flex items-center gap-1">
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
                              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                            />
                          </svg>
                          {draft.totalQty} ширхэг
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600 mb-2">
                        {formatMNT(draft.totalAmount)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadDraft(draft)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center gap-1"
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
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          Ачаалах
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="px-3 py-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 text-sm rounded-xl transition-colors"
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
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Барааны жагсаалт:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                      {draft.items.map((item, index) => (
                        <div
                          key={item.id}
                          className="text-sm bg-white rounded-lg p-2 border border-gray-200"
                        >
                          <div className="font-medium text-gray-900 truncate">
                            {item.name}
                          </div>
                          <div className="text-gray-500">
                            {item.qty} × {formatMNT(item.price)}
                            {item.size && item.size !== "Default" && (
                              <span className="ml-1 text-blue-600">
                                ({item.size})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
