'use client';
import { useState } from 'react';
import { uploadProductImageOnly } from '@/lib/product/productImages';

export default function UploadOnlyTest() {
  const [img, setImg] = useState<{ path: string; signedUrl: string } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadProductImageOnly(file, { prefix: 'product_img' });
    setImg(res);
    console.log('Uploaded path:', res.path, res.signedUrl);
  }

  return (
    <div className="p-6">
      <input type="file" accept="image/*" onChange={onPick} />
      {img && (
        <div className="mt-3 text-sm">
          Uploaded: {img.path}
          <div className="mt-2">
            <img src={img.signedUrl} alt="Uploaded" className="max-w-xs border" />
          </div>
        </div>
      )}
    </div>
  );
}