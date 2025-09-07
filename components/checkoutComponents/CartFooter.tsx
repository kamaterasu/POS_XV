"use client";
import { FaRegHandPaper } from "react-icons/fa";
import { IoMdAdd } from "react-icons/io";
import { HiOutlineInbox } from "react-icons/hi";
import { FaCashRegister } from "react-icons/fa6";

export default function CartFooter({
  onQuick,
  onAdd,
  onSave,
  onPay,
}: {
  onQuick: () => void;
  onAdd: () => void;
  onSave: () => void;
  onPay: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      <button
        onClick={onAdd}
        className="group h-14 px-4 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-emerald-600 group-hover:text-emerald-700 transition-colors">
          <IoMdAdd size={20} />
        </span>
        <span className="font-medium text-gray-900 text-sm">Бараа нэмэх</span>
      </button>

      <button
        onClick={onSave}
        className="group h-14 px-4 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-amber-600 group-hover:text-amber-700 transition-colors">
          <HiOutlineInbox size={20} />
        </span>
        <span className="font-medium text-gray-900 text-sm">Түр хадгалах</span>
      </button>

      <button
        onClick={onPay}
        className="group h-14 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg rounded-xl hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
      >
        <span className="text-white group-hover:scale-110 transition-transform">
          <FaCashRegister size={20} />
        </span>
        <span className="font-semibold text-white text-sm">Төлөх</span>
      </button>
    </div>
  );
}
