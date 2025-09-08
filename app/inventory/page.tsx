'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ProductCreateForm, { type Category } from '@/components/inventoryComponents/ProductCreateForm';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getProductByStore } from '@/lib/product/productApi';
import { getStore } from '@/lib/store/storeApi';
import { getImageShowUrl } from '@/lib/product/productImages';

// ---------- Types ----------
type StoreRow = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  qty?: number;
  code?: string;
  storeId?: string;
  img?: string;     // DB-д хадгалсан утга (ж: "product_img/xxx.png" эсвэл "xxx.png")
  imgUrl?: string;  // Дүгнэсэн харах URL (signed/public/absolute)
};

// ---------- Utils ----------
const toArray = (v: any, keys: string[] = []) => {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  for (const k of keys) if (Array.isArray((v as any)[k])) return (v as any)[k];
  const vals = Object.values(v);
  return Array.isArray(vals) ? vals : [];
};

const mapStore = (s: any): StoreRow | null => {
  const id = s?.id ?? s?.store_id ?? s?.storeId;
  if (!id) return null;
  return { id: String(id), name: s?.name ?? s?.store_name ?? 'Салбар' };
};

// getProductByStore → { product, qty, store_id } | getProduct → шууд product
const mapProduct = (item: any): Product | null => {
  if (item?.product?.id) {
    return {
      id: String(item.product.id),
      name: item.product.name ?? '(нэргүй)',
      qty: item.qty ?? 0,
      storeId: item.store_id ?? undefined,
      img: item.product.img ?? item.product.image ?? undefined,
    };
  }
  const id = item?.id ?? item?.product_id ?? item?.uuid ?? item?.variant_id;
  if (!id) return null;
  return {
    id: String(id),
    name: item?.name ?? item?.product_name ?? item?.title ?? '(нэргүй)',
    code: item?.code ?? item?.sku ?? item?.barcode ?? undefined,
    storeId: item?.storeId ?? item?.store_id ?? item?.store?.id ?? undefined,
    img: item?.img ?? item?.image ?? undefined,
  };
};

// ---------- Image URL resolver (7 хоногийн signed URL, кэштэй) ----------
const imgUrlCache = new Map<string, string>();

async function resolveImageUrl(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;

  // Absolute URL эсвэл data URL бол шууд
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;

  // Public (app/public) зам бол шууд
  if (raw.startsWith('/')) return raw;

  // Supabase storage object замыг таамаглах
  // зөвхөн файл нэр өгөгдсөн бол product_img/ гэж prefix хийнэ
  const path = raw.includes('/') ? raw : `product_img/${raw}`;

  if (imgUrlCache.has(path)) return imgUrlCache.get(path)!;

  try {
    const signed = await getImageShowUrl(path); // 7 хоног хүчинтэй
    imgUrlCache.set(path, signed);
    return signed;
  } catch (e) {
    console.error('Failed to sign image url for', path, e);
    return undefined;
  }
}

// ---------- Tiny UI ----------
const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-neutral-200 ${className}`} />
);

// ---------- Image with fallback (Next/Image) ----------
function SBImage({
  src,
  alt,
  className,
  size = 48,
}: {
  src?: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = failed || !src ? '/default.png' : src;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      // Хэрэв next.config-д remotePatterns нэмээгүй бол дараахыг түр асаагаад optimization-оос гарна:
      unoptimized
      loading="lazy"
    />
  );
}

// ======================================================================

export default function InventoryPage() {
  const router = useRouter();

  // UI state
  const [loadingStores, setLoadingStores] = useState(true);
  const [stores, setStores] = useState<StoreRow[]>([{ id: 'all', name: 'Бүгд' }]);
  const [storeId, setStoreId] = useState<string>('all');

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  // ProductCreateForm state
  const [showCreate, setShowCreate] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [tenantId, setTenantId] = useState<string | undefined>(undefined);

  // 1) Салбарууд
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
      } catch {
        setStores([{ id: 'all', name: 'Бүгд' }]);
      } finally {
        setLoadingStores(false);
      }
    })();
  }, []);

  // 2) Бараа (+ зураг бүрийн signed URL)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const token = await getAccessToken();
        if (!token) throw new Error('no token');

        let arr: Product[] = [];
        if (storeId === 'all') {
          const merged: Product[] = [];
          for (const s of stores) {
            if (s.id === 'all') continue;
            const raw = await getProductByStore(token, s.id);
            const items = toArray(raw, ['items', 'products', 'data'])
              .map(mapProduct)
              .filter(Boolean) as Product[];
            merged.push(...items);
          }
          arr = merged;
        } else {
          const raw = await getProductByStore(token, storeId);
          arr = toArray(raw, ['items', 'products', 'data'])
            .map(mapProduct)
            .filter(Boolean) as Product[];
        }

        // signed URL-уудаа тооцоолж products-д шингээнэ
        const withUrls = await Promise.all(
          arr.map(async (p) => ({
            ...p,
            imgUrl: await resolveImageUrl(p.img),
          }))
        );

        if (!alive) return;
        setProducts(withUrls);
      } catch (e) {
        console.error(e);
        setProducts([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [storeId, stores]);

  const mergedProducts = useMemo(() => {
    if (storeId !== 'all') {
      return products.filter((p) => String(p.storeId) === storeId);
    }
    const map = new Map<string, Product & { qty: number }>();
    for (const p of products) {
      if (!p.id) continue;
      const prev = map.get(p.id);
      map.set(p.id, {
        ...(prev ?? p),
        imgUrl: prev?.imgUrl ?? p.imgUrl,
        qty: (prev?.qty ?? 0) + (p.qty ?? 0),
      });
    }
    return Array.from(map.values());
  }, [products, storeId]);

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

  const branchNames = useMemo(() => stores.map((s) => s.name), [stores]);

  return (
    <div className="min-h-svh bg-[#F7F7F5] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 min-h-svh flex flex-col gap-4">
        {/* Top */}
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 pb-3 bg-[#F7F7F5]/90 backdrop-blur border-b border-neutral-200">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleBack}
              className="h-9 px-3 rounded-full border border-neutral-200 bg-white shadow text-xs hover:shadow-md active:scale-[0.99] transition"
            >
              ← Буцах
            </button>

            <div className="relative">
              <label htmlFor="branch" className="sr-only">
                Салбар сонгох
              </label>
              {loadingStores ? (
                <Skeleton className="h-9 w-40 rounded-full" />
              ) : (
                <select
                  id="branch"
                  value={storeId}
                  onChange={handleStoreChange}
                  className="h-9 rounded-full border border-neutral-200 bg-white px-4 pr-8 text-xs"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs">
                ▾
              </span>
            </div>

            <button
              onClick={handleAddProduct}
              className="h-9 px-3 rounded-full bg-white border border-[#E6E6E6] text-xs shadow-sm"
            >
              + Бараа
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && storeId !== 'all' && (
          <div className="rounded-xl bg-white border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">
                Шинэ бараа нэмэх (Салбар: {stores.find((s) => s.id === storeId)?.name})
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="h-8 px-3 rounded-md border border-[#E6E6E6] bg-white text-xs"
              >
                Хаах
              </button>
            </div>
            <ProductCreateForm cats={cats} branches={branchNames} tenantId={tenantId} />
          </div>
        )}

        {/* List */}
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
              mergedProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                  <SBImage
                    src={p.imgUrl}
                    alt={p.name}
                    size={48}
                    className="w-12 h-12 object-cover rounded border border-neutral-200 bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-neutral-500">{p.code ? `Код: ${p.code}` : ''}</div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {typeof p.qty === 'number' ? (storeId === 'all' ? `Нийт: ${p.qty}` : `Тоо: ${p.qty}`) : ''}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {storeId === 'all' ? '' : stores.find((s) => s.id === p.storeId)?.name || ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
