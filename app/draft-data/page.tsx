"use client";
import { useEffect, useState } from "react";

type LocalDraft = {
  id: string;
  name: string;
  notes?: string;
  items: any[];
  totalQty: number;
  totalAmount: number;
  createdAt: string;
};

export default function DraftDataPage() {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [rawData, setRawData] = useState<string>("");

  useEffect(() => {
    // Load data from localStorage
    const DRAFTS_KEY = "pos_drafts";
    const raw = localStorage.getItem(DRAFTS_KEY);
    setRawData(raw || "");

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setDrafts(parsed);
      } catch (error) {
        console.error("Failed to parse drafts:", error);
      }
    }
  }, []);

  const clearAllData = () => {
    localStorage.removeItem("pos_drafts");
    setDrafts([]);
    setRawData("");
    alert("Бүх өгөгдөл устгагдлаа!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              🗄️ Түр хадгалсан өгөгдөл харах
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {drafts.length} ширхэг олдлоо
              </span>
              {drafts.length > 0 && (
                <button
                  onClick={clearAllData}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Бүгдийг устгах
                </button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              📍 Хаана байгааг олох:
            </h2>
            <ol className="text-blue-800 space-y-1 ml-4">
              <li>
                <strong>1.</strong> Developer Tools нээх: F12 дарах
              </li>
              <li>
                <strong>2.</strong> Application tab руу очих
              </li>
              <li>
                <strong>3.</strong> Local Storage дарах
              </li>
              <li>
                <strong>4.</strong> localhost:3001 сонгох
              </li>
              <li>
                <strong>5.</strong> "pos_drafts" түлхүүрийг хайж олох
              </li>
            </ol>
          </div>

          {/* Formatted Data */}
          {drafts.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">
                📊 Форматлагдсан өгөгдөл:
              </h2>
              {drafts.map((draft, index) => (
                <div key={draft.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {index + 1}. {draft.name}
                      </h3>
                      {draft.notes && (
                        <p className="text-gray-600 mt-1">{draft.notes}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">
                        {new Intl.NumberFormat("mn-MN").format(
                          draft.totalAmount
                        )}{" "}
                        ₮
                      </div>
                      <div className="text-sm text-gray-500">
                        {draft.totalQty} ширхэг / {draft.items.length} төрөл
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(draft.createdAt).toLocaleString("mn-MN")}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Барааны жагсаалт:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {draft.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="text-sm bg-gray-50 rounded p-2"
                        >
                          <div className="font-medium text-gray-900">
                            {item.name}
                          </div>
                          <div className="text-gray-600">
                            {item.qty} ×{" "}
                            {new Intl.NumberFormat("mn-MN").format(item.price)}{" "}
                            ₮
                            {item.size && item.size !== "Default" && (
                              <span className="text-blue-600">
                                {" "}
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
          ) : (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
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
              <p className="text-gray-500">
                Checkout хуудсанд очиж сагсанд бараа нэмж "Хадгалах" дарна уу
              </p>
            </div>
          )}

          {/* Raw JSON Data */}
          {rawData && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                🔧 Түүхий JSON өгөгдөл:
              </h2>
              <div className="bg-gray-900 text-green-400 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                <pre>{JSON.stringify(JSON.parse(rawData), null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
