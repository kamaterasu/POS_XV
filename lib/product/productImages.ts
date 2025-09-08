// ----- productImages.ts -----
'use client';
import { supabase } from '@/lib/supabaseClient';

const BUCKET = 'product-images';
const DEFAULT_PREFIX = 'product_img';
const DEFAULT_IMAGE = '/default.png';
type CompressOpts = {
  maxWidth?: number;          // уртын дээд хэмжээ
  maxHeight?: number;         // өндрийн дээд хэмжээ
  quality?: number;           // 0..1 (WebP/JPEG)
  minBytesNoCompress?: number;// үүнээс жижиг бол шахахгүй
};

async function compressImage(
  file: File,
  opts: CompressOpts = {}
): Promise<{ blob: Blob; ext: string; mime: string }> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    minBytesNoCompress = 200 * 1024, // <200KB бол шууд явуулна
  } = opts;

  const origExt = (file.name.split('.').pop() || 'jpg').toLowerCase();

  if (file.size <= minBytesNoCompress) {
    return { blob: file, ext: origExt, mime: file.type || 'application/octet-stream' };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  const loaded = new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
  });
  img.src = url;
  await loaded;
  URL.revokeObjectURL(url);

  const ratio = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(img, 0, 0, w, h);
  const toBlob = (type: string, q?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  const tryTypes: Array<{ type: string; ext: string; q?: number }> = [
    { type: 'image/webp', ext: 'webp', q: quality },
    { type: 'image/jpeg', ext: 'jpg', q: quality },
  ];

  for (const t of tryTypes) {
    const blob = await toBlob(t.type, t.q);
    if (blob) {
      if (blob.size > file.size * 0.98) {
        return { blob: file, ext: origExt, mime: file.type || t.type };
      }
      return { blob, ext: t.ext, mime: t.type };
    }
  }
  return { blob: file, ext: origExt, mime: file.type || 'application/octet-stream' };
}
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
  let compressed;
  try {
    compressed = await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 0.82,
      minBytesNoCompress: 200 * 1024,
    });
  } catch {
    compressed = { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), mime: file.type || guessType('jpg') };
  }

  const name = `${crypto.randomUUID()}.${compressed.ext}`;
  const path = `${opts?.prefix ?? DEFAULT_PREFIX}/${name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed.blob, {
    cacheControl: '3600',
    upsert: opts?.upsert ?? false,
    contentType: compressed.mime,
  });
  if (error) throw error;
  const { data, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  const signedUrl = !urlError && data?.signedUrl ? data.signedUrl : DEFAULT_IMAGE;
  return { path, signedUrl };
}
function normalizeStoragePath(input: string): string {
  let s = (input || '').trim();
  if (!s) return '';

  const dashboardMatch = s.match(/buckets\/[^/]+\/(.+)$/);
  if (dashboardMatch) {
    s = dashboardMatch[1];
    s = s.replace(/^(?:objects|public|sign|r|s)\//, '');
  }

  if (s.startsWith(`${BUCKET}/`)) s = s.slice(BUCKET.length + 1);
  if (!s.includes('/')) s = `${DEFAULT_PREFIX}/${s}`;
  return s;
}

export async function getImageShowUrl(
  pathOrUrl: string,
  opts?: { fallback?: string; preferPublic?: boolean }
): Promise<string> {
  const fallback = opts?.fallback ?? DEFAULT_IMAGE;
  const raw = (pathOrUrl || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw) || raw.startsWith('/')) return raw;

  const path = normalizeStoragePath(raw);
  if (!path) return fallback;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (!error && data?.signedUrl) return data.signedUrl;

  if (opts?.preferPublic) {
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (pub?.publicUrl) return pub.publicUrl;
  }

  console.warn('getImageShowUrl: object not found or signing failed, using fallback', { path, error });
  return fallback;
}
