'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductCreateForm, { Category } from '@/components/inventoryComponents/ProductCreateForm';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getProduct, getProductByStore } from '@/lib/product/productApi';
import { getStore } from '@/lib/store/storeApi';

// --- Types (UI-д хэрэгтэй талбарууд)
type StoreRow = { id: string; name: string };
type Product = { 
  id: string; 
  name: string; 
  qty?: number; 
  code?: string; 
  storeId?: string;
  img?: string; // зураг нэмнэ
};


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

// --- Барааны өгөгдлийг зөв хөрвүүлэх (store inventory API structure)
const mapProduct = (item: any): Product | null => {
  // getProductByStore response: item.product, item.qty, item.store_id
  if (item?.product?.id) {
    return {
      id: String(item.product.id),
      name: item.product.name ?? '(нэргүй)',
      qty: item.qty ?? 0,
      storeId: item.store_id ?? undefined,
      img: item.product.img ?? item.product.image ?? undefined, // зураг
    };
  }
  // getProduct response: шууд product
  const id = item?.id ?? item?.product_id ?? item?.uuid ?? item?.variant_id;
  if (!id) return null;
  return {
    id: String(id),
    name: item?.name ?? item?.product_name ?? item?.title ?? '(нэргүй)',
    code: item?.code ?? item?.sku ?? item?.barcode ?? undefined,
    storeId: item?.storeId ?? item?.store_id ?? item?.store?.id ?? undefined,
    img: item?.img ?? item?.image ?? undefined, // зураг
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
  // visibleProducts-г mergedProducts болгож өөрчилнө
  const mergedProducts = useMemo(() => {
    if (storeId !== 'all') {
      return products.filter(p => String(p.storeId) === storeId);
    }
    // "Бүгд" үед id-аар нэгтгэж, qty-г нийлүүлнэ
    const map = new Map<string, Product & { qty: number }>();
    for (const p of products) {
      if (!p.id) continue;
      const prev = map.get(p.id);
      map.set(p.id, {
        ...p,
        qty: (prev?.qty ?? 0) + (p.qty ?? 0),
      });
    }
    return Array.from(map.values());
  }, [products, storeId]);

  // ProductCreateForm-toggle
  const [showCreate, setShowCreate] = useState(false);

  // ProductCreateForm props
  const [cats, setCats] = useState<Category[]>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  // 1) Салбаруудыг ачаална
  useEffect(() => {
    setLoadingStores(true);
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('no token');
        const raw = await getStore(token);
        const arr = toArray(raw, ['stores', 'data', 'items'])
          .map(mapStore)
          .filter(Boolean) as StoreRow[];
        setStores([{ id: 'all', name: 'Бүгд' }, ...arr]);
      } catch (e) {
        setStores([{ id: 'all', name: 'Бүгд' }]);
      } finally {
        setLoadingStores(false);
      }
    })();
  }, []);

  // 2) Бараануудыг ачаална
// ...existing code...

  // 2) Бараануудыг ачаална
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const token = await getAccessToken();
        if (!token) throw new Error('no token');

        let arr: Product[] = [];
        if (storeId === 'all') {
          // БҮГД үед бүх салбарын барааг нэгтгэж татна
          const allProducts: Product[] = [];
          for (const store of stores) {
            if (store.id === 'all') continue;
            const raw = await getProductByStore(token, store.id);
            const items = toArray(raw, ['items', 'products', 'data'])
              .map(mapProduct)
              .filter(Boolean) as Product[];
            allProducts.push(...items);
          }
          arr = allProducts;
        } else {
          // Тухайн салбарын барааг татна
          const raw = await getProductByStore(token, storeId);
          arr = toArray(raw, ['items', 'products', 'data'])
            .map(mapProduct)
            .filter(Boolean) as Product[];
        }

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
  }, [storeId, stores]);

  // ...mergedProducts useMemo хэвээр...

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
                  className="h-9 rounded-full border border-neutral-200 bg-white px-4 pr-8 text-xs"
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
              <div className="text-sm font-medium">Шинэ бараа нэмэх (Салбар: {stores.find(s => s.id === storeId)?.name})</div>
              <button
                onClick={() => setShowCreate(false)}
                className="h-8 px-3 rounded-md border border-[#E6E6E6] bg-white text-xs"
              >
                Хаах
              </button>
            </div>
            <ProductCreateForm
              cats={cats}
              branches={branchNames}
              tenantId={tenantId}
            />
          </div>
        )}

        {/* ======== БАРАА ХАРАХ (ЖАГСААЛТ) ======== */}
        <div className="rounded-xl bg-white border border-neutral-200 shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 text-sm font-medium">
            Барааны жагсаалт {loadingProducts ? '…' : `(${mergedProducts.length})`}
          </div>

           <div className="divide-y divide-neutral-100">
            {loadingProducts ? (
              <>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </>
            ) : mergedProducts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400">Бараа олдсонгүй.</div>
            ) : (
              mergedProducts.map(p => {
                // Зураг шалгах функц
                let imgSrc = '/default.png';
                if (p.img && typeof p.img === 'string' && /\.(jpe?g|png|gif|webp|svg)$/i.test(p.img)) {
                  imgSrc = p.img.startsWith('/') ? p.img : `/uploads/${p.img}`;
                }
                // Absolute path-тай бол шууд хэрэглэнэ
                if (p.img && typeof p.img === 'string' && (p.img.startsWith('http://') || p.img.startsWith('https://'))) {
                  imgSrc = p.img;
                }
                // public/default.png руу зөв зам
                if (imgSrc === '/default.png') {
                  imgSrc = '/default.png';
                }

                return (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <img
                      src={imgSrc}
                      alt={p.name}
                      className="w-12 h-12 object-cover rounded border border-neutral-200 bg-neutral-100 flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = '/default.png'; }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-neutral-500">{p.code ? `Код: ${p.code}` : ''}</div>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {typeof p.qty === 'number'
                        ? storeId === 'all'
                          ? `Нийт: ${p.qty}`
                          : `Тоо: ${p.qty}`
                        : ''}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {storeId === 'all'
                        ? ''
                        : stores.find(s => s.id === p.storeId)?.name || ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}