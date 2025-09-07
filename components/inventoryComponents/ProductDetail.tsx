'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

export type ProductStockSummary = {
  id: string;
  name: string;
  sku?: string;
  qty?: number;
  price?: number;
  cost?: number;
  category?: string;
  description?: string;
  image?: string;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    cost: number;
    stock: number;
    attrs?: Record<string, string>;
  }>;
  totalStock?: number;
};

type Movement = { ts: string; text: string; delta: number };
type StoreRow = { store: string; qty: number };

type Props = {
  product: ProductStockSummary;
  /** key = variantId → салбар бүрийн нөөц */
  variantStoreQty?: Record<string, StoreRow[]>;
  /** сүүлийн хөдөлгөөний жагсаалт (сонгосон вариантынх) */
  recentMovements?: Movement[];
  onBack?: () => void;
  onEdit?: () => void;
};

export default function ProductDetail({
  product,
  variantStoreQty,
  recentMovements,
  onBack,
  onEdit,
}: Props) {
  // бүх variant-уудаас өнгө/хэмжээний утгуудыг цуглуулна
  const allVariants = product.variants ?? [];

  const allColors = useMemo(() => {
    const s = new Set<string>();
    for (const v of allVariants) {
      const c = (v.attrs?.color || v.attrs?.Color || '').trim();
      if (c) s.add(c);
    }
    return Array.from(s);
  }, [allVariants]);

  const [pickedColor, setPickedColor] = useState<string | null>(allColors[0] ?? null);

  const sizesForColor = useMemo(() => {
    const s = new Set<string>();
    for (const v of allVariants) {
      const c = (v.attrs?.color || v.attrs?.Color || '').trim();
      const size = (v.attrs?.size || v.attrs?.Size || '').trim();
      if (!pickedColor || c === pickedColor) {
        if (size) s.add(size);
      }
    }
    return Array.from(s);
  }, [allVariants, pickedColor]);

  const [pickedSize, setPickedSize] = useState<string | null>(sizesForColor[0] ?? null);

  // сонгогдсон вариант
  const selected = useMemo(() => {
    return allVariants.find(v => {
      const c = (v.attrs?.color || v.attrs?.Color || '').trim();
      const s = (v.attrs?.size || v.attrs?.Size || '').trim();
      const colorOk = pickedColor ? c === pickedColor : true;
      const sizeOk = pickedSize ? s === pickedSize : true;
      return colorOk && sizeOk;
    }) || null;
  }, [allVariants, pickedColor, pickedSize]);

  // тоо оруулах жижиг state (жишээний +/− товч)
  const [qty, setQty] = useState<number>(1);

  return (
    <div className="min-h-dvh bg-[#F7F7F5] text-black p-3 sm:p-4 max-w-md mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="rounded-xl border border-neutral-200 bg-white shadow px-3 py-2 text-sm hover:shadow-md active:scale-[0.99]"
        >
          ← Агуулах
        </button>
        <button
          onClick={onEdit}
          className="rounded-xl border border-neutral-200 bg-white shadow p-2 hover:shadow-md active:scale-[0.99]"
          title="Засах"
        >
          ⚙️
        </button>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-white border border-[#E6E6E6] shadow-sm p-3">
        <div className="flex gap-3">
          <div className="relative h-24 w-24 rounded-md border bg-[#EFEFEF] overflow-hidden">
            <Image
              src="/default.png"
              alt={product.name}
              fill
              sizes="120px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex-1">
            <div className="text-xs text-black/60 mb-1">Агуулах</div>
            <div className="text-base font-semibold">{product.name}</div>
            <div className="text-sm">Нөөц: <b>{product.qty}</b></div>
            <div className="text-sm">
              Үнэ: <b>
                {selected
                  ? formatCurrency(selected.price)
                  : formatCurrency(allVariants[0]?.price ?? 0)}
              </b>
            </div>
          </div>
        </div>
      </div>

      {/* Color picker */}
      {!!allColors.length && (
        <section className="mt-2 rounded-xl bg-white border border-[#E6E6E6] p-3">
          <div className="text-sm mb-2">Өнгө:</div>
          <div className="flex items-center gap-3 flex-wrap">
            {allColors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setPickedColor(c);
                  // өнгө солиход тухайн өнгөнд боломжит эхний хэмжээг сонгоно
                  const firstSize = allVariants
                    .filter(v => (v.attrs?.color || v.attrs?.Color || '').trim() === c)
                    .map(v => (v.attrs?.size || v.attrs?.Size || '').trim())
                    .filter(Boolean)[0] ?? null;
                  setPickedSize(firstSize);
                }}
                className={`h-8 px-3 rounded-full border text-sm flex items-center gap-2 ${pickedColor === c ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
                  }`}
                title={c}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: c }}
                />
                <span>{c}</span>
              </button>
            ))}
            <button
              onClick={() => setPickedColor(null)}
              className={`h-8 px-3 rounded-full border text-sm ${pickedColor === null ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
                }`}
            >
              +
            </button>
          </div>
        </section>
      )}

      {/* Size picker */}
      {!!sizesForColor.length && (
        <section className="mt-2 rounded-xl bg-white border border-[#E6E6E6] p-3">
          <div className="text-sm mb-2">Хэмжээ:</div>
          <div className="flex items-center gap-2 flex-wrap">
            {sizesForColor.map((s) => (
              <button
                key={s}
                onClick={() => setPickedSize(s)}
                className={`h-8 px-3 rounded-full border text-sm ${pickedSize === s ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
                  }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setPickedSize(null)}
              className={`h-8 px-3 rounded-full border text-sm ${pickedSize === null ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
                }`}
            >
              +
            </button>
          </div>
        </section>
      )}

      {/* Selected variant summary */}
      <section className="mt-2 rounded-xl bg-white border border-[#E6E6E6] p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Сонгосон хувилбар:</div>
          <div className="text-xs text-[#5AA6FF]">
            Боломжит: {selected?.qty ?? 0}
          </div>
        </div>
        <div className="mt-2 text-sm">
          {selected ? (
            <>
              <div>
                <b>{(selected.attrs?.color || '')} / {(selected.attrs?.size || '')}</b>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 items-center">
                <span className="text-black/70">SKU:</span>
                <span className="text-right">{selected.sku || '—'}</span>
                <span className="text-black/70">Үнэ:</span>
                <span className="text-right">{formatCurrency(selected.price)}</span>
              </div>
            </>
          ) : (
            <div className="text-black/60">Хувилбараа сонгоно уу.</div>
          )}
        </div>

        {/* Quantity control */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="w-8 h-8 rounded-md border border-[#E6E6E6] bg-white"
          >
            –
          </button>
          <span className="min-w-10 text-center border rounded-md px-2 py-1 bg-[#F2F7FF] border-[#CFE3FF]">
            {qty}
          </span>
          <button
            onClick={() => setQty(qty + 1)}
            className="w-8 h-8 rounded-md border border-[#E6E6E6] bg-white"
          >
            +
          </button>
        </div>
      </section>

      {/* Per-store breakdown (optional) */}
      {selected && variantStoreQty?.[selected.variantId] && (
        <section className="mt-2 rounded-xl bg-white border border-[#E6E6E6] p-3">
          <div className="text-sm font-medium mb-1">Салбарууд:</div>
          <ul className="text-sm">
            {variantStoreQty[selected.variantId]!.map((r) => (
              <li key={r.store} className="flex justify-between py-0.5">
                <span className="text-black/70">{r.store}:</span>
                <span>{r.qty}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent movements (optional) */}
      {recentMovements && recentMovements.length > 0 && (
        <section className="mt-2 rounded-xl bg-white border border-[#E6E6E6] p-3">
          <div className="text-sm font-medium mb-1">
            Сүүлийн болсон хөдөлгөөн{selected ? ` (${selected.attrs?.color || ''} / ${selected.attrs?.size || ''})` : ''}:
          </div>
          <ul className="text-sm divide-y">
            {recentMovements.map((m, i) => (
              <li key={i} className="py-1 flex justify-between">
                <span className="text-black/70">{m.ts}</span>
                <span className={m.delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {m.text} {m.delta >= 0 ? `+${m.delta}` : m.delta}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ------------ helpers ------------ */
function formatCurrency(n: number) {
  try {
    return new Intl.NumberFormat('mn-MN').format(n) + ' ₮';
  } catch {
    return `${n.toLocaleString()} ₮`;
  }
}
