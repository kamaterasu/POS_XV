"use client";

import { useRef, useMemo, useState, useEffect, ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// import type { Variant } from '@/lib/inventory/inventoryTypes';
type Variant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
};
import {
  apiCreateProduct,
  apiCategoryCreate,
} from "@/lib/inventory/inventoryApi";
import type { Category } from "@/lib/category/categoryApi";
import { Loading } from "@/components/Loading";

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ========================== Category helpers ========================== */

type CleanCategory = { id: string; name: string; parent_id: string | null };

function sanitizeCats(cats: Category[]): CleanCategory[] {
  return (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "",
    parent_id: c.parent_id ?? null,
  }));
}

function buildCategoryHelpers(cats: CleanCategory[]) {
  const byId = new Map<string, CleanCategory>();
  const children = new Map<string | null, CleanCategory[]>();

  for (const c of cats) {
    byId.set(c.id, c);
    const key = c.parent_id; // always null or string
    const arr = children.get(key) ?? [];
    arr.push(c);
    children.set(key, arr);
  }

  for (const arr of children.values()) {
    arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }

  function getChildren(pid: string | null) {
    return children.get(pid) ?? [];
  }

  function getAncestors(id: string | null): CleanCategory[] {
    const out: CleanCategory[] = [];
    let cur = id ? byId.get(id) ?? null : null;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) ?? null : null;
    }
    return out;
  }

  function getPathText(id: string | null) {
    const parts = getAncestors(id).map((c) => c.name);
    return parts.length ? parts.join(" › ") : "Ангилал байхгүй";
  }

  function search(q: string) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const results: { id: string; text: string }[] = [];
    for (const c of byId.values()) {
      if ((c.name ?? "").toLowerCase().includes(s)) {
        results.push({ id: c.id, text: getPathText(c.id) });
      }
    }
    results.sort((a, b) => a.text.localeCompare(b.text));
    return results;
  }

  return { byId, getChildren, getAncestors, getPathText, search };
}

/* ========================== CategoryPicker ========================== */

function CategoryPicker({
  categories,
  value,
  onChange,
  tenantId,
}: {
  categories: Category[]; // raw from API
  value: string | null; // selected category id
  onChange: (id: string | null, pathLabel: string, leafName?: string) => void;
  tenantId?: string; // enables inline add
}) {
  const normalized = useMemo(() => sanitizeCats(categories), [categories]);

  // Keep a local list that can accept inline additions, but resync when props change
  const [localCats, setLocalCats] = useState<CleanCategory[]>(normalized);
  useEffect(() => setLocalCats(normalized), [normalized]);

  const helpers = useMemo(() => buildCategoryHelpers(localCats), [localCats]);

  const [open, setOpen] = useState(false);
  const [browseId, setBrowseId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const breadcrumb = useMemo(
    () => helpers.getAncestors(browseId),
    [helpers, browseId]
  );
  const children = useMemo(
    () => helpers.getChildren(browseId),
    [helpers, browseId]
  );
  const selectedText = helpers.getPathText(value);
  const searchResults = searchQ ? helpers.search(searchQ) : [];

  async function addSubcategory() {
    const name = newName.trim();
    if (!name || !tenantId) return;
    const created = await apiCategoryCreate({
      tenantId,
      name,
      parentId: browseId ?? null,
    });
    // Append to local list so it appears immediately
    setLocalCats((prev) => [
      ...prev,
      {
        id: created.id,
        name: created.name ?? "",
        parent_id: created.parent_id ?? null,
      },
    ]);
    setNewName("");
  }

  function choose(id: string | null) {
    const pathLabel = helpers.getPathText(id);
    const leaf = helpers.getAncestors(id).slice(-1)[0]?.name;
    onChange(id, pathLabel, leaf);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-10 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm"
        >
          Ангилал сонгох
        </button>
        <div className="text-sm text-[#333] truncate max-w-[60ch]">
          <span className="opacity-70">Одоогийн:</span>{" "}
          <b title={selectedText}>{selectedText}</b>
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(92vw,640px)] bg-white border border-[#E6E6E6] rounded-xl shadow-lg p-3">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <button
                className={`px-2 py-1 rounded border ${
                  browseId === null
                    ? "bg-[#5AA6FF] text-white border-[#5AA6FF]"
                    : "border-[#E6E6E6] bg-white"
                }`}
                onClick={() => setBrowseId(null)}
              >
                Үндэс
              </button>
              {breadcrumb.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBrowseId(b.id)}
                  className="px-2 py-1 rounded border border-[#E6E6E6] bg-white"
                >
                  {b.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 h-9 rounded-md bg-white border border-[#E6E6E6] text-sm"
                onClick={() => choose(browseId)}
              >
                Энд сонгох
              </button>
              <button
                className="px-3 h-9 rounded-md bg-white border border-[#E6E6E6] text-sm"
                onClick={() => setOpen(false)}
              >
                Хаах
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-2">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Хайх (нэрээр)…"
              className="h-9 w-full rounded-md border border-[#E6E6E6] px-3"
            />
            {searchQ && (
              <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-[#F0F0F0]">
                {searchResults.length ? (
                  searchResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => choose(r.id)}
                      className="block w-full text-left px-3 py-2 hover:bg-[#F7F7F7] text-sm"
                    >
                      {r.text}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-[#777]">
                    Үр дүн олдсонгүй.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Children grid */}
          {!searchQ && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {children.length ? (
                children.map((c) => (
                  <div
                    key={c.id}
                    className="border rounded-md p-2 flex items-center justify-between"
                  >
                    <div className="truncate pr-2">{c.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded border border-[#E6E6E6] bg-white"
                        onClick={() => choose(c.id)}
                      >
                        Сонгох
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-[#E6E6E6] bg-white"
                        onClick={() => setBrowseId(c.id)}
                        title="Дотогш орох"
                      >
                        ➜
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#777] px-1">
                  Дэд ангилал байхгүй.
                </div>
              )}
            </div>
          )}

          {/* Inline add subcategory */}
          {tenantId && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Шинэ дэд ангиллын нэр"
                className="h-9 flex-1 rounded-md border border-[#E6E6E6] px-3"
              />
              <button
                className="h-9 px-3 rounded-md bg-[#5AA6FF] text-white"
                onClick={addSubcategory}
              >
                Нэмэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductCreateForm({
  cats, // full Category objects from your API (must include id,name,parent_id)
  branches,
  tenantId, // optional: enables inline add in CategoryPicker
}: {
  cats: Category[];
  branches: string[];
  tenantId?: string;
}) {
  const router = useRouter();
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);

  type NewProduct = {
    name: string;
    sku?: string;
    category?: string; // keep sending LEAF name for now
    price?: number;
    cost?: number;
    trackInventory: boolean;
    isActive: boolean;
    description?: string;
    images: string[];
    variants: Variant[];
    initialStocks: Record<string, number>;
  };

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedPathLabel, setSelectedPathLabel] =
    useState<string>("Ангилал байхгүй");

  const [newProd, setNewProd] = useState<NewProduct>({
    name: "",
    sku: "",
    category: undefined,
    price: undefined,
    cost: undefined,
    trackInventory: true,
    isActive: true,
    description: "",
    images: [],
    variants: [],
    initialStocks: Object.fromEntries(
      branches.filter((b) => b !== "Бүх салбар").map((b) => [b, 0])
    ),
  });

  function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) urls.push(URL.createObjectURL(f));
    setNewProd((p) => ({ ...p, images: [...p.images, ...urls] }));
  }
  function removeImage(i: number) {
    setNewProd((p) => ({
      ...p,
      images: p.images.filter((_, idx) => idx !== i),
    }));
  }
  function addVariant() {
    setNewProd((p) => ({
      ...p,
      variants: [
        ...p.variants,
        { id: rid(), color: "", size: "", sku: "", price: undefined },
      ],
    }));
  }
  function removeVariant(id: string) {
    setNewProd((p) => ({
      ...p,
      variants: p.variants.filter((v) => v.id !== id),
    }));
  }
  function updateVariant(id: string, patch: Partial<Variant>) {
    setNewProd((p) => ({
      ...p,
      variants: p.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  async function handleCreateSubmit() {
    if (!newProd.name.trim()) return alert("Барааны нэрийг оруулна уу.");
    if (newProd.price == null || Number.isNaN(newProd.price))
      return alert("Зарах үнийг оруулна уу.");

    const cleanVariants = newProd.variants
      .map((v) => ({ ...v, price: v.price ?? newProd.price }))
      .filter((v) => v.color?.trim() || v.size?.trim() || v.sku?.trim());

    const payload = { ...newProd, variants: cleanVariants };
    setLoading(true);
    try {
      const res = await apiCreateProduct(payload as any);
      alert("Шинэ бараа нэмэгдлээ.");
      router.push(`/productdetail/${res.id}`);
    } catch (error) {
      alert("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading open label="Уншиж байна…" />;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Барааны нэр *</label>
          <input
            className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
            value={newProd.name}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="Барааны нэрээ оруулна уу."
          />
        </div>

        {/* Category (tree picker) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Ангилал</label>
          <CategoryPicker
            categories={cats}
            value={selectedCatId}
            tenantId={tenantId}
            onChange={(id, pathLabel, leaf) => {
              setSelectedCatId(id);
              setSelectedPathLabel(pathLabel);
              setNewProd((p) => ({ ...p, category: leaf })); // keep sending the leaf name
            }}
          />
          <div className="text-xs text-[#777]">
            Сонгосон: <b>{selectedPathLabel}</b>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Зарах үнэ *</label>
          <input
            type="number"
            className="h-10 w-full rounded-md border border-[#E6E6E6] px-3"
            value={newProd.price ?? ""}
            onChange={(e) =>
              setNewProd((p) => ({ ...p, price: Number(e.target.value || 0) }))
            }
            placeholder="Барааны зарах үнэ"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Тайлбар</label>
        <textarea
          className="min-h-24 w-full rounded-md border border-[#E6E6E6] px-3 py-2"
          value={newProd.description}
          onChange={(e) =>
            setNewProd((p) => ({ ...p, description: e.target.value }))
          }
          placeholder="Материал, онцлог, арчилгаа..."
        />
      </div>

      {/* Images */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Зураг</span>
          <button
            onClick={() => imgInputRef.current?.click()}
            className="h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm"
          >
            Зураг нэмэх
          </button>
          <input
            ref={imgInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>
        {newProd.images.length ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {newProd.images.map((src, i) => (
              <div key={src} className="relative aspect-square">
                <Image
                  src={src}
                  alt={`Барааны зураг ${i + 1}`}
                  fill
                  sizes="(min-width:768px) 14vw, 30vw"
                  className="object-cover rounded-md border"
                  // Skip optimization for blob/data URLs
                  unoptimized={
                    src.startsWith("blob:") || src.startsWith("data:")
                  }
                  priority={i === 0}
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 text-xs bg-white/80 rounded px-1 border"
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[#777]">Одоогоор зураг алга.</div>
        )}
      </div>

      {/* Variants */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Вариант (сонголттой бол)</span>
          <button
            onClick={addVariant}
            className="h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-sm"
          >
            + Variant
          </button>
        </div>
        <div className="space-y-2">
          {newProd.variants.map((v) => (
            <div
              key={v.id}
              className="grid grid-cols-2 md:grid-cols-6 gap-2 items-center border rounded-md p-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-12 p-0 border border-[#E6E6E6] rounded-md cursor-pointer"
                  value={v.color || "#E6E6E6"}
                  onChange={(e) =>
                    updateVariant(v.id, { color: e.target.value })
                  }
                />
                <input
                  placeholder="#000000"
                  className="h-9 flex-1 rounded-md border border-[#E6E6E6] px-2"
                  value={v.color || ""}
                  onChange={(e) =>
                    updateVariant(v.id, { color: e.target.value })
                  }
                />
                <span
                  className="inline-block h-6 w-6 rounded-full border border-black/10"
                  style={{ backgroundColor: v.color || "#E6E6E6" }}
                />
              </div>
              <input
                placeholder="Хэмжээ оруулна уу."
                className="h-9 rounded-md border border-[#E6E6E6] px-2"
                value={v.size ?? ""}
                onChange={(e) => updateVariant(v.id, { size: e.target.value })}
              />
              <input
                type="number"
                placeholder="Тухайн хэмжээний үнэ."
                className="h-9 rounded-md border border-[#E6E6E6] px-2"
                value={v.price ?? ""}
                onChange={(e) =>
                  updateVariant(v.id, { price: Number(e.target.value || 0) })
                }
              />
              <div className="flex justify-end">
                <button
                  onClick={() => removeVariant(v.id)}
                  className="h-9 px-3 rounded-md border border-red-200 text-red-600 text-sm bg-white"
                >
                  Устгах
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-[#777]">
          Бараа нэмэх үед хэмжээ, өнгөөс хамаарч өөр үнтэй бол заавал оруулна
          уу.
        </div>
      </div>

      {/* Initial stocks */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Эхний нөөц (салбарууд)</span>
        <div className="grid md:grid-cols-3 gap-2">
          {branches
            .filter((b) => b !== "Бүх салбар")
            .map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="text-sm w-32">{b}</span>
                <input
                  type="number"
                  className="h-9 w-full rounded-md border border-[#E6E6E6] px-2"
                  value={newProd.initialStocks[b] ?? 0}
                  onChange={(e) => {
                    const n = Math.max(0, Number(e.target.value || 0));
                    setNewProd((p) => ({
                      ...p,
                      initialStocks: { ...p.initialStocks, [b]: n },
                    }));
                  }}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white rounded-xl border border-[#E6E6E6] shadow-md p-3 flex items-center justify-end gap-3">
        <button
          onClick={() => {
            setSelectedCatId(null);
            setSelectedPathLabel("Ангилал байхгүй");
            setNewProd((p) => ({
              ...p,
              name: "",
              sku: "",
              description: "",
              price: undefined,
              cost: undefined,
              category: undefined,
              images: [],
              variants: [
                { id: rid(), color: "", size: "", sku: "", price: undefined },
              ],
              initialStocks: Object.fromEntries(
                branches.filter((b) => b !== "Бүх салбар").map((b) => [b, 0])
              ),
            }));
          }}
          className="h-10 px-4 rounded-lg border border-[#E6E6E6] bg-white"
        >
          Цэвэрлэх
        </button>
        <button
          onClick={handleCreateSubmit}
          className="h-10 px-5 rounded-lg bg-[#5AA6FF] text-white"
        >
          Хадгалах
        </button>
      </div>
    </div>
  );
}
