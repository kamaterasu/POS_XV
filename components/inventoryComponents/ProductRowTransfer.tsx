'use client';
import Image from 'next/image';
import type { Product } from '@/lib/inventory/inventoryTypes';
import type { SyntheticEvent } from 'react';

export default function ProductRowTransfer({
  p,
  value,
  onChange,
  onOpen,
}: {
  p: Product;
  value: number;
  onChange: (v: number) => void;
  onOpen?: (id: string) => void;
}) {
  const max = p.qty;
  const stop = (e: SyntheticEvent) => e.stopPropagation();

  return (
    <li
      className="flex justify-between py-2 items-center cursor-pointer"
      onClick={() => onOpen?.(p.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(p.id); }}
    >
      <div className="flex gap-2 items-center">
        <Image
          src="/default.png"
          alt={p.name}
          width={40}
          height={40}
          className="w-10 h-10 rounded-sm object-cover bg-[#EFEFEF]"
        />
        <div className="flex flex-col">
          <span className="font-medium">{p.name}</span>
          <span className="text-xs text-[#666]">Нөөц: {p.qty}</span>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={stop}>
        <input
          type="number"
          min={0}
          max={max}
          className="w-20 h-8 rounded-md border border-[#E6E6E6] bg-white text-center"
          value={value}
          onChange={(e) => {
            const n = Math.max(0, Math.min(max, Number(e.target.value || 0)));
            onChange(n);
          }}
        />
        <button
          onClick={(e) => { stop(e); onChange(Math.min(max, value + 1)); }}
          className="h-8 px-3 rounded-md border border-[#E6E6E6] bg-white"
        >
          Нэмэх
        </button>
      </div>
    </li>
  );
}
