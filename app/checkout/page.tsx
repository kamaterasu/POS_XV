"use client";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Item, QuickActions, PaymentRow } from "@/lib/sales/salesTypes";
import { listProducts } from "@/lib/product/productApi";
import { fmt, calcTotals } from "@/lib/sales/salesUtils";
import {
  createCheckoutOrder,
  getCheckoutOrders,
} from "@/lib/checkout/checkoutApi";

/** ===== Product type for API response ===== */
type ProductFromAPI = {
  id: string;
  name: string;
  imgPath: string;
  price: number;
  qty: number;
};

import CartFooter from "@/components/checkoutComponents/CartFooter";
import AddItemModal from "@/components/checkoutComponents/AddItemModal";
import QuickActionsSheet from "@/components/checkoutComponents/QuickActionsSheet";
import SaveDraftDialog from "@/components/checkoutComponents/SaveDraftDialog";
import PayDialogMulti from "@/components/checkoutComponents/PayDialogMulti";
import CheckoutHistoryDialog from "@/components/checkoutComponents/CheckoutHistoryDialog";

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

export default function CheckoutPage() {
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
  const [openHistory, setOpenHistory] = useState(false);

  // checkout states
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // favorites (түр listProducts-оос үүсгэнэ)
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  /** Favorites-ийг ачаална (амжилтгүй бол хоосон байж болно) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // inventoryApi-ийн одоогийн no-op буцаалттай байсан ч зүгээр — хоосон жагсаалт болно
        const prods = await listProducts({ storeId: "all" });
        if (cancelled) return;

        const favs: FavoriteProduct[] = (prods ?? [])
          .slice(0, 24)
          .map((p: ProductFromAPI) => ({
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
  const totalRaw = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.price, 0),
    [items]
  );
  const totals = useMemo(() => calcTotals(items, qa), [items, qa]);

  /** Qty өөрчлөлт */
  const inc = (id: string) =>
    setItems((arr) =>
      arr.map((it) => (it.id === id ? { ...it, qty: it.qty + 1 } : it))
    );
  const dec = (id: string) =>
    setItems((arr) =>
      arr.map((it) =>
        it.id === id && it.qty > 1 ? { ...it, qty: it.qty - 1 } : it
      )
    );

  const goToDashboard = () => router.push("/dashboard");

  /** Handle successful payment */
  const handleCheckout = async (
    paymentRows: PaymentRow[],
    totalReceived: number,
    change: number
  ) => {
    if (items.length === 0) {
      alert("Захиалгад бүтээгдэхүүн нэмнэ үү");
      return;
    }

    setIsProcessing(true);
    try {
      // Calculate tax and discount
      const tax = qa.includeVAT ? Math.round(totals.grand * 0.1) : 0;
      const discount = Math.round(totals.discount);

      // Create the order
      const result = await createCheckoutOrder(items, paymentRows, {
        tax,
        discount,
      });

      if (result) {
        setLastOrderId(result.order.id);

        // Clear the cart
        setItems([]);

        // Reset quick actions
        setQa({
          discountPercent: 0,
          deliveryFee: 0,
          includeVAT: false,
        });

        // Close pay dialog
        setOpenPay(false);

        // Show success message and redirect to receipt
        alert(
          `Захиалга амжилттай хадгалагдлаа! Order ID: ${result.order.id.slice(
            -8
          )}`
        );

        // Redirect to receipt page
        router.push(`/receipt?orderId=${result.order.id}`);
      }
    } catch (error) {
      console.error("Checkout error:", error);

      let errorMessage = "Тодорхойгүй алдаа";

      if (error instanceof Error) {
        if (error.message.includes("tenant_id")) {
          errorMessage =
            "Танд байгууллагын эрх байхгүй байна. Дахин нэвтэрнэ үү.";
        } else if (error.message.includes("store_id")) {
          errorMessage =
            "Танд дэлгүүрийн эрх байхгүй байна. Админтай холбогдоно уу.";
        } else if (error.message.includes("NOT_AUTHENTICATED")) {
          errorMessage = "Нэвтрэх шаардлагатай. Дахин нэвтэрнэ үү.";
        } else {
          errorMessage = error.message;
        }
      }

      alert(`Захиалга үүсгэхэд алдаа гарлаа: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 flex flex-col gap-4">
      <header>
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
      </header>{" "}
      <main className="flex-1 flex flex-col text-black">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-6 py-3 mb-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm text-sm text-gray-900 font-medium">
          <span>Бүтээгдэхүүн</span>
          <span className="text-right">Ширхэг/Үнэ</span>
        </div>

        <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white/40 rounded-2xl shadow-sm overflow-y-auto p-4">
          <ul className="space-y-3">
            {items.map((it, idx) => {
              const line = it.qty * it.price;
              return (
                <li
                  key={it.id}
                  className="p-4 bg-white/60 backdrop-blur-sm border border-white/40 rounded-xl shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200"
                >
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <div className="flex items-start gap-2 w-full">
                      <div className="flex items-start gap-2">
                        <Image
                          src={it.imgPath || "/default.png"}
                          alt={it.name}
                          width={40}
                          height={40}
                          className="w-12 h-12 rounded-xl object-cover bg-gray-100 shadow-sm"
                          onError={() => {
                            console.debug("image load failed for", it.imgPath);
                          }}
                        />
                        <div className="leading-tight flex flex-col">
                          <div className="text-sm font-semibold text-gray-900">
                            {idx + 1}. {it.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            Хэмжээ: {it.size || "—"}
                          </div>
                          <div className="text-xs text-gray-600">
                            Өнгө: {it.color || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {fmt(it.price)} × {it.qty}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col place-content-end gap-2 items-center max-w-full justify-center">
                      {/* Qty control */}
                      <div className="flex justify-center w-20">
                        <div className="inline-flex items-center gap-1 bg-gray-50 rounded-full p-1">
                          <button
                            onClick={() => dec(it.id)}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 text-gray-700 hover:text-red-600 text-sm leading-none flex items-center justify-center transition-colors duration-200"
                            aria-label="Буурах"
                          >
                            –
                          </button>
                          <span className="min-w-8 text-center text-sm font-medium text-gray-900 px-2">
                            {it.qty}
                          </span>
                          <button
                            onClick={() => inc(it.id)}
                            className="w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm leading-none flex items-center justify-center transition-colors duration-200"
                            aria-label="Нэмэгдэх"
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
          onQuick={() => setOpenQuick(true)}
          onAdd={() => setOpenAdd(true)}
          onSave={() => setOpenSave(true)}
          onPay={() => setOpenPay(true)}
          onHistory={() => setOpenHistory(true)}
        />
      </footer>
      {/* Add item */}
      <AddItemModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onAdd={(it) =>
          setItems((prev) => {
            const i = prev.findIndex(
              (p) =>
                p.name === it.name &&
                p.price === it.price &&
                p.size === it.size &&
                p.color === it.color
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
      {/* <QuickActionsSheet
        open={openQuick}
        onClose={() => setOpenQuick(false)}
        value={qa}
        onChange={setQa}
        favorites={favorites}
        onPickFavorite={(it) =>
          setItems((prev) => {
            const i = prev.findIndex(
              (p) =>
                p.name === it.name &&
                p.price === it.price &&
                p.size === it.size &&
                p.color === it.color
            );
            if (i > -1) {
              const copy = [...prev];
              copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
              return copy;
            }
            return [it, ...prev];
          })
        }
      /> */}
      {/* Save draft */}
      <SaveDraftDialog
        open={openSave}
        onClose={() => setOpenSave(false)}
        items={items}
      />
      {/* Pay */}
      <PayDialogMulti
        open={openPay}
        onClose={() => !isProcessing && setOpenPay(false)}
        total={totals.grand}
        onPaidMulti={handleCheckout}
        disabled={isProcessing}
      />
      {/* Checkout History */}
      <CheckoutHistoryDialog
        open={openHistory}
        onClose={() => setOpenHistory(false)}
        onSelectOrder={(order) => {
          // Optionally redirect to receipt page for selected order
          router.push(`/receipt?orderId=${order.id}`);
        }}
      />
    </div>
  );
}
