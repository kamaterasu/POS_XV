// /lib/storage/productImages.ts
import { supabase } from '@/lib/supabaseClient';

const BUCKET = 'product-images';

function guessType(ext: string) {
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

export async function uploadProductImageOnly(
  file: File,
  opts?: { prefix?: string; upsert?: boolean }
) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `${crypto.randomUUID()}.${ext}`;
  const path = `${opts?.prefix ?? 'product_img'}/${name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: opts?.upsert ?? false,
    contentType: file.type || guessType(ext),
  });
  if (error) throw error;

  // 7 хоногийн хугацаатай signed URL авах
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 хоног

  if (urlError) throw urlError;

  return { path, signedUrl: data.signedUrl };
}