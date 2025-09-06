// app/inventory/detail/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** ----------------------------- TOAST MOCK ----------------------------- */
const toast = {
  message: (m: string) => console.log('[toast]', m),
  success: (m: string) => console.log('[toast:success]', m),
  error: (m: string) => console.error('[toast:error]', m),
};

/** ---------------------------- LOADING MOCK ---------------------------- */
function Loading({ open, label = 'Уншиж байна…', subLabel }: { open: boolean; label?: string; subLabel?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
      <div className="rounded-2xl bg-white shadow-xl border border-neutral-200 px-5 py-4">
        <div className="font-medium">{label}</div>
        {subLabel ? <div className="text-sm text-neutral-600 mt-1">{subLabel}</div> : null}
      </div>
    </div>
  );
}

/** ----------------------------- MOCK “APIs” ---------------------------- */
// Жижиг саатал оруулах helper
async function mockDelay<T>(v: T, ms = 250) { await new Promise(r => setTimeout(r, ms)); return v; }

type StoreRow = { id: string; name: string };
type Category = { id: string; name: string; parentId: string | null };
type ProductRow = { id: string; name: string; code: string; stock: number; price: number; categoryId?: string };

async function listStores(): Promise<StoreRow[]> {
  return mockDelay([
    { id: 's1', name: 'Салбар 1' },
    { id: 's2', name: 'Салбар 2' },
  ]);
}

async function listCategories(): Promise<Category[]> {
  return mockDelay([
    { id: 'c-root-a', name: 'Гутал', parentId: null },
    { id: 'c-root-b', name: 'Цамц', parentId: null },
    { id: 'c-a-1', name: 'Спорт', parentId: 'c-root-a' },
    { id: 'c-b-1', name: 'Hoodie', parentId: 'c-root-b' },
  ]);
}

async function getProduct(_token?: string): Promise<ProductRow[]> {
  // filter-уудыг доорх useEffect дотроо client талаас хийж байна.
  return mockDelay([
    { id: 'p1', name: 'Sneaker Alpha', code: 'SN-ALP', stock: 12, price: 120000, categoryId: 'c-a-1' },
    { id: 'p2', name: 'Sneaker Beta',  code: 'SN-BET', stock:  4, price: 135000, categoryId: 'c-a-1' },
    { id: 'p3', name: 'Hoodie Black',  code: 'HD-BLK', stock: 21, price:  65000, categoryId: 'c-b-1' },
    { id: 'p4', name: 'Hoodie Gray',   code: 'HD-GRY', stock:  7, price:  65000, categoryId: 'c-b-1' },
  ]);
}

async function listIncomingTransfers(_storeId: string) {
  return mockDelay([
    {
      id: 't1',
      from: 'Салбар 1',
      to: 'Салбар 2',
      items: [
        { lineId: 't1-l1', productId: 'p3', name: 'Hoodie Black', expectedQty: 5 },
        { lineId: 't1-l2', productId: 'p4', name: 'Hoodie Gray', expectedQty: 2 },
      ],
    },
  ]);
}

async function apiCountSubmit(_arg: any) { return mockDelay(true, 400); }
async function apiTransferSubmit(_arg: any) { return mockDelay(true, 400); }
async function apiReceiveSubmit(_arg: any) { return mockDelay(true, 400); }
async function apiCategoryCreate({ name }: { tenantId: string; name: string; parentId: string | null }) {
  // Шинэ category id үүсгээд буцаана
  return mockDelay({ id: `cat_${Math.random().toString(36).slice(2, 8)}`, name });
}
async function getTenantId() { return mockDelay('tenant_mock'); }

/** ----------------------- CATEGORY HELPER (mock) ----------------------- */
function buildCategoryHelpers(cats: Category[]) {
  const byId = new Map<string, Category>();
  cats.forEach(c => byId.set(c.id, c));
  function getChildren(parentId: string | null) {
    return cats.filter(c => c.parentId === parentId);
  }
  function getAncestors(id: string | null): { id: string; name: string }[] {
    if (!id) return [];
    const path: { id: string; name: string }[] = [];
    let cur: Category | undefined = byId.get(id);
    while (cur) {
      path.unshift({ id: cur.id, name: cur.name });
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return path;
  }
  function getDescendantIds(id: string) {
    const out: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      out.push(cur);
      getChildren(cur).forEach(child => stack.push(child.id));
    }
    return out;
  }
  return { byId, getChildren, getAncestors, getDescendantIds };
}

/** ----------------------------- UI HELPERS ----------------------------- */
type Mode = 'view' | 'count' | 'transfer' | 'receive' | 'create';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-neutral-200 ${className}`} />;
}

// Sticky дээрх горим солигч – энгийн хувилбар
function ModeSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const modes: Mode[] = ['view', 'count', 'transfer', 'receive', 'create'];
  return (
    <div className="flex gap-1 bg-white border border-neutral-200 rounded-lg p-1">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1 rounded-md text-xs ${mode === m ? 'bg-[#5AA6FF] text-white' : ''}`}
          title={m}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// Жагсаалт харах/тоо оруулах/шилжүүлэхэд ашиглах энгийн жагсаалт
function ProductList({
  mode,
  products,
  countMap,
  setCountMap,
  transferMap,
  setTransferMap,
}: {
  mode: Mode;
  products: { id: string; name: string; code: string; stock: number; price: number }[];
  countMap: Record<string, number>;
  setCountMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  transferMap: Record<string, number>;
  setTransferMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border rounded-md">
          <div className="flex items-start gap-2">
            <div className="h-10 w-10 rounded-md bg-neutral-100" />
            <div className="leading-tight">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-neutral-500">{p.code}</div>
              <div className="text-xs text-neutral-700">Нөөц: {p.stock}</div>
            </div>
          </div>

          {mode === 'view' ? (
            <div className="self-center text-sm font-medium">{p.price.toLocaleString()}₮</div>
          ) : (
            <div />
          )}

          {(mode === 'count' || mode === 'transfer') && (
            <div className="flex items-center gap-2 justify-self-end">
              <button
                onClick={() =>
                  (mode === 'count'
                    ? setCountMap((m) => ({ ...m, [p.id]: Math.max(0, (m[p.id] || 0) - 1) }))
                    : setTransferMap((m) => ({ ...m, [p.id]: Math.max(0, (m[p.id] || 0) - 1) })))
                }
                className="h-7 w-7 rounded-md border"
              >
                -
              </button>
              <input
                type="number"
                value={mode === 'count' ? (countMap[p.id] || 0) : (transferMap[p.id] || 0)}
                onChange={(e) =>
                  (mode === 'count'
                    ? setCountMap((m) => ({ ...m, [p.id]: Math.max(0, Number(e.target.value || 0)) }))
                    : setTransferMap((m) => ({ ...m, [p.id]: Math.max(0, Number(e.target.value || 0)) })))
                }
                className="h-7 w-16 border rounded-md px-2"
              />
              <button
                onClick={() =>
                  (mode === 'count'
                    ? setCountMap((m) => ({ ...m, [p.id]: (m[p.id] || 0) + 1 }))
                    : setTransferMap((m) => ({ ...m, [p.id]: (m[p.id] || 0) + 1 })))
                }
                className="h-7 w-7 rounded-md border"
              >
                +
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Хүлээн авах хэсгийн энгийн загвар
function TransferReceive({
  transfers,
  openTransfers,
  setOpenTransfers,
  receiveChecked,
  setReceiveChecked,
  receiveQty,
  setReceiveQty,
}: any) {
  if (!transfers?.length) return <div className="text-sm text-neutral-600">Ирэх шилжүүлэг алга.</div>;
  return (
    <div className="space-y-2">
      {transfers.map((tr: any) => {
        const opened = !!openTransfers[tr.id];
        return (
          <div key={tr.id} className="border rounded-md">
            <button
              onClick={() => setOpenTransfers((m: any) => ({ ...m, [tr.id]: !opened }))}
              className="w-full text-left px-3 py-2 bg-neutral-50 border-b"
            >
              {tr.from} → {tr.to} • {tr.items.length} мөр
            </button>
            {opened && (
              <div className="p-3 space-y-2">
                {tr.items.map((it: any) => (
                  <label key={it.lineId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!receiveChecked[it.lineId]}
                      onChange={(e) => setReceiveChecked((m: any) => ({ ...m, [it.lineId]: e.target.checked }))}
                    />
                    <span className="flex-1 text-sm">
                      {it.name} • Төлөвлөсөн: {it.expectedQty}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={it.expectedQty}
                      value={receiveQty[it.lineId] ?? it.expectedQty}
                      onChange={(e) =>
                        setReceiveQty((m: any) => ({ ...m, [it.lineId]: Math.max(0, Number(e.target.value || 0)) }))
                      }
                      className="h-8 w-20 border rounded-md px-2"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Бараа үүсгэх формын энгийн mock
function ProductCreateForm({ cats, branches }: { cats: Category[]; branches: string[] }) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [cat, setCat] = useState<string>(cats[0]?.id || '');
  const [branch, setBranch] = useState<string>(branches[0] || '');
  return (
    <form
      className="grid gap-3 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        toast.success(`Mock: "${name}" (${sku}) үнэ ${price || 0} — ${branch} / ${cat}`);
        setName(''); setSku(''); setPrice('');
      }}
    >
      <div className="grid gap-1">
        <label className="text-sm">Нэр</label>
        <input className="h-10 border rounded-md px-3" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">SKU</label>
        <input className="h-10 border rounded-md px-3" value={sku} onChange={e => setSku(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Үнэ</label>
        <input className="h-10 border rounded-md px-3" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required />
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Ангилал</label>
        <select className="h-10 border rounded-md px-3" value={cat} onChange={e => setCat(e.target.value)}>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-sm">Салбар</label>
        <select className="h-10 border rounded-md px-3" value={branch} onChange={e => setBranch(e.target.value)}>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <button className="h-10 rounded-md bg-[#5AA6FF] text-white">Mock хадгалах</button>
    </form>
  );
}

/** ---------------------------- LOCAL HELPERS --------------------------- */
function toProducts(rows: ProductRow[]) { return rows; }

/** ------------------------------ CONSTANTS ----------------------------- */
const K_STORE = 'inv_store';
const K_MODE  = 'inv_mode';
const K_CAT   = 'inv_cat';
const K_Q     = 'inv_q';

/** ========================= MAIN PAGE (MOCKED) ========================= */
export default function InventoryDetailPage() {
  const router = useRouter();

  // DATA
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);

  // SELECTION
  const [storeId, setStoreId] = useState<string>('');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [mode, setMode] = useState<Mode>('view');

  // OPS
  const [countMap, setCountMap] = useState<Record<string, number>>({});
  const [transferMap, setTransferMap] = useState<Record<string, number>>({});
  const [transferToStoreId, setTransferToStoreId] = useState<string>('');
  const [openTransfers, setOpenTransfers] = useState<Record<string, boolean>>({});
  const [receiveChecked, setReceiveChecked] = useState<Record<string, boolean>>({});
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});

  // UX
  const [booting, setBooting] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);

  // CATEGORY HELPERS
  const catHelpers = useMemo(() => buildCategoryHelpers(cats), [cats]);
  const breadcrumb = useMemo(() => catHelpers.getAncestors(activeCatId), [catHelpers, activeCatId]);
  const childCats  = useMemo(() => catHelpers.getChildren(activeCatId),  [catHelpers, activeCatId]);
  const filterCatIds = useMemo(
    () => (activeCatId ? catHelpers.getDescendantIds(activeCatId) : undefined),
    [catHelpers, activeCatId]
  );
  const currentCat = activeCatId ? (catHelpers.byId.get(activeCatId) ?? null) : null;
  const productsForList = useMemo(() => {
    // Client талын filter — search & category
    let rows = toProducts(products);
    if (filterCatIds) rows = rows.filter(r => r.categoryId && filterCatIds.includes(r.categoryId));
    if (debouncedQ) {
      const ql = debouncedQ.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(ql) || r.code.toLowerCase().includes(ql));
    }
    return rows;
  }, [products, filterCatIds, debouncedQ]);

  // RESTORE
  useEffect(() => {
    try {
      const s  = localStorage.getItem(K_STORE);
      const m  = localStorage.getItem(K_MODE) as Mode | null;
      const c  = localStorage.getItem(K_CAT);
      const qq = localStorage.getItem(K_Q);
      if (s)  setStoreId(s);
      if (m)  setMode(m);
      if (c)  setActiveCatId(c === 'null' ? null : c);
      if (qq) setQ(qq);
    } catch {}
  }, []);

  // BOOT
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBooting(true);
        const [s, c, p] = await Promise.all([listStores(), listCategories(), getProduct()]);
        if (cancelled) return;
        setStores(s);
        setCats(c);
        setProducts(p);
        setStoreId((prev) => prev || s[0]?.id || '');
        setTransferToStoreId(s[1]?.id || s[0]?.id || '');
      } catch {
        toast.error('Mock: Салбар/Ангилал/Бараа ачааллахад алдаа гарлаа');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // PERSIST
  useEffect(() => { if (storeId) localStorage.setItem(K_STORE, storeId); }, [storeId]);
  useEffect(() => { localStorage.setItem(K_MODE, mode); }, [mode]);
  useEffect(() => { localStorage.setItem(K_CAT, String(activeCatId)); }, [activeCatId]);
  useEffect(() => { localStorage.setItem(K_Q, q); }, [q]);

  // DEBOUNCE search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  // LOAD PRODUCTS (mock — p already loaded; re-filter only)
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingProducts(true);
        const rows = await getProduct(); // real API-д token, filters г.м дамжуулна
        if (!cancelled) setProducts(rows);
      } catch {
        toast.error('Mock: Бүтээгдэхүүн ачааллахад алдаа гарлаа');
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, filterCatIds, debouncedQ]);

  // LOAD INCOMING (receive)
  useEffect(() => {
    if (mode !== 'receive' || !storeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingIncoming(true);
        const rows = await listIncomingTransfers(storeId);
        if (!cancelled) setIncoming(rows);
      } catch {
        toast.error('Mock: Шилжүүлэг ачааллахад алдаа гарлаа');
      } finally {
        if (!cancelled) setLoadingIncoming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, storeId]);

  // SHORTCUTS
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (k === 'v') setMode('view');
      if (k === 'c') setMode('count');
      if (k === 't') setMode('transfer');
      if (k === 'r') setMode('receive');
      if (k === 'n') setMode('create');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // GUARD: 'all' үед зөвхөн 'view'
  useEffect(() => {
    if (storeId === 'all' && mode !== 'view') {
      setMode('view');
      toast.message('“Бүгд” үед харах горим л идэвхтэй.');
    }
  }, [storeId, mode]);

  // TOTALS
  const totalCounted = useMemo(
    () => Object.values(countMap).reduce((a, b) => a + (b || 0), 0),
    [countMap]
  );
  const totalTransferQty = useMemo(
    () => Object.values(transferMap).reduce((a, b) => a + (b || 0), 0),
    [transferMap]
  );
  const receiveTotals = useMemo(() => {
    let lines = 0, qty = 0;
    for (const tr of incoming) {
      for (const it of tr.items) {
        if (receiveChecked[it.lineId]) {
          const v = Math.min(it.expectedQty, Math.max(0, Number(receiveQty[it.lineId] ?? it.expectedQty)));
          if (v > 0) { lines += 1; qty += v; }
        }
      }
    }
    return { lines, qty };
  }, [incoming, receiveChecked, receiveQty]);

  // ACTIONS
  function openCategoryDialog() { setCatDialogOpen(true); }

  async function handleSubmit() {
    if (!storeId || storeId === 'all') {
      toast.error('Нэг салбар сонгоно уу.');
      return;
    }
    try {
      setBusy(true);

      if (mode === 'count') {
        const items = Object.entries(countMap)
          .map(([id, counted]) => ({ id, counted: Number(counted || 0) }))
          .filter((x) => x.counted > 0);
        if (!items.length) { toast.message('Тоолох бараа оруулна уу'); return; }
        await apiCountSubmit({ storeId, items });
        setCountMap({});
        toast.success('Mock: Тооллого илгээгдлээ');
      }

      if (mode === 'transfer') {
        const items = Object.entries(transferMap)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({ id, qty: Number(qty) }));
        if (!items.length) { toast.message('Шилжүүлэх бараа сонгоно уу'); return; }
        if (!transferToStoreId || transferToStoreId === storeId) { toast.error('Өөр салбар сонгоно уу'); return; }
        await apiTransferSubmit({ fromStoreId: storeId, toStoreId: transferToStoreId, items });
        setTransferMap({});
        toast.success('Mock: Шилжүүлэг үүсгэгдлээ');
      }

      if (mode === 'receive') {
        const receipts = incoming
          .map((tr: any) => {
            const lines = tr.items
              .filter((it: any) => receiveChecked[it.lineId])
              .map((it: any) => ({
                lineId: it.lineId,
                productId: it.productId,
                qty: Math.min(it.expectedQty, Math.max(0, Number(receiveQty[it.lineId] ?? it.expectedQty))),
              }))
              .filter((x: any) => x.qty > 0);
            return { transferId: tr.id, lines };
          })
          .filter((r: any) => r.lines.length > 0);
        if (!receipts.length) { toast.message('Бүртгэх мөр сонгоно уу'); return; }
        await apiReceiveSubmit({ storeId, receipts });
        setReceiveChecked({}); setReceiveQty({}); setOpenTransfers({});
        const rows = await listIncomingTransfers(storeId);
        setIncoming(rows);
        toast.success('Mock: Хүлээн авалт бүртгэгдлээ');
      }
    } catch {
      toast.error('Mock: Үйлдэл амжилтгүй боллоо');
    } finally {
      setBusy(false);
    }
  }

  const goToDashboard = () => router.back();

  /** ------------------------------- UI ------------------------------- */
  return (
    <div className="min-h-svh bg-[#F7F7F5] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 min-h-svh flex flex-col gap-3">

        {/* Sticky toolbar */}
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 pb-3 bg-[#F7F7F5]/90 backdrop-blur border-b border-neutral-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={goToDashboard}
                className="rounded-xl border border-neutral-200 bg-white shadow px-3 py-2 text-xs sm:text-sm hover:shadow-md active:scale-[0.99] transition"
              >
                ← Дашбоард
              </button>

              {/* Branch selector */}
              <div className="relative">
                <label htmlFor="branch" className="sr-only">Салбар сонгох</label>
                {booting ? (
                  <Skeleton className="h-8 w-36 rounded-full" />
                ) : (
                  <select
                    id="branch"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="h-9 rounded-full bg-[#5AA6FF] text-white text-xs px-3 pr-8 outline-none cursor-pointer appearance-none"
                    aria-label="Салбар сонгох"
                  >
                    <option value="all" className="text-black">Бүгд</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                    ))}
                  </select>
                )}
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs">▾</span>
              </div>
            </div>

            {/* Mode + Create category */}
            <div className="flex items-center gap-2">
              <ModeSwitcher
                mode={mode}
                setMode={(m) => {
                  if (storeId === 'all' && m !== 'view') {
                    toast.message('“Бүгд” үед зөвхөн харах боломжтой');
                    return;
                  }
                  setMode(m);
                }}
              />
              <button
                onClick={openCategoryDialog}
                className="h-9 px-3 rounded-md bg-white border border-[#E6E6E6] shadow-sm text-xs"
                title="A/B/C хэлбэрээр олон түвшнээр үүсгэж болно"
              >
                + Ангилал
              </button>
            </div>
          </div>

          {/* Search row */}
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={searchRef}
                placeholder="Хайх: Нэр, Код  ( / )"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-white rounded-xl border border-[#E6E6E6] shadow-md h-10 w-full pl-4 pr-10"
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-black/60 hover:text-black"
                  title="Цэвэрлэх"
                >
                  ✕
                </button>
              )}
              {q !== debouncedQ && (
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[11px] text-black/40">…</span>
              )}
            </div>

            <button
              onClick={() => setMode('create')}
              className="h-10 px-3 rounded-lg bg-white border border-[#E6E6E6] shadow-sm text-sm"
              title="Шинэ бараа үүсгэх"
            >
              + Бараа
            </button>
          </div>

          {/* Category rail */}
          <CategoryRail
            breadcrumb={breadcrumb}
            currentCat={currentCat ? { id: currentCat.id, name: currentCat.name } : null}
            childCats={childCats}
            activeCatId={activeCatId}
            onRoot={() => setActiveCatId(null)}
            onPick={(id) => setActiveCatId(id)}
            booting={booting}
          />
        </div>

        {/* Column headers */}
        {mode !== 'receive' && mode !== 'create' && (
          <div className="px-1 sm:px-5 text-sm font-medium flex justify-between">
            <span>Бүтээгдэхүүн {(!loadingProducts && productsForList.length) ? `(${productsForList.length})` : ''}</span>
            <span>{mode === 'view' ? 'Нөөц' : mode === 'count' ? 'Тоо' : mode === 'transfer' ? 'Шилж.тоо' : ''}</span>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 bg-white rounded-md shadow-sm overflow-y-auto p-3">
          {mode === 'receive' && (
            loadingIncoming || booting ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <TransferReceive
                transfers={incoming}
                openTransfers={openTransfers}
                setOpenTransfers={setOpenTransfers}
                receiveChecked={receiveChecked}
                setReceiveChecked={setReceiveChecked}
                receiveQty={receiveQty}
                setReceiveQty={setReceiveQty}
              />
            )
          )}

          {mode !== 'receive' && mode !== 'create' && (
            loadingProducts || booting ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2">
                    <div className="flex items-start gap-2">
                      <Skeleton className="h-10 w-10" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2 w-1/2" />
                        <Skeleton className="h-2 w-1/3" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20 justify-self-end" />
                    <Skeleton className="h-6 w-24 justify-self-end" />
                  </div>
                ))}
              </div>
            ) : productsForList.length === 0 ? (
              <div className="text-center py-16 text-sm text-black/60">
                Илэрц олдсонгүй. Шүүлтээ өөрчилж үзнэ үү, эсвэл
                <button onClick={() => setMode('create')} className="ml-2 underline underline-offset-4">
                  шинэ бараа нэмэх
                </button>
              </div>
            ) : (
              <ProductList
                mode={mode}
                products={productsForList}
                countMap={countMap}
                setCountMap={setCountMap}
                transferMap={transferMap}
                setTransferMap={setTransferMap}
              />
            )
          )}

          {mode === 'create' && (
            <ProductCreateForm cats={cats} branches={stores.map((s) => s.name)} />
          )}
        </div>

        {/* ACTION BARS */}
        {mode === 'count' && (
          <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex items-center justify-between sticky bottom-2 sm:bottom-3">
            <span className="text-sm text-[#333]">Нийт тоолсон: <b>{totalCounted}</b></span>
            <button
              onClick={handleSubmit}
              className="h-11 px-5 rounded-lg bg-[#5AA6FF] text-white disabled:opacity-50"
              disabled={totalCounted === 0 || !storeId || storeId === 'all'}
            >
              Тооллого илгээх
            </button>
          </div>
        )}

        {mode === 'transfer' && (
          <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex flex-col gap-3 sticky bottom-2 sm:bottom-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Очих салбар:</span>
              <select
                value={transferToStoreId}
                onChange={(e) => setTransferToStoreId(e.target.value)}
                className="h-11 rounded-md bg-white border border-[#E6E6E6] px-3"
              >
                {stores.filter((s) => s.id !== storeId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="sm:ml-auto text-sm">Нийт шилжүүлэх тоо: <b>{totalTransferQty}</b></div>
            </div>
            <button
              onClick={handleSubmit}
              className="h-11 rounded-lg bg-[#5AA6FF] text-white disabled:opacity-50"
              disabled={totalTransferQty === 0 || !transferToStoreId || transferToStoreId === storeId || !storeId || storeId === 'all'}
            >
              Шилжүүлэг үүсгэх
            </button>
          </div>
        )}

        {mode === 'receive' && (
          <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex items-center justify-between sticky bottom-2 sm:bottom-3">
            <div className="text-sm">Сонгосон мөр: <b>{receiveTotals.lines}</b> • Нийт бүртгэх тоо: <b>{receiveTotals.qty}</b></div>
            <button
              onClick={handleSubmit}
              className="h-11 px-5 rounded-lg bg-[#5AA6FF] text-white disabled:opacity-50"
              disabled={receiveTotals.lines === 0 || !storeId || storeId === 'all'}
            >
              Шилжүүлгийг бүртгэх
            </button>
          </div>
        )}
      </div>

      {/* Category add dialog */}
      {catDialogOpen && (
        <CategoryCreateDialog
          open={catDialogOpen}
          onClose={() => setCatDialogOpen(false)}
          parentId={activeCatId}
          parentPath={catHelpers.getAncestors(activeCatId).map(c => c.name).join(' › ') || 'Үндэс'}
          onCreated={async (newCatId) => {
            const c = await listCategories();
            setCats(c);
            setActiveCatId(newCatId ?? activeCatId ?? null);
            toast.success('Ангилал нэмэгдлээ (mock)');
          }}
        />
      )}

      {/* Global overlays */}
      <Loading open={busy} label="Ажлыг гүйцэтгэж байна…" subLabel="Түр хүлээнэ үү" />
      <Loading open={booting} label="Өгөгдөл бэлдэж байна…" />
    </div>
  );
}

/** ------------------------- CATEGORY RAIL / DIALOG ------------------------- */
function CategoryRail({
  breadcrumb,
  currentCat,
  childCats,
  activeCatId,
  onRoot,
  onPick,
  booting,
}: {
  breadcrumb: { id: string; name: string }[];
  currentCat: { id: string; name: string } | null;
  childCats: { id: string; name: string }[];
  activeCatId: string | null;
  onRoot: () => void;
  onPick: (id: string) => void;
  booting: boolean;
}) {
  const seen = new Set<string>();
  const cleanBreadcrumb = breadcrumb.filter((c) => {
    if (!c?.id) return false;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return (
    <div className="mt-2">
      <div className="overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none]">
        <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
        <div className="inline-flex items-center gap-2 px-1 py-1 snap-x">
          <button
            onClick={onRoot}
            className={`snap-start rounded-full h-8 px-3 text-sm border shadow-sm shrink-0 transition ${
              activeCatId === null ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
            }`}
            title="Бүх ангилал"
          >
            Бүгд
          </button>

          {cleanBreadcrumb.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`snap-start rounded-full h-8 px-3 text-sm border shadow-sm shrink-0 transition ${
                c.id === activeCatId ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
              }`}
              title={c.name}
            >
              {c.name}
            </button>
          ))}

          {currentCat && !cleanBreadcrumb.some((c) => c.id === currentCat.id) && (
            <button
              onClick={() => onPick(currentCat.id)}
              className="snap-start rounded-full h-8 px-3 text-sm border shadow-sm shrink-0 bg-[#5AA6FF] text-white border-[#5AA6FF]"
              title={currentCat.name}
            >
              {currentCat.name}
            </button>
          )}

          {booting ? (
            <>
              <span className="inline-block h-8 w-20 rounded-full bg-neutral-200 animate-pulse" />
              <span className="inline-block h-8 w-24 rounded-full bg-neutral-200 animate-pulse" />
            </>
          ) : childCats.length ? (
            childCats.map((c) => (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className={`snap-start rounded-full h-8 px-3 text-sm border shadow-sm shrink-0 transition ${
                  c.id === activeCatId ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white'
                }`}
                title={c.name}
              >
                {c.name}
              </button>
            ))
          ) : (
            <span className="text-xs text-[#666] px-3">Дэд ангилал алга.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryCreateDialog({
  open,
  onClose,
  parentId,
  parentPath,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  parentId: string | null;
  parentPath: string;
  onCreated: (newCatId?: string) => void;
}) {
  const [mode, setMode] = useState<'single' | 'path'>('single');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    try {
      const tenantId = await getTenantId();
      if (!tenantId) throw new Error('TENANT_ID_MISSING');

      setSaving(true);
      if (mode === 'single') {
        const created = await apiCategoryCreate({ tenantId, name: name.trim(), parentId });
        onCreated(created.id);
      } else {
        const segs = path.split('/').map((s) => s.trim()).filter(Boolean);
        if (!segs.length) { toast.message('Замыг зөв оруулна уу (A/B/C)'); setSaving(false); return; }
        let parent = parentId ?? null;
        let lastId: string | undefined;
        for (const seg of segs) {
          const created = await apiCategoryCreate({ tenantId, name: seg, parentId: parent });
          parent = created.id;
          lastId = created.id;
        }
        onCreated(lastId);
      }

      setName('');
      setPath('');
      onClose();
      toast.success('Mock: Ангилал нэмэгдлээ');
    } catch (e: any) {
      toast.error(e?.message || 'Mock: Ангилал нэмэхэд алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-[min(96vw,520px)] rounded-2xl border border-[#E6E6E6] bg-white shadow-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold">Ангилал нэмэх</h3>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md border border-[#E6E6E6] bg-white">✕</button>
        </div>

        <div className="text-xs text-[#666] mb-3">
          Эцэг ангилал: <b>{parentPath}</b>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMode('single')}
            className={`h-9 px-3 rounded-md border text-sm ${mode==='single' ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white border-[#E6E6E6]'}`}
          >
            Нэг түвшин
          </button>
          <button
            onClick={() => setMode('path')}
            className={`h-9 px-3 rounded-md border text-sm ${mode==='path' ? 'bg-[#5AA6FF] text-white border-[#5AA6FF]' : 'bg-white border-[#E6E6E6]'}`}
          >
            Зам (A/B/C)
          </button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Нэр</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
              placeholder="Ж: Гутал"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium">Зам</label>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
              placeholder="Ж: Эрэгтэй / Гутал / Богино"
            />
            <div className="text-xs text-[#777]">Замын сегментүүдийг “/” тэмдэгтээр тусгаарлана.</div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-[#E6E6E6] bg-white">Болих</button>
          <button
            onClick={submit}
            disabled={saving || (mode==='single' ? !name.trim() : !path.trim())}
            className="h-10 px-5 rounded-lg bg-[#5AA6FF] text-white disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна…' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </div>
  );
}
