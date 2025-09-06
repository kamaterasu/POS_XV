'use client';
import Image from 'next/image';
import { useState, type SyntheticEvent } from 'react';
import type { Product } from '@/lib/inventory/inventoryTypes';
import { Loading } from '@/components/Loading';

export default function ProductRowCount({
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
  const [loading] = useState(false);
  if (loading) return <Loading open label="Уншиж байна…" />;

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
          <span className="text-xs text-[#666]">Систем: {p.qty}</span>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={stop}>
        <button
          onClick={(e) => { stop(e); onChange(Math.max(0, value - 1)); }}
          className="w-8 h-8 rounded-md border border-[#E6E6E6] bg-white"
          aria-label="Decrease"
        >
          –
        </button>
        <input
          type="number"
          className="w-16 h-8 rounded-md border border-[#E6E6E6] bg-white text-center"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))}
          onClick={stop}
        />
        <button
          onClick={(e) => { stop(e); onChange(value + 1); }}
          className="w-8 h-8 rounded-md border border-[#E6E6E6] bg-white"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </li>
  );
}
