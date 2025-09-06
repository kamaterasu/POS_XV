'use client';
import { useMemo, useState } from 'react';
import { Item } from '@/lib/sales/salesType';
import { FiHeart } from 'react-icons/fi';
import { FaShoppingCart } from 'react-icons/fa';
import Image from 'next/image';

type Variant = { color: string; size: string; stock: number; price: number };
type Product = {
  id: string;
  name: string;
  img?: string;
  variants: Variant[];
};

const defaultCatalog: Product[] = [
  {
    id: 'p1',
    name: 'Бараа 1',
    img: '',
    variants: [
      { color: 'Цэнхэр', size: '3XL', stock: 2, price: 200000 },
      { color: 'Цэнхэр', size: '2XL', stock: 1, price: 200000 },
      { color: 'Хар', size: 'XL', stock: 5, price: 200000 },
      { color: 'Цайвар', size: 'L', stock: 0, price: 200000 },
      { color: 'Хар', size: 'M', stock: 3, price: 200000 },
    ],
  },
];

export default function AddItemModal({
  open,
  onClose,
  onAdd,
  catalog = defaultCatalog,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (it: Item) => void;
  catalog?: Product[];
}) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(catalog[0]?.id ?? null);

  const active = useMemo(
    () => catalog.find((p) => p.id === activeId) ?? null,
    [catalog, activeId]
  );

  const colors = useMemo(
    () => Array.from(new Set((active?.variants ?? []).map((v) => v.color))),
    [active]
  );
  const sizes = useMemo(
    () => Array.from(new Set((active?.variants ?? []).map((v) => v.size))),
    [active]
  );

  const [selColor, setSelColor] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const resetSelection = () => { setSelColor(null); setSelSize(null); setQty(1); };
  const selectProduct = (id: string) => { setActiveId(id); resetSelection(); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const selectedVariant: Variant | null = useMemo(() => {
    if (!active || !selColor || !selSize) return null;
    return active.variants.find((v) => v.color === selColor && v.size === selSize) ?? null;
  }, [active, selColor, selSize]);

  const remaining = selectedVariant?.stock ?? 0;
  const canAdd = !!active && !!selectedVariant && qty > 0 && qty <= remaining;

  const handleAdd = () => {
    if (!canAdd || !active || !selectedVariant) return;
    onAdd({
      id: `${active.id}-${selectedVariant.color}-${selectedVariant.size}-${Date.now()}`,
      name: active.name,
      qty,
      price: selectedVariant.price,
      size: selectedVariant.size,
      color: selectedVariant.color,
      imgPath: active.img || '/default.png',
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 overscroll-contain text-black"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-5xl bg-white
          h-[90dvh] md:h-auto md:max-h-[90vh]
          rounded-t-2xl md:rounded-2xl
          shadow-lg flex flex-col overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 md:p-4 border-b shrink-0">
          <div className="text-lg font-semibold">Борлуулалт — Бүтээгдэхүүн</div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* LEFT */}
            <div className="border rounded-lg overflow-hidden flex flex-col h-full">
              <div className="p-3 border-b shrink-0">
                <input
                  className="h-10 w-full border rounded px-3"
                  placeholder="Хайх: нэр, код"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 mt-2 text-[12px]">
                  {['Бүгд', 'Гутал', 'Амал драк хүргэв', 'Цамц', 'Цүнх'].map((t, i) => (
                    <span
                      key={t}
                      className={
                        'px-2 py-1 rounded border ' +
                        (i === 0 ? 'bg-[#EAF2FF] border-[#CFE3FF] text-[#1A274F]' : 'bg-white')
                      }
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAFA] border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Брэнд</th>
                      <th className="text-right px-3 py-2 font-medium">Ширхэг</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((p) => {
                      const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                      const activeRow = p.id === active?.id;
                      return (
                        <tr
                          key={p.id}
                          className={
                            'cursor-pointer hover:bg-[#F7F7F5] ' +
                            (activeRow ? 'bg-[#F7F7F5]' : '')
                          }
                          onClick={() => selectProduct(p.id)}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-[#EEE] overflow-hidden" />
                              <span className="truncate">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{totalStock}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td className="px-3 py-6 text-sm text-black/60" colSpan={2}>
                          Илэрц олдсонгүй.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 shrink-0">
                <button
                  type="button"
                  className="relative h-12 w-12 rounded-full border shadow bg-white flex items-center justify-center"
                  title="Сагс"
                >
                  <FaShoppingCart />
                  <span className="absolute -top-1 -right-1 text-[11px] rounded-full bg-[#5AA6FF] text-white px-1">
                    1
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div className="border rounded-lg overflow-hidden flex flex-col h-full">
              <div className="p-3 border-b shrink-0 flex items-start gap-3">
                <div className="w-16 h-16 rounded bg-[#EFEFEF] flex items-center justify-center text-xs text-black/50 overflow-hidden">
                  {active?.img ? (
                    <Image src={active.img} alt={active.name} className="object-cover w-full h-full" />
                  ) : (
                    <span>Зураг</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Нэр: {active?.name ?? '—'}</div>
                  <div className="text-sm text-black/60">
                    Нөөц: {active ? active.variants.reduce((s, v) => s + v.stock, 0) : 0}
                  </div>
                </div>
                <button type="button" className="h-8 w-8 rounded-full border flex items-center justify-center">
                  <FiHeart />
                </button>
              </div>

              <div className="p-3 border-b shrink-0">
                <div className="text-sm font-medium mb-2">Өнгө:</div>
                <div className="flex gap-2">
                  {colors.map((c) => {
                    const activeChip = selColor === c;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setSelColor(c)}
                        className={
                          'h-8 px-3 rounded-full border text-sm ' +
                          (activeChip
                            ? 'bg-[#1A274F] text-white border-[#1A274F]'
                            : 'bg-white')
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                  {colors.length === 0 && <span className="text-sm text-black/50">—</span>}
                </div>
              </div>

              <div className="p-3 border-b shrink-0">
                <div className="text-sm font-medium mb-2">Хэмжээ:</div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const v = active?.variants.find((v) => v.size === s && (!selColor || v.color === selColor));
                    const disabled = !v || v.stock <= 0;
                    const activeChip = selSize === s;
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => !disabled && setSelSize(s)}
                        className={
                          'h-8 px-3 rounded-full border text-sm ' +
                          (disabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : activeChip
                            ? 'bg-[#EAF2FF] border-[#CFE3FF] text-[#1A274F]'
                            : 'bg-white')
                        }
                        disabled={disabled}
                      >
                        {s}
                      </button>
                    );
                  })}
                  {sizes.length === 0 && <span className="text-sm text-black/50">—</span>}
                </div>
              </div>

              <div className="p-3 border-b shrink-0 text-sm">
                <div className="text-black/60">Сонгосон хувилбар:</div>
                <div className="font-medium">
                  {selColor && selSize ? `${selColor} / ${selSize}` : '—'}
                </div>
                {selectedVariant && (
                  <div className="mt-1">
                    <a className="text-[#5AA6FF]" href="#!" onClick={(e)=>e.preventDefault()}>
                      Боломжит: {remaining}
                    </a>
                  </div>
                )}
              </div>

              {/* optional scrollable middle segment */}
              <div className="flex-1 overflow-y-auto p-3">
                {/* энд хүсвэл урт тайлбар/metadata байрлуулж болно */}
              </div>

              <div className="p-3 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-black/60">Тоо</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-8 h-8 rounded bg-[#EDEDED]"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      –
                    </button>
                    <span className="min-w-[28px] text-center text-sm border border-[#CFE3FF] bg-[#F2F7FF] rounded px-2 py-1">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded bg-[#5AA6FF] text-white disabled:opacity-50"
                      onClick={() => setQty((q) => Math.min(9999, q + 1))}
                      disabled={!selectedVariant || qty >= remaining}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={onClose} className="h-10 px-4 rounded border">Болих</button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!canAdd}
                    className={
                      'h-10 px-4 rounded ' +
                      (!canAdd
                        ? 'bg-gray-300 text-white cursor-not-allowed'
                        : 'bg-[#5AA6FF] text-white hover:opacity-90')
                    }
                  >
                    Сагс руу нэмэх
                  </button>
                </div>

                {canAdd && selColor && selSize && (
                  <div className="mt-3 text-[12px] text-black/60">
                    Бараа {qty} ширхэг, Хэмжээ: {selSize}. Өнгө: {selColor}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
