'use client';
import type { Mode } from '@/lib/inventory/inventoryTypes';
import { useState } from 'react';
import { Loading } from '@/components/Loading';

export default function ModeSwitcher({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const [loading] = useState(false);

  function Chip({
    value, label, disabled = false,
  }: { value: Mode; label: string; disabled?: boolean }) {
    const active = mode === value;
    return (
      <button
        type="button"
        onClick={() => !disabled && setMode(value)}
        disabled={disabled}
        aria-disabled={disabled}
        className={[
          'h-8 px-3 rounded-full text-xs border transition shrink-0',
          active ? 'bg-[#5AA6FF] text-white border-[#5171F3]' : 'bg-white text-black border-[#E6E6E6]',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm',
        ].join(' ')}
      >
        {label}
      </button>
    );
  }

  if (loading) return <Loading open label="Уншиж байна…" />;

  return (
    <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]">
      <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
      <Chip value="view" label="Зүгээр харах" />
      <Chip value="count" label="Тооллого" />
      <Chip value="transfer" label="Өөр салбар руу шилжүүлэх" />
      <Chip value="receive" label="Шилжүүлгийг бүртгэх" />
    </div>
  );
}
