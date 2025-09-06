'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductRowView from './ProductRowView';
import ProductRowCount from './ProductRowCount';
import ProductRowTransfer from './ProductRowTransfer';
import type { Mode, Product } from '@/lib/inventory/inventoryTypes';
import { Loading } from '@/components/Loading';

export default function ProductList({
  mode, products, countMap, setCountMap, transferMap, setTransferMap,
}: {
  mode: Mode;
  products: Product[];
  countMap: Record<string, number>;
  setCountMap: (u: (m: Record<string, number>) => Record<string, number>) => void;
  transferMap: Record<string, number>;
  setTransferMap: (u: (m: Record<string, number>) => Record<string, number>) => void;
}) {
  const [loading] = useState(false);
  const router = useRouter();

  const openDetail = (id: string) => router.push(`/productdetail/${id}`);

  if (loading) return <Loading open label="Уншиж байна…" />;

  return (
    <ul className="divide-y divide-[#E6E6E6]">
      {products.map((p) => {
        if (mode === 'view') {
          return <ProductRowView key={p.id} p={p} onOpen={openDetail} />;
        }
        if (mode === 'count') {
          const v = countMap[p.id] ?? p.qty;
          return (
            <ProductRowCount
              key={p.id}
              p={p}
              value={v}
              onOpen={openDetail}
              onChange={(val) => setCountMap(m => ({ ...m, [p.id]: val }))}
            />
          );
        }
        if (mode === 'transfer') {
          const v = transferMap[p.id] ?? 0;
          return (
            <ProductRowTransfer
              key={p.id}
              p={p}
              value={v}
              onOpen={openDetail}
              onChange={(val) => setTransferMap(m => ({ ...m, [p.id]: val }))}
            />
          );
        }
        return null;
      })}
    </ul>
  );
}
