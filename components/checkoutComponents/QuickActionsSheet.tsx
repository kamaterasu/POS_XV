"use client";
import { useMemo, useState } from "react";
import { QuickActions, Item } from "@/lib/sales/salesTypes";
import Image from "next/image";

type FavVariant = {
  color?: string;
  size?: string;
  price: number;
  stock?: number;
  img?: string;
};
type FavoriteProduct = {
  id: string;
  name: string;
  category?: string;
  variants: FavVariant[];
  img?: string;
};

export default function QuickActionsSheet({
  open,
  onClose,
  value,
  onChange,
  favorites,
  onPickFavorite,
}: {
  open: boolean;
  onClose: () => void;
  value: QuickActions;
  onChange: (v: QuickActions) => void;
  favorites?: FavoriteProduct[];
  onPickFavorite?: (it: Item) => void;
}) {
  // --- STATE (уншигдах ёстой эхэнд) ---
  const [tab, setTab] = useState<"settings" | "favorites">("settings");
  const [cat, setCat] = useState<string>("Бүгд");
  const [query, setQuery] = useState("");

  // --- SETTINGS ---
  const d: QuickActions = {
    discountPercent: Number.isFinite(value?.discountPercent)
      ? value.discountPercent
      : 0,
    deliveryFee: Number.isFinite(value?.deliveryFee) ? value.deliveryFee : 0,
    includeVAT: !!value?.includeVAT,
  };
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const update = (patch: Partial<QuickActions>) => onChange({ ...d, ...patch });

  // --- FAVORITES (useMemo-уудыг condition-гүй дуудаж байна) ---
  const cats = useMemo(() => {
    const set = new Set<string>(["Бүгд"]);
    (favorites ?? []).forEach((f) => set.add(f.category || "Бусад"));
    return Array.from(set);
  }, [favorites]);

  const favFiltered = useMemo(() => {
    let arr = favorites ?? [];
    if (cat !== "Бүгд")
      arr = arr.filter((f) => (f.category || "Бусад") === cat);
    const q = query.trim().toLowerCase();
    if (q) arr = arr.filter((f) => f.name.toLowerCase().includes(q));
    return arr;
  }, [favorites, cat, query]);

  const pick = (p: FavoriteProduct, v: FavVariant) => {
    if (!onPickFavorite) return;
    const it: Item = {
      id: `${p.id}-${v.color || "—"}-${v.size || "—"}-${Date.now()}`,
      name: p.name,
      qty: 1,
      price: v.price,
      color: v.color,
      size: v.size,
      imgPath: v.img || p.img || "/default.png",
    };
    onPickFavorite(it);
  };

  // **Guard-аа hooks-уудын ДАРАА байрлуул**
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl bg-white rounded-t-2xl p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="px-4 pt-4">
          <div className="h-1.5 w-12 bg-black/10 rounded mx-auto mb-3" />
          <div className="flex gap-2 text-sm">
            <button
              className={`px-3 h-9 rounded ${
                tab === "settings"
                  ? "bg-[#EAF2FF] text-[#1A274F] border border-[#CFE3FF]"
                  : "border"
              }`}
              onClick={() => setTab("settings")}
            >
              Гарын доорх тохиргоо
            </button>
            {Boolean(favorites?.length) && (
              <button
                className={`px-3 h-9 rounded ${
                  tab === "favorites"
                    ? "bg-[#EAF2FF] text-[#1A274F] border border-[#CFE3FF]"
                    : "border"
                }`}
                onClick={() => setTab("favorites")}
              >
                Дуртай бараа
              </button>
            )}
            <div className="ml-auto" />
            <button onClick={onClose} className="h-9 px-3 rounded border">
              Хаах
            </button>
          </div>
        </div>

        {/* Body */}
        {tab === "settings" ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-black/60">Хөнгөлөлт (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="h-10 w-full border rounded px-2"
                  value={d.discountPercent}
                  onChange={(e) =>
                    update({
                      discountPercent: clamp(
                        parseFloat(e.target.value || "0"),
                        0,
                        100
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-black/60">Хүргэлт</label>
                <input
                  type="number"
                  min={0}
                  className="h-10 w-full border rounded px-2"
                  value={d.deliveryFee}
                  onChange={(e) =>
                    update({
                      deliveryFee: clamp(
                        parseFloat(e.target.value || "0"),
                        0,
                        Infinity
                      ),
                    })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.includeVAT}
                onChange={(e) => update({ includeVAT: e.target.checked })}
              />
              НӨАТ (10%) нэмэх
            </label>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`h-8 px-3 rounded-full border text-sm ${
                    cat === c
                      ? "bg-[#EAF2FF] border-[#CFE3FF] text-[#1A274F]"
                      : ""
                  }`}
                >
                  {c}
                </button>
              ))}
              <input
                className="ml-auto h-9 w-56 border rounded px-3 text-sm"
                placeholder="Хайх: нэр"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* List */}
            <div className="max-h-[55vh] overflow-auto border rounded">
              <ul className="divide-y">
                {favFiltered.map((p) => (
                  <li key={p.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 flex-shrink-0">
                        <Image
                          src={p.img || "/default.png"}
                          alt={p.name}
                          fill
                          sizes="48px"
                          className="rounded object-cover bg-[#EFEFEF]"
                          // file input-оос ирвэл optimize хийхгүй
                          unoptimized={
                            p.img?.startsWith("blob:") ||
                            p.img?.startsWith("data:")
                          }
                        />
                      </div>

                      <div className="flex-1">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-black/60">
                          {p.category || "Бусад"}
                        </div>
                        {/* ...variants buttons хэвээр... */}
                      </div>
                    </div>
                  </li>
                ))}
                {favFiltered.length === 0 && (
                  <li className="p-6 text-sm text-black/60">
                    Илэрц олдсонгүй.
                  </li>
                )}
              </ul>
            </div>

            {!onPickFavorite && (
              <div className="text-[12px] text-black/50">
                * Сонгоход сагсанд нэмэхийг идэвхжүүлэхийн тулд{" "}
                <code>onPickFavorite</code> пропс дамжуулаарай.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtMNT(n: number) {
  if (!Number.isFinite(n)) return "0 ₮";
  return new Intl.NumberFormat("mn-MN").format(Math.floor(n)) + " ₮";
}
