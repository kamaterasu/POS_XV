'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Item, QuickActions, PaymentRow } from "@/lib/sales/salesTypes";
import { fmt, calcTotals } from "@/lib/sales/salesUtils";
import { createCheckoutOrder } from "@/lib/checkout/checkoutApi";

import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID } from "@/lib/store/storeApi";
import { getProductByStore, getProductById } from "@/lib/product/productApi";
import { getImageShowUrl } from "@/lib/product/productImages";

type ProductRow = {
  id: string;
  name: string;
  imgPath?: string;
  price: number;
  qty: number;
};

// cart талд variantId нэмье
type CartItem = Item & { variantId?: string; size?: string; color?: string };

// ======================================================
// Image URL resolver (signed/public/absolute + cache)
// ======================================================
const imgUrlCache = new Map<string, string>();

async function resolveImageUrl(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;

  // Absolute URL эсвэл data URL
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;

  // Public (app/public) зам
  if (raw.startsWith('/')) return raw;

  // Supabase storage object: зөвхөн файл нэр өгөгдсөн бол product_img/ гэж prefix хийнэ
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

// ======================================================

import CartFooter from "@/components/checkoutComponents/CartFooter";
import AddItemModal from "@/components/checkoutComponents/AddItemModal";
import SaveDraftDialog from "@/components/checkoutComponents/SaveDraftDialog";
import PayDialogMulti from "@/components/checkoutComponents/PayDialogMulti";
import CheckoutHistoryDialog from "@/components/checkoutComponents/CheckoutHistoryDialog";

export default function CheckoutPage() {
  const router = useRouter();

  // cart + quick actions
  const [items, setItems] = useState<CartItem[]>([]);
  const [qa, setQa] = useState<QuickActions>({
    discountPercent: 0,
    deliveryFee: 0,
    includeVAT: false,
  });

  // dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [openSave, setOpenSave] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  // processing
  const [isProcessing, setIsProcessing] = useState(false);

  // store + products
  const [storeId, setStoreId] = useState<string | null>(null);
  const [productList, setProductList] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  // ===== Variant picker state =====
  type VariantOpt = { id: string; price: number; stock: number; size?: string; color?: string; sku?: string };
  const [picker, setPicker] = useState<{ productId: string; name: string; img?: string } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerVars, setPickerVars] = useState<VariantOpt[]>([]);

  // helpers
  const goToDashboard = () => router.push("/dashboard");

  // normalize variants from product detail
  const normalizeVariants = (det: any): VariantOpt[] => {
    const raw = det?.variants ?? det?.product?.variants ?? det?.data?.variants ?? [];
    return (raw as any[]).map((v) => {
      const a = v?.attrs ?? v?.attributes ?? {};
      return {
        id: String(v.id),
        price: Number(v.price ?? 0),
        stock: Number(v.stock ?? v.qty ?? 0),
        size: a.size ?? a.Size ?? a["Хэмжээ"] ?? "",
        color: a.color ?? a.Color ?? a["Өнгө"] ?? "",
        sku: v.sku,
      };
    });
  };

  const openVariantPicker = async (p: ProductRow) => {
    setPicker({ productId: p.id, name: p.name, img: p.imgPath });
    setPickerLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('no token');
      const det = await getProductById(token, p.id);
      const vars = normalizeVariants(det);
      setPickerVars(vars);

      // Хэрвээ ганц variant байвал шууд нэмчихье
      if (vars.length === 1 && vars[0].stock > 0) {
        const v = vars[0];
        setItems((prev) => {
          const i = prev.findIndex((it) => it.variantId === v.id);
          if (i > -1) {
            const copy = [...prev];
            copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
            return copy;
          }
          return [
            {
              id: p.id,
              variantId: v.id,
              name: p.name,
              price: v.price,
              qty: 1,
              imgPath: p.imgPath || "/default.png",
              size: v.size,
              color: v.color,
            },
            ...prev,
          ];
        });
        setPicker(null);
      }
    } finally {
      setPickerLoading(false);
    }
  };

  // totals
  const totalRaw = useMemo(() => items.reduce((s, it) => s + it.qty * it.price, 0), [items]);
  const totals = useMemo(() => calcTotals(items, qa), [items, qa]);

  // 1) storeId resolve
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fromLS = typeof window !== "undefined" ? localStorage.getItem("storeId") : null;
        if (fromLS && fromLS !== "all") {
          if (alive) setStoreId(fromLS);
          return;
        }
        const token = await getAccessToken();
        if (!token) throw new Error("No token");
        const sid = await getStoredID(token);
        if (alive) setStoreId(sid ?? null);
      } catch (e) {
        console.error("Resolve storeId error:", e);
        if (alive) setStoreId(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) тухайн store-ийн inventory + product details join (+ image URL resolve)
  useEffect(() => {
    if (!storeId) return;
    let alive = true;

    (async () => {
      setLoadingProducts(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("No token");

        // inventory
        const invRes: any = await getProductByStore(token, storeId);
        const arr: any[] = Array.isArray(invRes) ? invRes : invRes?.items ?? invRes?.data ?? invRes?.products ?? [];

        // merge qty by product id
        const byId = new Map<string, { qty: number; product?: any }>();
        for (const row of arr) {
          const pid = row?.product?.id ?? row?.product_id ?? row?.id ?? row?.variant_id;
          if (!pid) continue;
          const qty = Number(row?.qty ?? row?.stock ?? 0);
          const prev = byId.get(String(pid));
          byId.set(String(pid), { qty: (prev?.qty ?? 0) + qty, product: row?.product ?? prev?.product });
        }

        // product details
        const ids = Array.from(byId.keys());
        const details = await Promise.all(
          ids.map(async (id) => {
            try {
              const det = await getProductById(token, id);
              return { id, det };
            } catch {
              return { id, det: null as any };
            }
          })
        );

        // build list
        const list: ProductRow[] = details.map(({ id, det }) => {
          const inv = byId.get(id)!;
          const variants = det?.variants ?? det?.product?.variants ?? det?.data?.variants ?? [];
          const price = Number(variants?.[0]?.price ?? 0);
          const name = det?.product?.name ?? det?.name ?? inv?.product?.name ?? "(нэргүй)";
          const img = det?.product?.img ?? det?.img ?? inv?.product?.img ?? inv?.product?.image ?? undefined;
          return { id, name: String(name), imgPath: img, price, qty: inv?.qty ?? 0 };
        });

        // resolve image URLs (signed/public/absolute)
        const withUrls: ProductRow[] = await Promise.all(
          list.map(async (row) => ({
            ...row,
            imgPath: await resolveImageUrl(row.imgPath),
          }))
        );

        // filter
        const q = search.trim().toLowerCase();
        const filtered = q ? withUrls.filter((p) => p.name.toLowerCase().includes(q)) : withUrls;

        if (alive) setProductList(filtered);
      } catch (e) {
        console.error("Load products for checkout failed:", e);
        if (alive) setProductList([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [storeId, search]);

  // 3) төлбөр
  const handleCheckout = async (paymentRows: PaymentRow[], _totalReceived: number, _change: number) => {
    if (items.length === 0) {
      alert("Захиалгад бүтээгдэхүүн нэмнэ үү");
      return;
    }
    // variant шалгалт (хааяа гараар нэмсэн мөр variantIdгүй байж болно)
    const missing = items.filter((i) => !i.variantId);
    if (missing.length) {
      alert("Зарим мөрт variant сонгогдоогүй байна. (size/color)");
      return;
    }

    setIsProcessing(true);
    try {
      const tax = qa.includeVAT ? Math.round(totals.grand * 0.1) : 0;
      const discount = Math.round(totals.discount);

      // checkoutApi дотроо variantId -> variant_id болгож map хийдэг байх ёстой
      const result = await createCheckoutOrder(items as any, paymentRows, { tax, discount });

      if (result) {
        setItems([]);
        setQa({ discountPercent: 0, deliveryFee: 0, includeVAT: false });
        setOpenPay(false);
        alert(`Захиалга амжилттай хадгалагдлаа! Order ID: ${result.order.id.slice(-8)}`);
        router.push(`/receipt?orderId=${result.order.id}`);
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      let msg = "Тодорхойгүй алдаа";
      const t = String(error?.message ?? "");
      if (t.includes("tenant_id")) msg = "Танд байгууллагын эрх байхгүй байна.";
      else if (t.includes("store_id")) msg = "Танд дэлгүүрийн эрх байхгүй байна.";
      else if (t.includes("NOT_AUTHENTICATED")) msg = "Дахин нэвтэрнэ үү.";
      else msg = t;
      alert(`Захиалга үүсгэхэд алдаа гарлаа: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button
          onClick={goToDashboard}
          className="group flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95"
        >
          <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium text-gray-900">Борлуулалт</span>
        </button>

        <div className="px-3 py-1.5 rounded-lg bg-white/80 border border-white/40 shadow-sm text-sm text-gray-700">
          {storeId ? <>Дэлгүүр: <span className="font-semibold">{storeId.slice(0, 8)}…</span></> : "Store ачааллаж байна…"}
        </div>
      </header>

      <main className="flex-1 flex flex-col text-black">
        {/* Search + grid */}
        <section className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Бүтээгдэхүүн хайх..."
              className="flex-1 px-4 py-2 rounded-xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              disabled={!storeId}
            />
            <span className="text-sm text-gray-600">
              {!storeId ? "Store сонгогдоогүй" : loadingProducts ? "Ачааллаж..." : `${productList.length} олдлоо`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(!storeId ? [] : loadingProducts ? Array.from({ length: 8 }) : productList).map((p: any, idx: number) =>
              loadingProducts ? (
                <div key={`s-${idx}`} className="h-28 rounded-2xl bg-white/60 border border-white/40 animate-pulse" />
              ) : (
                <button
                  key={p.id}
                  onClick={() => openVariantPicker(p)}
                  className="group text-left p-3 rounded-2xl bg-white/70 hover:bg-white/90 border border-white/40 shadow-sm hover:shadow-md transition-all duration-200"
                  disabled={(p.qty ?? 0) <= 0}
                  title={(p.qty ?? 0) <= 0 ? "Нөөц дууссан" : "Вариант сонгох"}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={p.imgPath || "/default.png"}
                      alt={p.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-xl object-cover bg-gray-100"
                      unoptimized
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">Үнэ: {fmt(p.price)} • Үлд: {p.qty ?? 0}</div>
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        </section>

        {/* Cart header */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-6 py-3 mb-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm text-sm text-gray-900 font-medium">
          <span>Бүтээгдэхүүн</span>
          <span className="text-right">Ширхэг/Үнэ</span>
        </div>

        {/* Cart list */}
        <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm overflow-y-auto p-4">
          <ul className="space-y-3">
            {items.map((it, idx) => {
              const line = it.qty * it.price;
              return (
                <li key={it.id + "-" + (it as any).variantId + "-" + idx} className="p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <div className="flex items-start gap-2 w-full">
                      <Image src={it.imgPath || "/default.png"} alt={it.name} width={40} height={40} className="w-12 h-12 rounded-xl object-cover bg-gray-100 shadow-sm" unoptimized />
                      <div className="leading-tight flex flex-col">
                        <div className="text-sm font-semibold text-gray-900">
                          {idx + 1}. {it.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          Хэмжээ: {(it as any).size || "—"} • Өнгө: {(it as any).color || "—"}
                        </div>
                        <div className="text-xs text-gray-500">{fmt(it.price)} × {it.qty}</div>
                      </div>
                    </div>

                    <div className="flex flex-col place-content-end gap-2 items-center max-w-full justify-center">
                      <div className="flex justify-center w-20">
                        <div className="inline-flex items-center gap-1 bg-gray-50 rounded-full p-1">
                          <button onClick={() => setItems(arr => arr.map(x => (x === it && it.qty > 1 ? { ...x, qty: x.qty - 1 } : x)))} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 text-sm leading-none flex items-center justify-center transition-colors duration-200">–</button>
                          <span className="min-w-8 text-center text-sm font-medium text-gray-900 px-2">{it.qty}</span>
                          <button onClick={() => setItems(arr => arr.map(x => (x === it ? { ...x, qty: x.qty + 1 } : x)))} className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm leading-none flex items-center justify-center transition-colors duration-200">+</button>
                        </div>
                      </div>
                      <div className="w-24 text-right font-semibold text-gray-900">{fmt(line)}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Totals */}
        <div className="mt-4 bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm p-6 text-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Дүн</span>
            <span className="font-medium text-gray-900">{fmt(totalRaw)}</span>
          </div>
          {!!qa.discountPercent && (
            <div className="flex justify-between items-center text-red-600">
              <span>Хөнгөлөлт ({qa.discountPercent}%)</span>
              <span className="font-medium">- {fmt(totals.discount)}</span>
            </div>
          )}
          {qa.includeVAT && (
            <div className="flex justify-between items-center text-amber-600">
              <span>НӨАТ (10%)</span>
              <span className="font-medium">{fmt(totals.vat)}</span>
            </div>
          )}
          {!!qa.deliveryFee && (
            <div className="flex justify-between items-center text-blue-600">
              <span>Хүргэлт</span>
              <span className="font-medium">{fmt(totals.deliveryFee)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg text-gray-900">Нийт төлөх</span>
              <span className="font-bold text-xl text-blue-600">{fmt(totals.grand)}</span>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <CartFooter
          onQuick={() => setOpenAdd(true)}
          onAdd={() => setOpenAdd(true)}
          onSave={() => setOpenSave(true)}
          onPay={() => setOpenPay(true)}
          onHistory={() => setOpenHistory(true)}
        />
      </footer>

      {/* Add item (гараар) */}
      <AddItemModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(it) =>
          setItems((prev) => {
            const i = prev.findIndex((p) => p.name === it.name && p.price === it.price);
            if (i > -1) {
              const copy = [...prev];
              copy[i] = { ...copy[i], qty: copy[i].qty + it.qty };
              return copy;
            }
            return [it as CartItem, ...prev];
          })
        }
      />

      {/* Save draft */}
      <SaveDraftDialog open={openSave} onClose={() => setOpenSave(false)} items={items} />

      {/* Pay */}
      <PayDialogMulti
        open={openPay}
        onClose={() => !isProcessing && setOpenPay(false)}
        total={totals.grand}
        onPaidMulti={handleCheckout}
        disabled={isProcessing}
      />

      {/* Checkout History */}
      <CheckoutHistoryDialog open={openHistory} onClose={() => setOpenHistory(false)} onSelectOrder={(order) => router.push(`/receipt?orderId=${order.id}`)} />

      {/* ===== Variant Picker Modal ===== */}
      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow">
            <div className="mb-2 font-medium">Вариант сонгох — {picker.name}</div>
            {pickerLoading ? (
              <div className="text-sm text-neutral-500">Ачааллаж байна…</div>
            ) : pickerVars.length === 0 ? (
              <div className="text-sm text-neutral-500">Вариант олдсонгүй.</div>
            ) : (
              <ul className="divide-y">
                {pickerVars.map((v) => (
                  <li key={v.id} className="py-2 flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{v.size || "—"} {v.color ? `• ${v.color}` : ""}</div>
                      <div className="text-xs text-neutral-500">Үнэ: {fmt(v.price)} • Үлд: {v.stock}</div>
                    </div>
                    <button
                      disabled={v.stock <= 0}
                      onClick={() => {
                        setItems((prev) => {
                          const i = prev.findIndex((it) => it.variantId === v.id);
                          if (i > -1) {
                            const copy = [...prev];
                            copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
                            return copy;
                          }
                          return [
                            {
                              id: picker.productId,
                              variantId: v.id,
                              name: picker.name,
                              price: v.price,
                              qty: 1,
                              imgPath: picker.img || "/default.png",
                              size: v.size,
                              color: v.color,
                            } as CartItem,
                            ...prev,
                          ];
                        });
                        setPicker(null);
                      }}
                      className="px-3 py-1.5 text-sm rounded-md bg-black text-white disabled:opacity-40"
                    >
                      Сонгох
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 text-right">
              <button onClick={() => setPicker(null)} className="text-sm text-neutral-600">Хаах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
