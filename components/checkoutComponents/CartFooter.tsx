"use client";
import { FaRegHandPaper } from "react-icons/fa";
import { IoMdAdd } from "react-icons/io";
import { HiOutlineInbox, HiOutlineClipboardList } from "react-icons/hi";
import { FaCashRegister } from "react-icons/fa6";

export default function CartFooter({
  onQuick,
  onAdd,
  onSave,
  onPay,
  onHistory,
  onPrint,
  onDraftManager,
}: {
  onQuick: () => void;
  onAdd: () => void;
  onSave: () => void;
  onPay: () => void;
  onHistory?: () => void;
  onPrint?: () => void;
  onDraftManager?: () => void;
}) {
  return (
    <div className="w-full">
      {/* Mobile Layout (< 640px) */}
      <div className="block sm:hidden">
        {/* Top Row - Main Actions */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={onAdd}
            className="group h-14 px-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-1 touch-manipulation"
          >
            <span className="text-emerald-600 group-hover:text-emerald-700 transition-colors">
              <IoMdAdd size={20} />
            </span>
            <span className="font-semibold text-gray-900 text-xs leading-tight">
              Нэмэх
            </span>
          </button>

          <button
            onClick={onSave}
            className="group h-14 px-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-1 touch-manipulation"
          >
            <span className="text-amber-600 group-hover:text-amber-700 transition-colors">
              <HiOutlineInbox size={20} />
            </span>
            <span className="font-semibold text-gray-900 text-xs leading-tight">
              Хадгалах
            </span>
          </button>

          <button
            onClick={onPay}
            className="group h-14 px-3 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg rounded-xl hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-1 touch-manipulation"
          >
            <span className="text-white group-hover:scale-110 transition-transform">
              <FaCashRegister size={20} />
            </span>
            <span className="font-semibold text-white text-xs leading-tight">
              Төлөх
            </span>
          </button>
        </div>

        {/* Bottom Row - Secondary Actions */}
        <div className="flex gap-2">
          {onDraftManager && (
            <button
              onClick={onDraftManager}
              className="group flex-1 h-12 px-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
            >
              <span className="text-blue-600 group-hover:text-blue-700 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              <span className="font-semibold text-gray-900 text-xs">
                Ачаалах
              </span>
            </button>
          )}

          {onHistory && (
            <button
              onClick={onHistory}
              className="group flex-1 h-12 px-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
            >
              <span className="text-purple-600 group-hover:text-purple-700 transition-colors">
                <HiOutlineClipboardList size={18} />
              </span>
              <span className="font-semibold text-gray-900 text-xs">Түүх</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Layout (≥ 640px) */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-5 gap-3 p-4 sm:p-6">
          <button
            onClick={onAdd}
            className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
          >
            <span className="text-emerald-600 group-hover:text-emerald-700 transition-colors">
              <IoMdAdd size={20} />
            </span>
            <span className="font-semibold text-gray-900 text-sm">Нэмэх</span>
          </button>

          <button
            onClick={onSave}
            className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
          >
            <span className="text-amber-600 group-hover:text-amber-700 transition-colors">
              <HiOutlineInbox size={20} />
            </span>
            <span className="font-semibold text-gray-900 text-sm">
              Хадгалах
            </span>
          </button>

          {onDraftManager && (
            <button
              onClick={onDraftManager}
              className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
            >
              <span className="text-blue-600 group-hover:text-blue-700 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </span>
              <span className="font-semibold text-gray-900 text-sm">
                Ачаалах
              </span>
            </button>
          )}

          {onHistory && (
            <button
              onClick={onHistory}
              className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
            >
              <span className="text-purple-600 group-hover:text-purple-700 transition-colors">
                <HiOutlineClipboardList size={20} />
              </span>
              <span className="font-semibold text-gray-900 text-sm">Түүх</span>
            </button>
          )}

          <button
            onClick={onPay}
            className="group h-14 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg rounded-2xl hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 touch-manipulation"
          >
            <span className="text-white group-hover:scale-110 transition-transform">
              <FaCashRegister size={20} />
            </span>
            <span className="font-semibold text-white text-sm">Төлөх</span>
          </button>
        </div>
      </div>
    </div>
  );
}
