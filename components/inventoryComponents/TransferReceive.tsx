'use client';
import type { IncomingTransfer } from '@/lib/inventory/inventoryTypes';
import Image from 'next/image';
import { useState } from 'react';
import { Loading } from '@/components/Loading';

export default function TransferReceive({
  transfers,
  openTransfers,
  setOpenTransfers,
  receiveChecked,
  setReceiveChecked,
  receiveQty,
  setReceiveQty,
}: {
  transfers: IncomingTransfer[];
  openTransfers: Record<string, boolean>;
  setOpenTransfers: (u: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  receiveChecked: Record<string, boolean>;
  setReceiveChecked: (u: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  receiveQty: Record<string, number>;
  setReceiveQty: (u: (s: Record<string, number>) => Record<string, number>) => void;
}) {
  const [loading] = useState(false);
  if (loading) return <Loading open label="Уншиж байна…" />;

  return (
    <div className="space-y-3">
      {transfers.map(tr => {
        const open = !!openTransfers[tr.id];
        const allLinesChecked = tr.items.every(it => !!receiveChecked[it.lineId]);
        const someChecked = tr.items.some(it => !!receiveChecked[it.lineId]);

        const totalExpected = tr.items.reduce((a, b) => a + b.expectedQty, 0);
        const totalSelected = tr.items.reduce((a, b) => {
          if (!receiveChecked[b.lineId]) return a;
          const q = Math.min(b.expectedQty, Math.max(0, Number(receiveQty[b.lineId] ?? b.expectedQty)));
          return a + q;
        }, 0);

        const toggle = () => setOpenTransfers(s => ({ ...s, [tr.id]: !open }));

        const handleCheckAll = (checked: boolean) => {
          setReceiveChecked(prev => {
            const next = { ...prev };
            tr.items.forEach(it => (next[it.lineId] = checked));
            return next;
          });
          if (checked) {
            setReceiveQty(prev => {
              const next = { ...prev };
              tr.items.forEach(it => {
                if (!next[it.lineId]) next[it.lineId] = it.expectedQty;
              });
              return next;
            });
          }
        };

        return (
          <div key={tr.id} className="rounded-lg border border-[#E6E6E6]">
            <button onClick={toggle} className="w-full px-3 py-3 flex items-center gap-3">
              <div className="flex-1 text-left">
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-semibold">{tr.id}</span>
                  <span className="text-xs text-[#666]">- {tr.from}</span>
                </div>
                <div className="text-xs text-[#888]">
                  {tr.createdAt}
                  {tr.note ? ` • ${tr.note}` : ''}
                </div>
              </div>
              <div className="text-right text-xs">
                <div>Нийт ирэх: <b>{totalExpected}</b></div>
                <div>Сонгосон: <b>{totalSelected}</b></div>
              </div>
              <span className="ml-3 text-lg">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={allLinesChecked}
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    ref={(el) => { if (el) el.indeterminate = !allLinesChecked && someChecked; }}
                  />
                  <span className="text-sm">Бүгдийг сонгох</span>
                </div>

                <ul className="divide-y divide-[#E6E6E6]">
                  {tr.items.map(it => {
                    const checked = !!receiveChecked[it.lineId];
                    const val = Math.min(
                      it.expectedQty,
                      Math.max(0, Number(receiveQty[it.lineId] ?? it.expectedQty)),
                    );
                    return (
                      <li key={it.lineId} className="py-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setReceiveChecked(m => ({ ...m, [it.lineId]: e.target.checked }))}
                        />
                        <Image
                          src={it.imgPath || '/default.png'}
                          alt={it.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-sm object-cover bg-[#EFEFEF]"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{it.name}</div>
                          <div className="text-xs text-[#666]">Expected: {it.expectedQty}</div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={it.expectedQty}
                          disabled={!checked}
                          className="w-20 h-8 rounded-md border border-[#E6E6E6] bg-white text-center disabled:opacity-50"
                          value={val}
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(it.expectedQty, Number(e.target.value || 0)));
                            setReceiveQty(m => ({ ...m, [it.lineId]: n }));
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
