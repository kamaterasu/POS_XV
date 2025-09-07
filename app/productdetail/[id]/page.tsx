// app/productdetail/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProductDetail from '@/components/inventoryComponents/ProductDetail';
// import { getProductById } from '@/lib/product/productApi';
import { Loading } from '@/components/Loading';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const p = await getProductById(String(id));
        if (alive) setData(p);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) return <Loading open label="Ачаалж байна…" />;
  if (!data) return <div className="p-4">Бараа олдсонгүй.</div>;

  return (
    <ProductDetail
      product={data}
      onBack={() => router.back()}
    />
  );
}
