'use client';
import Image from 'next/image';
import type { Product } from '@/lib/inventory/inventoryTypes';

export default function ProductRowView({
  p,
  onOpen,
}: {
  p: Product;
  onOpen?: (id: string) => void;
}) {
  return (
    <li
      className="flex justify-between py-2 cursor-pointer"
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
        <span>{p.name}</span>
      </div>
      <span className="flex items-center">{p.qty}</span>
    </li>
  );
}
