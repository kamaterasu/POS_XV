'use client';
import { FaRegHandPaper } from "react-icons/fa";
import { IoMdAdd } from "react-icons/io";
import { HiOutlineInbox } from "react-icons/hi";
import { FaCashRegister } from "react-icons/fa6";

export default function CartFooter({
  onQuick, onAdd, onSave, onPay,
}: {
  onQuick: () => void;
  onAdd: () => void;
  onSave: () => void;
  onPay: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 m-2.5 h-[90px]">
      <button onClick={onQuick} className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-5 text-black text-[13px] flex items-center justify-center gap-2">
        <span className="text-2xl leading-none"><FaRegHandPaper /></span>
        Гарын доорх
      </button>
      <button onClick={onAdd} className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-5 text-black text-[13px] flex items-center justify-center gap-2">
        <span className="text-2xl leading-none"><IoMdAdd /></span>
        Бараа нэмэх
      </button>
      <button onClick={onSave} className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-5 text-black text-[13px] flex items-center justify-center gap-2">
        <span className="text-2xl leading-none"><HiOutlineInbox /></span>
        Түр хадгалах
      </button>
      <button onClick={onPay} className="bg-[#5AA6FF] rounded-md border border-[#5171F3] shadow-md h-10 px-5 text-white text-[13px] flex items-center justify-center gap-2">
        <span className="text-2xl leading-none"><FaCashRegister /></span>
        Төлөх
      </button>
    </div>
  );
}
