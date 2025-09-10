// app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Item, QuickActions, PaymentRow } from "@/lib/sales/salesTypes";
import { fmt, calcTotals } from "@/lib/sales/salesUtils";
import {
  createCheckoutOrder,
  type PaymentInput,
  normalizeMethod,
} from "@/lib/checkout/checkoutApi";

import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getStoredID } from "@/lib/store/storeApi";
import { getProductByStore, getProductById } from "@/lib/product/productApi";
import { getImageShowUrl } from "@/lib/product/productImages";

import CartFooter from "@/components/checkoutComponents/CartFooter";
import AddItemModal from "@/components/checkoutComponents/AddItemModal";
import SaveDraftDialog from "@/components/checkoutComponents/SaveDraftDialog";
import PayDialogMulti from "@/components/checkoutComponents/PayDialogMulti";
import CheckoutHistoryDialog from "@/components/checkoutComponents/CheckoutHistoryDialog";

// ---------- Types ----------
type ProductRow = {
  id: string;
  name: string;
  imgPath?: string;
  price: number;
  qty: number;
};

type CartItem = Item & { size?: string; color?: string };

type VariantOpt = {
  id: string;
  price: number;
  stock: number;
  size?: string;
  color?: string;
  colorHex?: string;
  sku?: string;
};

// ---------- Image URL resolver ----------
const imgUrlCache = new Map<string, string>();
async function resolveImageUrl(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  const path = raw.includes("/") ? raw : `product_img/${raw}`;
  if (imgUrlCache.has(path)) return imgUrlCache.get(path)!;
  try {
    const signed = await getImageShowUrl(path);
    imgUrlCache.set(path, signed);
    return signed;
  } catch (e) {
    console.error("Failed to sign image url for", path, e);
    return undefined;
  }
}

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
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);

  // processing
  const [isProcessing, setIsProcessing] = useState(false);

  // store + products
  const [storeId, setStoreId] = useState<string | null>(null);
  const [productList, setProductList] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  // Variant picker
  const [picker, setPicker] = useState<{
    productId: string;
    name: string;
    img?: string;
  } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerVars, setPickerVars] = useState<VariantOpt[]>([]);
  const [selColor, setSelColor] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);

  const goToDashboard = () => router.push("/dashboard");
  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const colorLabel = (c?: string) => {
    const v = (c ?? "").toLowerCase();
    if (v === "#000000" || v === "black") return "Хар";
    if (v === "#ffffff" || v === "white") return "Цагаан";
    if (v === "#1a5fb4") return "Цэнхэр";
    if (v === "#26a269") return "Ногоон";
    return c ?? "—";
  };
  const colorKeyOf = (v: VariantOpt) => v.colorHex ?? v.color ?? "—";

  const normalizeVariants = (det: any): VariantOpt[] => {
    const raw = (det?.variants ??
      det?.product?.variants ??
      det?.data?.variants ??
      []) as any[];
    return raw.map((v) => {
      const a = v?.attrs ?? {};
      const [maybeColorFromName, maybeSizeFromName] = String(v?.name ?? "")
        .split("/")
        .map((s: string) => s.trim());
      const colorHex =
        typeof a.color === "string" && a.color.startsWith("#")
          ? a.color
          : undefined;
      return {
        id: String(v.id),
        price: Number(v.price ?? 0),
        stock: Number(v.qty ?? v.stock ?? 0),
        size: a.size ?? a.Size ?? a["Хэмжээ"] ?? maybeSizeFromName ?? "",
        color:
          a.colorName ?? a.ColorName ?? a["Өнгө"] ?? maybeColorFromName ?? "",
        colorHex,
        sku: v.sku,
      } as VariantOpt;
    });
  };

  const openVariantPicker = async (p: ProductRow) => {
    setPicker({ productId: p.id, name: p.name, img: p.imgPath });
    setPickerLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("no token");
      const det = await getProductById(token, p.id, {
        withStock: true,
        storeId: storeId ?? undefined,
      });
      const vars = normalizeVariants(det);
      setPickerVars(vars);

      const first = vars.find((v) => v.stock > 0) ?? vars[0];
      if (first) {
        setSelColor(colorKeyOf(first));
        setSelSize(first.size ?? null);
      }

      if (vars.length === 1 && vars[0].stock > 0) {
        const v = vars[0];
        setItems((prev) => {
          const i = prev.findIndex((it) => it.variant_id === v.id);
          if (i > -1) {
            const copy = [...prev];
            copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
            return copy;
          }
          return [
            {
              id: p.id,
              variant_id: v.id,
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
  const totalRaw = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.price, 0),
    [items]
  );
  const totals = useMemo(() => calcTotals(items, qa), [items, qa]);

  // 1) storeId resolve
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fromLS =
          typeof window !== "undefined"
            ? localStorage.getItem("storeId")
            : null;
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

  // 2) тухайн store-ийн inventory + product details
  useEffect(() => {
    if (!storeId) return;
    let alive = true;

    (async () => {
      setLoadingProducts(true);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("No token");

        const invRes: any = await getProductByStore(token, storeId);
        const arr: any[] = Array.isArray(invRes)
          ? invRes
          : invRes?.items ?? invRes?.data ?? invRes?.products ?? [];

        const byId = new Map<string, { qty: number; product?: any }>();
        for (const row of arr) {
          const pid = row?.product?.id ?? row?.product_id ?? row?.id;
          if (!pid) continue;
          const qty = Number(row?.qty ?? row?.stock ?? 0);
          const prev = byId.get(String(pid));
          byId.set(String(pid), {
            qty: (prev?.qty ?? 0) + qty,
            product: row?.product ?? prev?.product,
          });
        }

        const ids = Array.from(byId.keys());
        const details = await Promise.all(
          ids.map(async (id) => {
            try {
              const det = await getProductById(token, id, {
                withStock: true,
                storeId,
              });
              return { id, det };
            } catch {
              return { id, det: null as any };
            }
          })
        );

        const list: ProductRow[] = details.map(({ id, det }) => {
          const inv = byId.get(id)!;
          const variants =
            det?.variants ??
            det?.product?.variants ??
            det?.data?.variants ??
            [];
          const price = variants.length
            ? Math.min(...variants.map((v: any) => Number(v?.price ?? 0)))
            : 0;
          const name =
            det?.product?.name ?? det?.name ?? inv?.product?.name ?? "(нэргүй)";
          const img =
            det?.product?.img ??
            det?.img ??
            inv?.product?.img ??
            inv?.product?.image ??
            undefined;
          return {
            id,
            name: String(name),
            imgPath: img,
            price,
            qty: inv?.qty ?? 0,
          };
        });

        const withUrls: ProductRow[] = await Promise.all(
          list.map(async (row) => ({
            ...row,
            imgPath: await resolveImageUrl(row.imgPath),
          }))
        );

        const q = search.trim().toLowerCase();
        const filtered = q
          ? withUrls.filter((p) => p.name.toLowerCase().includes(q))
          : withUrls;

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
  const handleCheckout = async (
    paymentRows: PaymentRow[],
    _totalReceived: number,
    _change: number
  ) => {
    if (items.length === 0) return alert("Захиалгад бүтээгдэхүүн нэмнэ үү");
    const missing = items.filter((i) => !i.variant_id);
    if (missing.length) {
      console.error("Items missing variant_id:", missing);
      return alert("Зарим мөрт variant сонгогдоогүй байна. (size/color)");
    }
    if (!storeId) return alert("Store сонгогдоогүй байна");

    setIsProcessing(true);
    try {
      const tax = qa.includeVAT ? Math.round(totals.grand * 0.1) : 0;
      const discount = Math.round(totals.discount);

      const payments: PaymentInput[] = paymentRows.map((r) => ({
        method: normalizeMethod(r.method), // <-- жижиг/том үсгийг засна
        amount: Math.round(r.amount),
        ref: (r as any).ref,
      }));

      const result = await createCheckoutOrder(
        items.map((it) => ({
          variantId: it.variant_id!,
          qty: it.qty,
          price: it.price,
        })),
        payments,
        { tax, discount },
        storeId
      );
      console.log(
        "creata order",
        items.map((it) => ({
          variantId: it.variant_id!,
          qty: it.qty,
          price: it.price,
        })),
        payments,
        { tax, discount },
        storeId
      );
      setItems([]);
      setQa({ discountPercent: 0, deliveryFee: 0, includeVAT: false });
      setOpenPay(false);
      alert(
        `Захиалга амжилттай! Order: ${String(result?.order?.id || "").slice(
          -8
        )}`
      );
      if (result?.order?.id) router.push(`/receipt?orderId=${result.order.id}`);
    } catch (error: any) {
      console.error("Checkout error:", error);
      const t = String(error?.message ?? "");
      let msg = "Тодорхойгүй алдаа";
      if (t.includes("tenant_id")) msg = "Танд байгууллагын эрх байхгүй байна.";
      else if (t.includes("store_id")) msg = "Дэлгүүрийн эрх байхгүй.";
      else if (t.includes("NOT_AUTHENTICATED")) msg = "Дахин нэвтэрнэ үү.";
      else msg = t;
      alert(`Захиалга үүсгэхэд алдаа: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const printPayload = { items, total: totals.grand };

  function handlePrintClick() {
    setShowPrintConfirm(true);
  }

  function confirmPrint() {
    setShowPrintConfirm(false);
    // ...print logic here (call print function)...
  }

  // ============================= UI =============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button
          onClick={goToDashboard}
          className="group flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm border border-white/40 shadow-sm rounded-xl hover:shadow-md hover:bg-white/90 transition-all duration-200 active:scale-95"
        >
          <svg
            className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="font-medium text-gray-900">Борлуулалт</span>
        </button>

        <div className="px-3 py-1.5 rounded-lg bg-white/80 border border-white/40 shadow-sm text-sm text-gray-700">
          {storeId ? (
            <>
              Дэлгүүр:{" "}
              <span className="font-semibold">{storeId.slice(0, 8)}…</span>
            </>
          ) : (
            "Store ачааллаж байна…"
          )}
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
              {!storeId
                ? "Store сонгогдоогүй"
                : loadingProducts
                ? "Ачааллаж..."
                : `${productList.length} олдлоо`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(!storeId
              ? []
              : loadingProducts
              ? Array.from({ length: 8 })
              : productList
            ).map((p: any, idx: number) =>
              loadingProducts ? (
                <div
                  key={`s-${idx}`}
                  className="h-28 rounded-2xl bg-white/60 border border-white/40 animate-pulse"
                />
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
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Үнэ: {fmt(p.price)} • Үлд: {p.qty ?? 0}
                      </div>
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
                <li
                  key={it.id + "-" + (it as any).variant_id + "-" + idx}
                  className="p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200"
                >
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <div className="flex items-start gap-2 w-full">
                      <Image
                        src={it.imgPath || "/default.png"}
                        alt={it.name}
                        width={40}
                        height={40}
                        className="w-12 h-12 rounded-xl object-cover bg-gray-100 shadow-sm"
                        unoptimized
                      />
                      <div className="leading-tight flex flex-col">
                        <div className="text-sm font-semibold text-gray-900">
                          {idx + 1}. {it.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          Хэмжээ: {(it as any).size || "—"} • Өнгө:{" "}
                          {(it as any).color || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {fmt(it.price)} × {it.qty}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col place-content-end gap-2 items-center max-w-full justify-center">
                      <div className="flex justify-center w-20">
                        <div className="inline-flex items-center gap-1 bg-gray-50 rounded-full p-1">
                          <button
                            onClick={() =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x === it && it.qty > 1
                                    ? { ...x, qty: x.qty - 1 }
                                    : x
                                )
                              )
                            }
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 text-sm leading-none flex items-center justify-center transition-colors duration-200"
                          >
                            –
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-gray-900 px-2">
                            {it.qty}
                          </span>
                          <button
                            onClick={() =>
                              setItems((arr) =>
                                arr.map((x) =>
                                  x === it
                                    ? {
                                        ...x,
                                        qty: Math.min(
                                          x.qty + 1,
                                          (() => {
                                            const prod = productList.find(
                                              (p) => p.id === x.id
                                            );
                                            return prod ? prod.qty : 9999;
                                          })()
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                            className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm leading-none flex items-center justify-center transition-colors duration-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="w-24 text-right font-semibold text-gray-900">
                        {fmt(line)}
                      </div>
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
              <span className="font-semibold text-lg text-gray-900">
                Нийт төлөх
              </span>
              <span className="font-bold text-xl text-blue-600">
                {fmt(totals.grand)}
              </span>
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
          onPrint={handlePrintClick}
        />
      </footer>

      <AddItemModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(it) =>
          setItems((prev) => {
            // Better matching: use variant_id if available, otherwise fallback to name+price
            const i = prev.findIndex((p) =>
              it.variant_id
                ? p.variant_id === it.variant_id
                : p.name === it.name && p.price === it.price
            );
            if (i > -1) {
              const copy = [...prev];
              // Preserve all properties including variant_id when updating quantity
              copy[i] = {
                ...copy[i],
                ...it, // Include all new item properties
                qty: copy[i].qty + it.qty,
              };
              return copy;
            }
            return [it as CartItem, ...prev];
          })
        }
      />

      <SaveDraftDialog
        open={openSave}
        onClose={() => setOpenSave(false)}
        items={items}
      />

      <PayDialogMulti
        open={openPay}
        onClose={() => !isProcessing && setOpenPay(false)}
        total={totals.grand}
        onPaidMulti={handleCheckout}
        disabled={isProcessing}
      />

      <CheckoutHistoryDialog
        open={openHistory}
        onClose={() => setOpenHistory(false)}
        onSelectOrder={(order) => router.push(`/receipt?orderId=${order.id}`)}
      />

      {picker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow">
            {pickerLoading ? (
              <div className="text-sm text-neutral-500">Ачааллаж байна…</div>
            ) : (
              <>
                {/* Толгой */}
                <div className="flex gap-3 mb-3">
                  <Image
                    src={picker.img || "/default.png"}
                    alt={picker.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                    unoptimized
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          Нэр: {picker.name}
                        </div>
                        <div className="text-sm text-gray-700">
                          Нөөц:{" "}
                          {pickerVars.reduce((s, v) => s + (v.stock || 0), 0)}
                        </div>
                      </div>
                      <button
                        title="Дуртайд нэмэх"
                        className="p-1.5 rounded-full border text-blue-500 border-blue-200 hover:bg-blue-50"
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                </div>

                {/* Өнгө */}
                {(() => {
                  const colors = uniq(pickerVars.map(colorKeyOf));
                  return (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-2">Өнгө:</div>
                      <div className="flex items-center gap-3">
                        {colors.map((c) => {
                          const sample = pickerVars.find(
                            (v) => colorKeyOf(v) === c
                          );
                          const sw = sample?.colorHex;
                          const active = selColor === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setSelColor(c)}
                              className={`flex flex-col items-center text-xs ${
                                active
                                  ? "ring-2 ring-blue-500 rounded-full"
                                  : ""
                              }`}
                              title={colorLabel(c)}
                            >
                              <span
                                className="w-7 h-7 rounded-full border"
                                style={{ backgroundColor: sw || undefined }}
                              />
                              <span className="mt-1 text-gray-700">
                                {colorLabel(c)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Хэмжээ */}
                {(() => {
                  const sizes = uniq(
                    pickerVars
                      .filter((v) => !selColor || colorKeyOf(v) === selColor)
                      .map((v) => v.size || "—")
                  );
                  const getStock = (size: string) => {
                    const v = pickerVars.find(
                      (x) =>
                        (x.size || "—") === size &&
                        (!selColor || colorKeyOf(x) === selColor)
                    );
                    return v?.stock ?? 0;
                  };
                  return (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-2">Хэмжээ:</div>
                      <div className="flex flex-wrap gap-2">
                        {sizes.map((s) => {
                          const st = getStock(s);
                          const disabled = st <= 0;
                          const active = selSize === s;
                          return (
                            <button
                              key={s}
                              disabled={disabled}
                              onClick={() => setSelSize(s)}
                              className={[
                                "px-3 py-1.5 rounded-full text-sm border",
                                disabled
                                  ? "opacity-40 cursor-not-allowed"
                                  : active
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Сонгосон хувилбар */}
                {(() => {
                  const selected =
                    pickerVars.find(
                      (v) =>
                        (!selColor || colorKeyOf(v) === selColor) &&
                        (!selSize || (v.size || "—") === selSize)
                    ) || null;

                  const showColor = selColor ? colorLabel(selColor) : "—";
                  const showSize = selSize ?? "—";
                  const canAdd = !!selected && selected.stock > 0;

                  return (
                    <>
                      <div className="flex items-center justify-between text-sm mt-1 mb-3">
                        <div className="text-gray-800">
                          <span className="text-gray-500">
                            Сонгосон хувилбар:{" "}
                          </span>
                          <span className="font-medium">
                            {showColor} / {showSize}
                          </span>
                        </div>
                        <div className="text-blue-600">
                          Боломжит:{" "}
                          <span className="font-semibold">
                            {selected?.stock ?? 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setPicker(null)}
                          className="px-3 py-1.5 text-sm rounded-md border"
                        >
                          Хаах
                        </button>
                        <button
                          disabled={!canAdd}
                          onClick={() => {
                            if (!selected) return;
                            setItems((prev) => {
                              const i = prev.findIndex(
                                (it) => it.variant_id === selected.id
                              );
                              if (i > -1) {
                                const copy = [...prev];
                                copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
                                return copy;
                              }
                              return [
                                {
                                  id: picker!.productId,
                                  variant_id: selected.id,
                                  name: picker!.name,
                                  price: selected.price,
                                  qty: 1,
                                  imgPath: picker!.img || "/default.png",
                                  size: selected.size,
                                  color: colorLabel(colorKeyOf(selected)),
                                } as CartItem,
                                ...prev,
                              ];
                            });
                            setPicker(null);
                          }}
                          className="px-3 py-1.5 text-sm rounded-md bg-black text-white disabled:opacity-40"
                        >
                          Сагслах
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {showPrintConfirm && printPayload && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold mb-3">Баталгаажуулах</h2>
            <div className="mb-4">
              <div className="font-medium mb-2">
                Та дараах барааг хэвлэх гэж байна:
              </div>
              <ul className="space-y-2 mb-2">
                {printPayload.items.map((it, idx) => (
                  <li
                    key={it.id + "-" + (it as any).variant_id + "-" + idx}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {it.name} ({it.size || "—"}, {it.color || "—"}) × {it.qty}
                    </span>
                    <span>{fmt(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>Нийт:</span>
                <span>{fmt(printPayload.total)}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPrintConfirm(false)}
                className="px-4 py-2 rounded-lg border bg-gray-50"
              >
                Цуцлах
              </button>
              <button
                onClick={confirmPrint}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
              >
                Баталгаажуулах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
