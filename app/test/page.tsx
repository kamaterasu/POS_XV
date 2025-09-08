'use client';
import { useEffect, useState } from 'react';
import { getImageShowUrl } from '@/lib/product/productImages';

export default function ShowTest1() {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    getImageShowUrl('product_img/3225ec33-d712-43a3-ac87-092288a7447d.jpeg').then((u) => setUrl(u));
  }, []);

  if (!url) return <p>Loading…</p>;
  return <img src={url} alt="test1" className="max-w-xs border" />;
}
