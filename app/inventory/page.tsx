'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

import ProductCreateForm, { type Category } from '@/components/inventoryComponents/ProductCreateForm';

import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getStore } from '@/lib/store/storeApi';
import { getProduct } from '@/lib/product/productApi';

// --- Types (UI-д хэрэгтэй талбарууд)
type StoreRow = { id: string; name: string };
type Product = { id: string; name: string; code?: string; storeId?: string };

// --- Жижиг туслах функцууд
const toArray = (v: any, keys: string[] = []) => {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  for (const k of keys) if (Array.isArray(v?.[k])) return v[k];
  const vals = Object.values(v);
  return Array.isArray(vals) ? vals : [];
};

const mapStore = (s: any): StoreRow | null => {
  const id = s?.id ?? s?.store_id ?? s?.storeId;
  if (!id) return null;
  return { id: String(id), name: s?.name ?? s?.store_name ?? 'Салбар' };
};

const mapProduct = (p: any): Product | null => {
  const id = p?.id ?? p?.product_id ?? p?.uuid;
  if (!id) return null;
  return {
    id: String(id),
    name: p?.name ?? p?.product_name ?? p?.title ?? '(нэргүй)',
    code: p?.code ?? p?.sku ?? p?.barcode ?? undefined,
    storeId: p?.storeId ?? p?.store_id ?? p?.store?.id ?? undefined,
  };
};

// --- Энгийн Skeleton
const Skeleton = ({ className = '' }: { className?: string }) =>
  <div className={`animate-pulse bg-neutral-200 ${className}`} />;

export default function InventoryPage() {
  const router = useRouter();

  // UI state
  const [loadingStores, setLoadingStores] = useState(true);
  const [stores, setStores] = useState<StoreRow[]>([{ id: 'all', name: 'Бүгд' }]);
  const [storeId, setStoreId] = useState<string>('all');

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  // ProductCreateForm-toggle
  const [showCreate, setShowCreate] = useState(false);

  // ProductCreateForm props
  const [cats, setCats] = useState<Category[]>([]); // TODO: Хэрэв ангиллын API байвал эндээс тат
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  // 1) Салбаруудыг ачаална
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingStores(true);
        const token = await getAccessToken();
        if (!token) throw new Error('no token');

        // tenantId decode
        try {
          const decoded: any = jwtDecode(token);
          const t = decoded?.app_metadata?.tenants?.[0];
          if (t) setTenantId(String(t));
        } catch { /* noop */ }

        const raw = await getStore(token); // таны getStore → stores массив
        const arr = toArray(raw, ['stores']).map(mapStore).filter(Boolean) as StoreRow[];

        if (!alive) return;
        const withAll = [{ id: 'all', name: 'Бүгд' }, ...arr];
        setStores(withAll);

        // сүүлийн сонголт сэргээх
        const saved = localStorage.getItem('storeId');
        setStoreId(saved && withAll.some(s => s.id === saved) ? saved : 'all');
      } catch (e) {
        console.error(e);
        setStores([{ id: 'all', name: 'Бүгд' }]);
        setStoreId('all');
      } finally {
        if (alive) setLoadingStores(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) Бараануудыг ачаална (сервер талдаа салбараар шүүдэг бол dependency-г [storeId] болго)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const token = await getAccessToken();
        if (!token) throw new Error('no token');

        const raw = await getProduct(token); // танай getProduct → products
        const arr = toArray(raw, ['products', 'data', 'items'])
          .map(mapProduct).filter(Boolean) as Product[];

        if (!alive) return;
        setProducts(arr);
      } catch (e) {
        console.error(e);
        setProducts([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => { alive = false; };
  }, []); // <- хэрэв storeId-р сервер талдаа авах бол [storeId] болгож өөрчил

  // 3) Клиент талын шүүлт
  const visibleProducts = useMemo(
    () => products.filter(p => storeId === 'all' || String(p.storeId) === storeId),
    [products, storeId]
  );

  const handleBack = () => router.back();
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setStoreId(v);
    localStorage.setItem('storeId', v);
  };
  const handleAddProduct = () => {
    if (storeId === 'all') {
      alert('Эхлээд тодорхой салбар сонгоно уу.');
      return;
    }
    setShowCreate(true);
  };

  // ProductCreateForm-д өгөх салбарын нэрс
  const branchNames = useMemo(() => stores.map(s => s.name), [stores]);

  return (
    <div className="min-h-svh bg-[#F7F7F5] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 min-h-svh flex flex-col gap-4">

        {/* ======== TOP BAR: Буцах / Салбар сонгох / + Бараа ======== */}
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 pb-3 bg-[#F7F7F5]/90 backdrop-blur border-b border-neutral-200">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBack}
              className="h-9 px-3 rounded-full border border-neutral-200 bg-white shadow text-xs hover:shadow-md active:scale-[0.99] transition"
            >
              ← Буцах
            </button>

            <div className="relative">
              <label htmlFor="branch" className="sr-only">Салбар сонгох</label>
              {loadingStores ? (
                <Skeleton className="h-9 w-40 rounded-full" />
              ) : (
                <select
                  id="branch"
                  value={storeId}
                  onChange={handleStoreChange}
                  className="h-9 rounded-full bg-[#5AA6FF] text-white text-xs px-3 pr-8 outline-none cursor-pointer appearance-none"
                  aria-label="Салбар сонгох"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                  ))}
                </select>
              )}
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs">▾</span>
            </div>

            <button
              onClick={handleAddProduct}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
            >
              + Бараа
            </button>
          </div>
        </div>

        {/* ======== PRODUCT CREATE FORM ======== */}
        {showCreate && storeId !== 'all' && (
          <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Шинэ бараа нэмэх (Салбар: <b>{stores.find(s => s.id === storeId)?.name}</b>)</div>
              <button
                onClick={() => setShowCreate(false)}
                className="h-8 px-3 rounded-md border border-[#E6E6E6] bg-white text-xs"
              >
                Хаах
              </button>
            </div>
            <ProductCreateForm
              cats={cats}                   // TODO: жинхэнэ category list-ээ эндээс дамжуул
              branches={branchNames}        // ['Бүгд', '1-р салбар', ...]
              tenantId={tenantId}           // inline ангилал нэмэхийг идэвхжүүлнэ
            />
          </div>
        )}

        {/* ======== БАРАА ХАРАХ (ЖАГСААЛТ) ======== */}
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 text-sm font-medium">
            Барааны жагсаалт {loadingProducts ? '…' : `(${visibleProducts.length})`}
          </div>

          <div className="divide-y divide-neutral-100">
            {loadingProducts ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : visibleProducts.length === 0 ? (
              <div className="px-4 py-8 text-sm text-neutral-500">Юу ч алга.</div>
            ) : (
              visibleProducts.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-neutral-500">{p.code ?? '-'}</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
