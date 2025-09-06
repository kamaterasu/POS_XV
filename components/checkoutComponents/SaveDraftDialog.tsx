'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Item } from '@/lib/sales/salesType';

type Draft = {
  id: string;
  name: string;
  note?: string;
  items: Item[];
  totalQty: number;
  totalAmount: number;
  createdAt: string; // ISO
};

const DRAFTS_KEY = 'pos_drafts';

export default function SaveDraftDialog({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const { totalQty, totalAmount } = useMemo(() => {
    const qty = items.reduce((s, it) => s + (it.qty ?? 0), 0);
    const amt = items.reduce((s, it) => s + (it.qty * it.price), 0);
    return { totalQty: qty, totalAmount: amt };
  }, [items]);

  const disabled = items.length === 0 || !name.trim();

  // Esc дархад хаах
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Dialog нээгдэх бүрт талбар цэвэрлэе
  useEffect(() => {
    if (open) { setName(''); setNote(''); }
  }, [open]);

  const handleSave = () => {
    if (disabled) return;
    const draft: Draft = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      name: name.trim(),
      note: note.trim() || undefined,
      items,
      totalQty,
      totalAmount,
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      const arr: Draft[] = raw ? JSON.parse(raw) : [];
      arr.unshift(draft); // хамгийн сүүлийнхийг дээр нь
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(arr));
      onClose();
    } catch (e) {
      console.error('Failed to save draft:', e);
      alert('Түр хадгалах үед алдаа гарлаа.');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold">Түр хадгалах</div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-black/60">Нэр *</label>
            <input
              className="h-10 w-full border rounded px-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ж: Хэрэглэгч A — 08/19 борлуулалт"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-black/60">Тайлбар</label>
            <textarea
              className="min-h-[80px] w-full border rounded px-2 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ж: Хүргэлтээр, 18:00-д... "
            />
          </div>
          <div className="col-span-2 border rounded p-3 bg-[#FAFAFA]">
            <div className="flex justify-between text-sm">
              <span className="text-black/70">Барааны тоо</span>
              <span className="font-medium">{items.length} нэр</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-black/70">Нийт ширхэг</span>
              <span className="font-medium">{totalQty}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-black/70">Нийт дүн</span>
              <span className="font-semibold">{formatMNT(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Sneak peek of items */}
        <div className="max-h-40 overflow-auto border rounded">
          <ul className="divide-y">
            {items.map((it) => (
              <li key={it.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                <div className="truncate">
                  <span className="font-medium">{it.name}</span>
                  <span className="text-black/50"> — {it.size || '—'} {it.color ? `• ${it.color}` : ''}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div>{it.qty} × {formatMNT(it.price)}</div>
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-3 py-2 text-sm text-black/60">Сагс хоосон байна.</li>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-10 px-4 rounded border">Болих</button>
          <button
            onClick={handleSave}
            disabled={disabled}
            className={
              'h-10 px-4 rounded ' +
              (disabled
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : 'bg-[#5AA6FF] text-white hover:opacity-90')
            }
          >
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}

/** Төгрөг форматлагч (локал) */
function formatMNT(n: number) {
  if (!Number.isFinite(n)) return '0 ₮';
  return new Intl.NumberFormat('mn-MN').format(Math.floor(n)) + ' ₮';
}
