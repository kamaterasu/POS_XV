"use client";

import { useState, useEffect } from "react";
import {
  Transfer,
  TransferWithItems,
  getTransferById,
  getTransferStatusColor,
  getStatusLabel,
  getAvailableActions,
  getActionLabel,
  updateTransferStatus,
  type TransferAction,
} from "@/lib/transfer/transferApi";
import { X, Package, Clock, User, FileText } from "lucide-react";

type Store = {
  id: string;
  name: string;
};

type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  product_name?: string;
};

type TransferDetailModalProps = {
  transferId: string;
  stores: Store[];
  variants: ProductVariant[];
  onClose: () => void;
  onUpdate: () => void;
};

export default function TransferDetailModal({
  transferId,
  stores,
  variants,
  onClose,
  onUpdate,
}: TransferDetailModalProps) {
  const [transferData, setTransferData] = useState<TransferWithItems | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadTransferData();
  }, [transferId]);

  const loadTransferData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTransferById(transferId);
      setTransferData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Мэдээлэл татахад алдаа гарлаа"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStoreName = (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    return store?.name || storeId;
  };

  const getVariantName = (variantId: string) => {
    const variant = variants.find((v) => v.id === variantId);
    return variant ? `${variant.name} (${variant.sku})` : variantId;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("mn-MN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAction = async (action: TransferAction) => {
    if (!transferData) return;

    setActionLoading(action);
    setError("");

    try {
      await updateTransferStatus(transferData.transfer.id, action);
      await loadTransferData(); // Reload to get updated status
      onUpdate(); // Notify parent to refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transferData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Алдаа</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="text-red-600">{error || "Мэдээлэл олдсонгүй"}</div>
          <div className="mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Хаах
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { transfer, items } = transferData;
  const availableActions = getAvailableActions(transfer);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Шилжүүлгийн дэлгэрэнгүй #{transfer.id.slice(-8)}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Статус
                </label>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getTransferStatusColor(
                    transfer.status
                  )}`}
                >
                  {getStatusLabel(transfer.status)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Илгээх дэлгүүр
                </label>
                <div className="text-gray-900">
                  {getStoreName(transfer.src_store_id)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Хүлээн авах дэлгүүр
                </label>
                <div className="text-gray-900">
                  {getStoreName(transfer.dst_store_id)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Үүсгэсэн огноо
                </label>
                <div className="text-gray-900">
                  {formatDate(transfer.created_at)}
                </div>
              </div>

              {transfer.approved_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Батлагдсан огноо
                  </label>
                  <div className="text-gray-900">
                    {formatDate(transfer.approved_at)}
                  </div>
                </div>
              )}

              {transfer.shipped_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Илгээсэн огноо
                  </label>
                  <div className="text-gray-900">
                    {formatDate(transfer.shipped_at)}
                  </div>
                </div>
              )}

              {transfer.received_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Хүлээн авсан огноо
                  </label>
                  <div className="text-gray-900">
                    {formatDate(transfer.received_at)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Note */}
          {transfer.note && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Тэмдэглэл
              </label>
              <div className="bg-gray-50 rounded-lg p-3 text-gray-900">
                {transfer.note}
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Шилжүүлэх барааны жагсаалт ({items.length} бараа)
            </label>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Бараа
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Тоо ширхэг
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {getVariantName(item.variant_id)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-gray-900 font-medium">
                          {item.qty}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          {availableActions.length > 0 && (
            <div className="border-t pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Боломжтой үйлдлүүд
              </label>
              <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleAction(action)}
                    disabled={actionLoading !== null}
                    className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${
                      action === "cancel"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : action === "approve"
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : action === "ship"
                        ? "bg-purple-600 text-white hover:bg-purple-700"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {actionLoading === action
                      ? "Түр хүлээнэ үү..."
                      : getActionLabel(action)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
}
