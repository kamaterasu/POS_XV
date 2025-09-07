'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { supabase } from '@/lib/supabaseClient';

// ---------------- Types ----------------
type ReceiptLine = {
  id: string;
  variant_id: string;
  sku?: string;
  name?: string;
  product_name?: string;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
};
type ReceiptPayment = { id: string; method: string; amount: number; paid_at: string };
type ReceiptPayload = {
  kind: 'order' | string;
  order: {
    id: string; order_no: number; tenant_id: string; store_id: string; status: string;
    cashier_id: string; subtotal: number; discount: number; tax: number; total: number; created_at: string;
  };
  store: { id: string; name: string };
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  pay_total: number;
  change: number;
};

// --------------- Simple text builder (optional preview) ---------------
const LINE_WIDTH = 32;
const money = (n: number) => new Intl.NumberFormat('mn-MN').format(n) + '₮';
const padRight = (s: string, w = LINE_WIDTH) => (s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length));
const dash = (n = LINE_WIDTH) => '—'.repeat(n);
const dateLocal = (iso: string) => new Date(iso).toLocaleString();
function lineLR(left: string, right: string) {
  const maxRight = Math.min(right.length, 12);
  right = right.slice(-maxRight);
  const space = Math.max(1, LINE_WIDTH - left.length - right.length);
  return left.slice(0, LINE_WIDTH - right.length) + ' '.repeat(space) + right;
}
function buildReceiptText(payload: ReceiptPayload) {
  const { store, order, lines, payments, pay_total, change } = payload;
  const head = [
    `Дэлгүүр: ${store?.name ?? ''}`,
    `Захиалга #${order.order_no}`,
    dateLocal(order.created_at),
  ].filter(Boolean);

  const items = lines.map(l => {
    const qtyPrice = `${l.qty} x ${money(l.unit_price)}`;
    const total = money(l.line_total);
    const name = l.product_name ? `${l.product_name}${l.name ? ` (${l.name})` : ''}` : l.name ?? 'Бараа';
    return [padRight(name), lineLR(qtyPrice, total)].join('\n');
  });

  const payLines = payments.map(p => lineLR(`Төлбөрийн хэлбэр: (${p.method})`, money(p.amount)));

  const body = [
    head[0],
    lineLR(head[1], ''),
    head[2],
    dash(),
    ...items,
    dash(),
    lineLR('Дэд дүн', money(order.subtotal)),
    ...(order.discount ? [lineLR('Хөнгөлөлт', `- ${money(order.discount)}`)] : []),
    ...(order.tax ? [lineLR('Татвар', money(order.tax))] : []),
    lineLR('НИЙТ', money(order.total)),
    dash(),
    ...payLines,
    lineLR('Төлсөн дүн', money(pay_total)),
    lineLR('Хариулт', money(change)),
    '',
    'ТАНД БАЯРЛАЛАА!',
    '',
  ];
  return body.join('\n') + '\n';
}

// --------------- Rich layout helpers ---------------
const PX = { w: 384, margin: 16, colGap: 8 };
const FNT = {
  header: { size: 28, weight: '700' },
  body: { size: 18, weight: '400' },
  small: { size: 16, weight: '400' },
  bold: { size: 18, weight: '700' },
  total: { size: 22, weight: '800' },
};
function setFont(ctx: CanvasRenderingContext2D, size: number, weight = '400') {
  ctx.font = `${weight} ${size}px system-ui, "Noto Sans", Arial`;
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
function drawDivider(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const seg = 6, gap = 4; let cx = x;
  ctx.beginPath();
  while (cx < x + w) { ctx.moveTo(cx, y + 0.5); ctx.lineTo(Math.min(cx + seg, x + w), y + 0.5); cx += seg + gap; }
  ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
}
function drawKeyVal(ctx: CanvasRenderingContext2D, label: string, value: string, y: number, x: number, w: number, bold = false) {
  const colL = x, colR = x + w;
  setFont(ctx, FNT.body.size, bold ? FNT.bold.weight : FNT.body.weight);
  ctx.textAlign = 'left'; ctx.fillText(label, colL, y);
  ctx.textAlign = 'right'; ctx.fillText(value, colR, y);
}
function moneyMN(n: number) { return new Intl.NumberFormat('mn-MN').format(n) + '₮'; }
async function loadImage(url?: string) {
  if (!url) return null;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// --------------- Rich renderer ---------------
async function renderReceiptCanvas(
  payload: ReceiptPayload,
  opts?: { headerText?: string; logoUrl?: string; qrData?: string; showSku?: boolean }
) {
  const { headerText = 'СОЛДАТ', logoUrl, qrData, showSku = true } = opts || {};
  const { order, store, lines, payments } = payload;

  const scratch = document.createElement('canvas');
  scratch.width = PX.w;
  scratch.height = 3000; // oversize, we'll crop
  const ctx = scratch.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  const x = PX.margin;
  const innerW = PX.w - PX.margin * 2;
  let y = PX.margin + 8;

  // Header: logo or store name
  const logo = await loadImage(logoUrl);
  if (logo) {
    const maxW = 240, maxH = 70;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const w = Math.round(logo.width * scale);
    const h = Math.round(logo.height * scale);
    const cx = Math.round(PX.w / 2 - w / 2);
    ctx.drawImage(logo, cx, y, w, h);
    y += h + 8;
  }
  setFont(ctx, FNT.header.size, FNT.header.weight);
  ctx.textAlign = 'center';
  ctx.fillText(logo ? (store?.name || headerText) : headerText, PX.w / 2, y);
  y += FNT.header.size + 8;
  setFont(ctx, FNT.small.size);
  ctx.textAlign = 'right';
  ctx.fillText(`Дэлгүүр: ${store?.name}` || '', PX.w / 2, y);
  y += FNT.small.size + 18;

  // Order meta
  setFont(ctx, FNT.body.size);
  ctx.textAlign = 'left';
  const metaLeft = `Захиалга #${order.order_no}`;
  const metaRight = new Date(order.created_at).toLocaleString();
  drawKeyVal(ctx, metaLeft, metaRight, y, x, innerW);
  y += 18;
  drawDivider(ctx, x, y, innerW);
  y += 12;

  // Table header
  setFont(ctx, FNT.bold.size, FNT.bold.weight);
  ctx.textAlign = 'left'; ctx.fillText('Бараа', x, y);
  ctx.textAlign = 'center'; ctx.fillText('Тоо×Үнэ', x + innerW - 140, y);
  ctx.textAlign = 'right'; ctx.fillText('Дүн', x + innerW, y);
  y += 25;
  drawDivider(ctx, x, y, innerW);
  y += 12;

  // Items
  setFont(ctx, FNT.body.size);
  for (const l of lines) {
    const name = l.product_name ? `${l.product_name}${l.name ? ` (${l.name})` : ''}` : l.name ?? 'Бараа';
    const nameW = innerW - 150;
    ctx.textAlign = 'left';
    const nameLines = wrapText(ctx, name, nameW);
    for (let i = 0; i < nameLines.length; i++) {
      const yy = y + i * 20;
      ctx.fillText(nameLines[i], x, yy);
      if (i === 0) {
        const qtyPrice = `${l.qty} × ${moneyMN(l.unit_price)}`;
        ctx.textAlign = 'center'; ctx.fillText(qtyPrice, x + innerW - 140, yy);
        ctx.textAlign = 'right'; ctx.fillText(moneyMN(l.line_total), x + innerW, yy);
      }
    }
    y += nameLines.length * 20;

    if (showSku && l.sku) {
      setFont(ctx, FNT.small.size);
      ctx.textAlign = 'left';
      ctx.fillText(`SKU: ${l.sku}`, x, y);
      setFont(ctx, FNT.body.size);
      y += 18;
    }

    drawDivider(ctx, x, y, innerW);
    y += 10;
  }

  // Summary
  y += 2;
  if (order.discount) { drawKeyVal(ctx, 'Хөнгөлөлт', `- ${moneyMN(order.discount)}`, y, x, innerW); y += 20; }
  if (order.tax) { drawKeyVal(ctx, 'Татвар', moneyMN(order.tax), y, x, innerW); y += 20; }

  setFont(ctx, FNT.total.size, FNT.total.weight);
  drawKeyVal(ctx, 'НИЙТ', moneyMN(order.total), y, x, innerW, true);
  y += 20;
  drawDivider(ctx, x, y, innerW);
  y += 14;

  // Payments
  setFont(ctx, FNT.bold.size, FNT.bold.weight);
  ctx.textAlign = 'left'; ctx.fillText('Төлбөр', x, y); y += 22;
  setFont(ctx, FNT.body.size);
  for (const p of payments) {
    drawKeyVal(ctx, `${p.method}`, moneyMN(p.amount), y, x, innerW);
    y += 20;
  }
  y += 4;
  drawDivider(ctx, x, y, innerW);
  y += 14;

  // Footer
  setFont(ctx, FNT.body.size);
  ctx.textAlign = 'center'; ctx.fillText('ТАНД БАЯРЛАЛАА!', PX.w / 2, y); y += 20;
  setFont(ctx, FNT.small.size);

  // if (qrData) {
  //   try {
  //     const { toCanvas } = await import('qrcode'); // pnpm add qrcode
  //     const qr = document.createElement('canvas');
  //     await toCanvas(qr, qrData, { margin: 0, width: 140 });
  //     const cx = Math.round(PX.w / 2 - qr.width / 2);
  //     ctx.drawImage(qr, cx, y, qr.width, qr.height);
  //     y += qr.height + 10;
  //   } catch (_e) {
  //     // optional; ignore
  //   }
  // }

  // Crop
  const final = document.createElement('canvas');
  final.width = PX.w;
  final.height = y + PX.margin + 20;
  final.getContext('2d')!.drawImage(scratch, 0, 0, PX.w, final.height, 0, 0, PX.w, final.height);
  return final;
}

// --------------- ESC/POS raster (GS v 0) ---------------
function canvasToEscPosRaster(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;

  const bytesPerRow = Math.ceil(width / 8);
  const mono = new Uint8Array(bytesPerRow * height);
  const threshold = 160;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = img[i], g = img[i + 1], b = img[i + 2];
      const v = (r * 299 + g * 587 + b * 114) / 1000;
      const bit = v < threshold ? 1 : 0;
      if (bit) mono[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const init = [0x1B, 0x40]; // ESC @
  const raster = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]; // GS v 0 m=0
  const feedCut = [0x1B, 0x64, 0x02, 0x1D, 0x56, 0x00]; // feed 2, full cut

  const out = new Uint8Array(init.length + raster.length + mono.length + feedCut.length);
  out.set(init, 0);
  out.set(raster, init.length);
  out.set(mono, init.length + raster.length);
  out.set(feedCut, init.length + raster.length + mono.length);
  return out;
}

// --------------- Print / Share paths ---------------
async function printViaWebSerialRasterCanvas(canvas: HTMLCanvasElement) {
  const bytes = canvasToEscPosRaster(canvas);
  // @ts-ignore (Serial types vary by browser)
  const port: SerialPort = await navigator.serial?.requestPort?.();
  await port.open({ baudRate: 9600 });
  const w = port.writable!.getWriter();
  await w.write(bytes);
  w.releaseLock();
  await port.close();
}
async function shareCanvasAsPNG(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
  const file = new File([blob], 'receipt.png', { type: 'image/png' });
  // @ts-ignore
  if (navigator.canShare?.({ files: [file] })) {
    // @ts-ignore
    await navigator.share?.({ files: [file], title: 'Receipt', text: 'Open in Gprinter to print.' });
  } else {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}

// --------------- Edge Function fetcher ---------------
async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return token;
}
async function fetchReceipt(orderId: string): Promise<ReceiptPayload> {
  const token = await getAccessToken();
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  if (!tenant_id) throw new Error('No tenant in token');

  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`);
  url.searchParams.set('tenant_id', tenant_id);
  url.searchParams.set('kind', 'order');
  url.searchParams.set('id', orderId);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Receipt fetch failed: ${res.status}`);
  return res.json();
}

// --------------- Page Component ---------------
export default function Page() {
  const sp = useSearchParams();
  const orderId = sp.get('orderId') || '';

  const [payload, setPayload] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null); // keep last rendered canvas for printing

  useEffect(() => {
    (async () => {
      if (!orderId) return;
      setLoading(true); setErr(null);
      try {
        const p = await fetchReceipt(orderId);
        setPayload(p);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  // Render a rich preview PNG whenever payload changes
  useEffect(() => {
    (async () => {
      if (!payload) { setPngUrl(null); canvasRef.current = null; return; }
      const canvas = await renderReceiptCanvas(payload, {
        headerText: 'СОЛДАТ',
        logoUrl: undefined,          // e.g. '/logo.png'
        qrData: payload.order.id,    // or a deep-link URL
        showSku: true,
      });
      canvasRef.current = canvas;
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
      const url = URL.createObjectURL(blob);
      setPngUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    })();
    // cleanup old object URLs on unmount
    return () => { setPngUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, [payload]);

  const receiptText = useMemo(() => (payload ? buildReceiptText(payload) : ''), [payload]);

  const onPrint = async () => {
    try {
      if (!canvasRef.current && payload) {
        canvasRef.current = await renderReceiptCanvas(payload, { headerText: 'СОЛДАТ', qrData: payload.order.id });
      }
      if (!canvasRef.current) return;

      // @ts-ignore
      if ('serial' in navigator && typeof navigator.serial?.requestPort === 'function') {
        await printViaWebSerialRasterCanvas(canvasRef.current);
        alert('Хэвлэгдлээ');
      } else {
        await shareCanvasAsPNG(canvasRef.current);
      }
    } catch (e) {
      console.error(e);
      alert('Хэвлэх боломжгүй. Зөвшөөрөл/Bluetooth-оо шалгаад дахин оролдоно уу, эсвэл Share ашиглана уу.');
    }
  };

  return (
    <main className="p-6 grid gap-4 max-w-lg backgroud-white">
      <h1 className="text-xl font-semibold">Квитанц хэвлэх</h1>

      {!orderId && (
        <p className="text-sm text-red-600">
          URL-д <code>?orderId=...</code> параметр нэмнэ үү.
        </p>
      )}
      {loading && <p>Уншиж байна…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {payload && (
        <>
          <div className="text-sm text-neutral-600">
            Дэлгүүр: <b>{payload.store.name}</b> · Захиалга #{payload.order.order_no}
          </div>

          {/* Rich preview (PNG from canvas) */}
          {pngUrl && (
            <img
              src={pngUrl}
              alt="Receipt preview"
              className="border rounded-lg bg-white"
              style={{ width: 384 }}
            />
          )}

          {/* Optional text preview for debugging */}
          <details className="text-sm">
            <summary className="cursor-pointer select-none">Текстэн квитанц (debug)</summary>
            <pre className="whitespace-pre-wrap text-sm bg-neutral-50 border rounded p-3">{receiptText}</pre>
          </details>

          <button onClick={onPrint} className="px-4 py-2 rounded-xl border hover:bg-neutral-50 active:scale-[0.99]">
            Хэвлэх
          </button>
        </>
      )}
    </main>
  );
}

