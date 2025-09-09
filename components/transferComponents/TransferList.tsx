"use client";

import { useState } from "react";
import {
  Transfer,
  getTransferStatusColor,
  getAvailableActions,
  getActionLabel,
  getStatusLabel,
  updateTransferStatus,
  deleteTransfer,
  type TransferAction,
} from "@/lib/transfer/transferApi";
import {
  Eye,
  MoreHorizontal,
  Truck,
  CheckCircle,
  XCircle,
  Trash2,
  ArrowRight,
  Calendar,
  Package2,
  Building2,
} from "lucide-react";

type Store = {
  id: string;
  name: string;
};

type TransferListProps = {
  transfers: Transfer[];
  stores: Store[];
  onTransferUpdate: () => void;
  onViewTransfer: (transfer: Transfer) => void;
};

// Mongolian translations for status labels
const getStatusLabelMN = (status: string) => {
  switch (status) {
    case "REQUESTED":
      return "Хүсэлт";
    case "APPROVED":
      return "Зөвшөөрөгдсөн";
    case "SHIPPED":
      return "Илгээгдсэн";
    case "RECEIVED":
      return "Хүлээн авсан";
    case "CANCELLED":
      return "Цуцлагдсан";
    default:
      return status;
  }
};

// Mongolian translations for action labels
const getActionLabelMN = (action: TransferAction) => {
  switch (action) {
    case "approve":
      return "Зөвшөөрөх";
    case "ship":
      return "Илгээх";
    case "receive":
      return "Хүлээн авах";
    case "cancel":
      return "Цуцлах";
    default:
      return action;
  }
};

export default function TransferList({
  transfers,
  stores,
  onTransferUpdate,
  onViewTransfer,
}: TransferListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const getStoreName = (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    return store?.name || storeId;
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

  const handleAction = async (transferId: string, action: TransferAction) => {
    setLoading(transferId);
    setError("");

    try {
      await updateTransferStatus(transferId, action);
      onTransferUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Үйлдэл амжилтгүй боллоо");
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (transferId: string) => {
    if (!confirm("Энэ шилжүүлгийг устгахдаа итгэлтэй байна уу?")) {
      return;
    }

    setLoading(transferId);
    setError("");

    try {
      await deleteTransfer(transferId);
      onTransferUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Устгах үйлдэл амжилтгүй боллоо"
      );
    } finally {
      setLoading(null);
    }
  };

  if (transfers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="max-w-sm mx-auto">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Package2 className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Шилжүүлэг олдсонгүй
          </h3>
          <p className="text-gray-600 mb-6">
            Дэлгүүрүүдийн хоорондох анхны барааны шилжүүлгээ үүсгэж эхлээрэй.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {error && (
        <div className="bg-red-50 border-b border-red-200 p-4">
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Шилжүүлгийн мэдээлэл
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Чиглэл
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Төлөв
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Үүсгэсэн огноо
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Үйлдэл
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transfers.map((transfer) => {
              const availableActions = getAvailableActions(transfer);
              const isTransferLoading = loading === transfer.id;

              return (
                <tr
                  key={transfer.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                          <Package2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            #{transfer.id.slice(-8).toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transfer.note && transfer.note.length > 30
                              ? `${transfer.note.slice(0, 30)}...`
                              : transfer.note || "Тэмдэглэл алга"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {getStoreName(transfer.src_store_id)}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {getStoreName(transfer.dst_store_id)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransferStatusColor(
                        transfer.status
                      )}`}
                    >
                      {getStatusLabelMN(transfer.status)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(transfer.created_at)}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {/* View Details Button */}
                      <button
                        onClick={() => onViewTransfer(transfer)}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                        title="Дэлгэрэнгүй харах"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {/* Action Buttons */}
                      {availableActions.map((action) => (
                        <button
                          key={action}
                          onClick={() => handleAction(transfer.id, action)}
                          disabled={isTransferLoading}
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            action === "cancel"
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : action === "approve"
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : action === "ship"
                              ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                          title={getActionLabelMN(action)}
                        >
                          {isTransferLoading ? (
                            <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full"></div>
                          ) : (
                            getActionLabelMN(action)
                          )}
                        </button>
                      ))}

                      {/* Delete Button (only for non-shipped transfers) */}
                      {!transfer.shipped_posted && (
                        <button
                          onClick={() => handleDelete(transfer.id)}
                          disabled={isTransferLoading}
                          className="inline-flex items-center p-2 border border-gray-300 rounded-lg text-red-400 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                          title="Устгах"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Summary */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Нийт {transfers.length} шилжүүлэг харуулж байна
          </div>
          <div className="text-sm text-gray-600">
            Сүүлд шинэчилсэн: {new Date().toLocaleTimeString("mn-MN")}
          </div>
        </div>
      </div>
    </div>
  );
}
