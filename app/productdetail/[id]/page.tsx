// /home/tr1bo/Documents/1. Projets/pos-x/app/productdetail/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loading } from '@/components/Loading';
import { getProductById } from '@/lib/product/productApi';

type AnyObj = Record<string, any>;

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<AnyObj | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Танай API сигнатур нь getProductById(id: string) гэж үзэв
        const p = await getProductById(String(id));
        if (alive) setData(p);
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Алдаа гарлаа.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [id]);

  if (loading) return <Loading open label="Ачаалж байна…" />;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="h-9 px-3 rounded-full border border-neutral-200 bg-white text-xs hover:shadow-sm"
        >
          ← Буцах
        </button>
        <div className="text-sm text-neutral-500">
          Барааны ID: <span className="font-mono">{String(id)}</span>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600">Алдаа: {error}</div>
      ) : !data ? (
        <div className="text-sm text-neutral-500">Өгөгдөл олдсонгүй.</div>
      ) : (
        <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-neutral-50 p-3">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
