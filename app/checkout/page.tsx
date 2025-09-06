'use client';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { Item, QuickActions } from '@/lib/sales/salesType';
import { listProducts } from '@/lib/product/productApi';
import { fmt, calcTotals } from '@/lib/sales/salesUtils';

import CartFooter from '@/components/checkoutComponents/CartFooter';
import AddItemModal from '@/components/checkoutComponents/AddItemModal';
import QuickActionsSheet from '@/components/checkoutComponents/QuickActionsSheet';
import SaveDraftDialog from '@/components/checkoutComponents/SaveDraftDialog';
import PayDialogMulti from '@/components/checkoutComponents/PayDialogMulti';

/** ===== Favorites types (энд локалд барина) ===== */
type FavVariant = {
  color?: string;
  size?: string;
  price: number;
  stock?: number;
  img?: string;
};

export type FavoriteProduct = {
  id: string;
  name: string;
  category?: string;
  img?: string;
  variants: FavVariant[];
};

/** ===== Эхний төлөв ===== */
const initialItems: Item[] = []; // хоосноос эхлүүлнэ

export default function checkoutPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>(initialItems);
  const [qa, setQa] = useState<QuickActions>({
    discountPercent: 0,
    deliveryFee: 0,
    includeVAT: false,
  });

  // dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [openQuick, setOpenQuick] = useState(false);
  const [openSave, setOpenSave] = useState(false);
  const [openPay, setOpenPay] = useState(false);

  // favorites (түр listProducts-оос үүсгэнэ)
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  /** Favorites-ийг ачаална (амжилтгүй бол хоосон байж болно) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // inventoryApi-ийн одоогийн no-op буцаалттай байсан ч зүгээр — хоосон жагсаалт болно
        const prods = await listProducts({ storeId: 'all' });
        if (cancelled) return;

        const favs: FavoriteProduct[] = (prods ?? []).slice(0, 24).map((p) => ({
          id: p.id,
          name: p.name,
          img: p.imgPath,
          variants: [
            {
              price: p.price,
              stock: p.qty,
              img: p.imgPath,
            },
          ],
        }));
        setFavorites(favs);
      } catch {
        setFavorites([]); // зүгээр л хоосон үлдээнэ
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Товч тооцооллууд */
  const totalRaw = useMemo(() => items.reduce((s, it) => s + it.qty * it.price, 0), [items]);
  const totals = useMemo(() => calcTotals(items, qa), [items, qa]);

  /** Qty өөрчлөлт */
  const inc = (id: string) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, qty: it.qty + 1 } : it)));
  const dec = (id: string) =>
    setItems((arr) => arr.map((it) => (it.id === id && it.qty > 1 ? { ...it, qty: it.qty - 1 } : it)));

  const goToDashboard = () => router.push('/dashboard');

  return (
    <div className="bg-[#F7F7F5] min-h-dvh w-screen p-5 flex flex-col gap-2.5">
      <header>
        <button
          onClick={goToDashboard}
          className="bg-white rounded-md border border-[#E6E6E6] shadow-md h-10 px-10 text-black inline-flex items-center justify-center"
        >
          Борлуулалт
        </button>
      </header>

      <main className="flex-1 flex flex-col text-black">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-5 text-sm text-black font-medium mb-1">
          <span>Бүтээгдэхүүн</span>
          <span className="text-right">Ширхэг/Үнэ</span>
        </div>

        <div className="flex-1 bg-white rounded-md shadow-sm overflow-y-auto p-3">
          <ul className="divide-y divide-[#E6E6E6]">
            {items.map((it, idx) => {
              const line = it.qty * it.price;
              return (
                <li key={it.id} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 items-center">
                  <div className="flex items-start gap-2 w-full">
                    <div className="flex items-start gap-2">
                      <Image
                        src={it.imgPath || '/default.png'}
                        alt={it.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-sm object-cover bg-[#EFEFEF]"
                        onError={(e) => {
                          // Next/Image дээр шууд src солих боломжгүй тул fallback-д анхнаасаа default.png өгсөн
                          console.debug('image load failed for', it.imgPath);
                        }}
                      />
                      <div className="leading-tight flex flex-col">
                        <div className="text-[12px] font-semibold text-black">
                          {idx + 1}. {it.name}
                        </div>
                        <div className="text-[10px] text-black/60">Хэмжээ: {it.size || '—'}</div>
                        <div className="text-[10px] text-black/60">Өнгө: {it.color || '—'}</div>
                        <div className="text-[12px] text-black/40">
                          {fmt(it.price)} × {it.qty}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col place-content-end gap-2 items-center max-w-full justify-center">
                      {/* Qty control */}
                      <div className="flex justify-center w-20">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => dec(it.id)}
                            className="w-6 h-6 rounded bg-[#EDEDED] hover:bg-[#e3e3e3] text-black text-sm leading-none"
                            aria-label="Буурах"
                          >
                            –
                          </button>
                          <span className="min-w-7 text-center text-sm border border-[#CFE3FF] bg-[#F2F7FF] rounded px-2 py-1">
                            {it.qty}
                          </span>
                          <button
                            onClick={() => inc(it.id)}
                            className="w-6 h-6 rounded bg-[#5AA6FF] hover:opacity-90 text-white text-sm leading-none"
                            aria-label="Нэмэгдэх"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="w-24 text-right font-semibold text-black">{fmt(line)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-2 mx-2.5 bg-white rounded-md border p-3 text-sm text-black space-y-1">
          <div className="flex justify-between">
            <span>Дүн</span>
            <span>{fmt(totalRaw)}</span>
          </div>
          {!!qa.discountPercent && (
            <div className="flex justify-between">
              <span>Хөнгөлөлт ({qa.discountPercent}%)</span>
              <span>- {fmt(totals.discount)}</span>
            </div>
          )}
          {qa.includeVAT && (
            <div className="flex justify-between">
              <span>НӨАТ (10%)</span>
              <span>{fmt(totals.vat)}</span>
            </div>
          )}
          {!!qa.deliveryFee && (
            <div className="flex justify-between">
              <span>Хүргэлт</span>
              <span>{fmt(totals.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-base">
            <span>Нийт төлөх</span>
            <span>{fmt(totals.grand)}</span>
          </div>
        </div>
      </main>

      <footer>
        <CartFooter
          onQuick={() => setOpenQuick(true)}
          onAdd={() => setOpenAdd(true)}
          onSave={() => setOpenSave(true)}
          onPay={() => setOpenPay(true)}
        />
      </footer>

      {/* Add item */}
      <AddItemModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(it) =>
          setItems((prev) => {
            const i = prev.findIndex(
              (p) => p.name === it.name && p.price === it.price && p.size === it.size && p.color === it.color
            );
            if (i > -1) {
              const copy = [...prev];
              copy[i] = { ...copy[i], qty: copy[i].qty + it.qty };
              return copy;
            }
            return [it, ...prev];
          })
        }
      />

      {/* Quick actions + favorites */}
      <QuickActionsSheet
        open={openQuick}
        onClose={() => setOpenQuick(false)}
        value={qa}
        onChange={setQa}
        favorites={favorites}
        onPickFavorite={(it) =>
          setItems((prev) => {
            const i = prev.findIndex(
              (p) => p.name === it.name && p.price === it.price && p.size === it.size && p.color === it.color
            );
            if (i > -1) {
              const copy = [...prev];
              copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
              return copy;
            }
            return [it, ...prev];
          })
        }
      />

      {/* Save draft */}
      <SaveDraftDialog open={openSave} onClose={() => setOpenSave(false)} items={items} />

      {/* Pay */}
      <PayDialogMulti
        open={openPay}
        onClose={() => setOpenPay(false)}
        total={totals.grand}
        onPaidMulti={(rows, totalReceived, change) => {
          console.log('PAID', rows, totalReceived, change);
        }}
      />
    </div>
  );
}
