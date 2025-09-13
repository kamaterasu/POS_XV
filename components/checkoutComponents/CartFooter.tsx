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
    <div className="grid grid-cols-5 gap-3 p-6">
      <button
        onClick={onAdd}
        className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-emerald-600 group-hover:text-emerald-700 transition-colors">
          <IoMdAdd size={20} />
        </span>
        <span className="font-semibold text-gray-900 text-sm">Нэмэх</span>
      </button>

      <button
        onClick={onSave}
        className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-amber-600 group-hover:text-amber-700 transition-colors">
          <HiOutlineInbox size={20} />
        </span>
        <span className="font-semibold text-gray-900 text-sm">Хадгалах</span>
      </button>

      {onDraftManager && (
        <button
          onClick={onDraftManager}
          className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
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
          <span className="font-semibold text-gray-900 text-sm">Ачаалах</span>
        </button>
      )}

      {onHistory && (
        <button
          onClick={onHistory}
          className="group h-14 px-4 bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg rounded-2xl hover:shadow-xl hover:bg-white transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="text-purple-600 group-hover:text-purple-700 transition-colors">
            <HiOutlineClipboardList size={20} />
          </span>
          <span className="font-semibold text-gray-900 text-sm">Түүх</span>
        </button>
      )}

      {/* {onPrint && (
        <button
          onClick={onPrint}
          className="group h-12 px-3 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
        >
          <span className="text-gray-600 group-hover:text-gray-700 transition-colors">
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
          </span>
          <span className="font-medium text-gray-900 text-xs">Хэвлэх</span>
        </button>
      )} */}

      <button
        onClick={onPay}
        className="group h-12 px-3 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg rounded-xl hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1"
      >
        <span className="text-white group-hover:scale-110 transition-transform">
          <FaCashRegister size={18} />
        </span>
        <span className="font-semibold text-white text-xs">Төлөх</span>
      </button>
    </div>
  );
}
