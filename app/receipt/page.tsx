"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { supabase } from "@/lib/supabaseClient";

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
type ReceiptPayment = {
  id: string;
  method: string;
  amount: number;
  paid_at: string;
};
type ReceiptPayload = {
  kind: "order" | string;
  order: {
    id: string;
    order_no: number;
    tenant_id: string;
    store_id: string;
    status: string;
    cashier_id: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    created_at: string;
  };
  store: { id: string; name: string };
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  pay_total: number;
  change: number;
};

// --------------- Simple text builder (optional debug) ---------------
const LINE_WIDTH = 32;
const money = (n: number) => new Intl.NumberFormat("mn-MN").format(n) + "₮";
const padRight = (s: string, w = LINE_WIDTH) =>
  s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
const dash = (n = LINE_WIDTH) => "—".repeat(n);
const dateLocal = (iso: string) => new Date(iso).toLocaleString();
function lineLR(left: string, right: string) {
  const maxRight = Math.min(right.length, 12);
  right = right.slice(-maxRight);
  const space = Math.max(1, LINE_WIDTH - left.length - right.length);
  return left.slice(0, LINE_WIDTH - right.length) + " ".repeat(space) + right;
}
function buildReceiptText(payload: ReceiptPayload) {
  const { store, order, lines, payments, pay_total, change } = payload;
  const head = [
    `Дэлгүүр: ${store?.name ?? ""}`,
    `Захиалга #${order.order_no}`,
    dateLocal(order.created_at),
  ].filter(Boolean);

  const items = lines.map((l) => {
    const qtyPrice = `${l.qty} x ${money(l.unit_price)}`;
    const total = money(l.line_total);
    const name = l.product_name
      ? `${l.product_name}${l.name ? ` (${l.name})` : ""}`
      : l.name ?? "Бараа";
    return [padRight(name), lineLR(qtyPrice, total)].join("\n");
  });

  const payLines = payments.map((p) =>
    lineLR(`Төлбөрийн хэлбэр: (${p.method})`, money(p.amount))
  );

  const body = [
    head[0],
    lineLR(head[1], ""),
    head[2],
    dash(),
    ...items,
    dash(),
    lineLR("Дэд дүн", money(order.subtotal)),
    ...(order.discount
      ? [lineLR("Хөнгөлөлт", `- ${money(order.discount)}`)]
      : []),
    ...(order.tax ? [lineLR("Татвар", money(order.tax))] : []),
    lineLR("НИЙТ", money(order.total)),
    dash(),
    ...payLines,
    lineLR("Төлсөн дүн", money(pay_total)),
    lineLR("Хариулт", money(change)),
    "",
    "ТАНД БАЯРЛАЛАА!",
    "",
  ];
  return body.join("\n") + "\n";
}

// --------------- Rich layout (canvas only for rasterizing) ---------------
const PX = { w: 384, margin: 16 };
const FNT = {
  header: { size: 28, weight: "700" },
  body: { size: 18, weight: "400" },
  small: { size: 16, weight: "400" },
  bold: { size: 18, weight: "700" },
  total: { size: 22, weight: "800" },
};
function setFont(ctx: CanvasRenderingContext2D, size: number, weight = "400") {
  ctx.font = `${weight} ${size}px system-ui, "Noto Sans", Arial`;
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function drawDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number
) {
  const seg = 6,
    gap = 4;
  let cx = x;
  ctx.beginPath();
  while (cx < x + w) {
    ctx.moveTo(cx, y + 0.5);
    ctx.lineTo(Math.min(cx + seg, x + w), y + 0.5);
    cx += seg + gap;
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}
function drawKeyVal(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  x: number,
  w: number,
  bold = false
) {
  const colL = x,
    colR = x + w;
  setFont(ctx, FNT.body.size, bold ? FNT.bold.weight : FNT.body.weight);
  ctx.textAlign = "left";
  ctx.fillText(label, colL, y);
  ctx.textAlign = "right";
  ctx.fillText(value, colR, y);
}
function moneyMN(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}

async function renderReceiptCanvas(payload: ReceiptPayload) {
  const { order, store, lines, payments } = payload;

  const scratch = document.createElement("canvas");
  scratch.width = PX.w;
  scratch.height = 3000; // oversize
  const ctx = scratch.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "top";
  const x = PX.margin;
  const innerW = PX.w - PX.margin * 2;
  let y = PX.margin + 8;

  // Header (no logo image)
  setFont(ctx, FNT.header.size, FNT.header.weight);
  ctx.textAlign = "center";
  ctx.fillText(store?.name || "СОЛДАТ", PX.w / 2, y);
  y += FNT.header.size + 12;

  // Order meta
  setFont(ctx, FNT.body.size);
  ctx.textAlign = "left";
  drawKeyVal(
    ctx,
    `Захиалга #${order.order_no}`,
    new Date(order.created_at).toLocaleString(),
    y,
    x,
    innerW
  );
  y += 18;
  drawDivider(ctx, x, y, innerW);
  y += 12;

  // Table header
  setFont(ctx, FNT.bold.size, FNT.bold.weight);
  ctx.textAlign = "left";
  ctx.fillText("Бараа", x, y);
  ctx.textAlign = "center";
  ctx.fillText("Тоо×Үнэ", x + innerW - 140, y);
  ctx.textAlign = "right";
  ctx.fillText("Дүн", x + innerW, y);
  y += 25;
  drawDivider(ctx, x, y, innerW);
  y += 12;

  // Items
  setFont(ctx, FNT.body.size);
  for (const l of lines) {
    const name = l.product_name
      ? `${l.product_name}${l.name ? ` (${l.name})` : ""}`
      : l.name ?? "Бараа";
    const nameW = innerW - 150;
    ctx.textAlign = "left";
    const nameLines = wrapText(ctx, name, nameW);
    for (let i = 0; i < nameLines.length; i++) {
      const yy = y + i * 20;
      ctx.fillText(nameLines[i], x, yy);
      if (i === 0) {
        const qtyPrice = `${l.qty} × ${moneyMN(l.unit_price)}`;
        ctx.textAlign = "center";
        ctx.fillText(qtyPrice, x + innerW - 140, yy);
        ctx.textAlign = "right";
        ctx.fillText(moneyMN(l.line_total), x + innerW, yy);
      }
    }
    y += nameLines.length * 20;

    if (l.sku) {
      setFont(ctx, FNT.small.size);
      ctx.textAlign = "left";
      ctx.fillText(`SKU: ${l.sku}`, x, y);
      setFont(ctx, FNT.body.size);
      y += 18;
    }

    drawDivider(ctx, x, y, innerW);
    y += 10;
  }

  // Summary
  y += 2;
  if (order.discount) {
    drawKeyVal(ctx, "Хөнгөлөлт", `- ${moneyMN(order.discount)}`, y, x, innerW);
    y += 20;
  }
  if (order.tax) {
    drawKeyVal(ctx, "Татвар", moneyMN(order.tax), y, x, innerW);
    y += 20;
  }
  setFont(ctx, FNT.total.size, FNT.total.weight);
  drawKeyVal(ctx, "НИЙТ", moneyMN(order.total), y, x, innerW, true);
  y += 20;
  drawDivider(ctx, x, y, innerW);
  y += 14;

  // Payments
  setFont(ctx, FNT.bold.size, FNT.bold.weight);
  ctx.textAlign = "left";
  ctx.fillText("Төлбөр", x, y);
  y += 22;
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
  ctx.textAlign = "center";
  ctx.fillText("ТАНД БАЯРЛАЛАА!", PX.w / 2, y);
  y += 20;

  // Crop
  const final = document.createElement("canvas");
  final.width = PX.w;
  final.height = y + PX.margin + 20;
  final
    .getContext("2d")!
    .drawImage(scratch, 0, 0, PX.w, final.height, 0, 0, PX.w, final.height);
  return final;
}

// --------------- ESC/POS raster (GS v 0) ---------------
function canvasToEscPosRaster(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;

  const bytesPerRow = Math.ceil(width / 8);
  const mono = new Uint8Array(bytesPerRow * height);
  const threshold = 160;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = img[i],
        g = img[i + 1],
        b = img[i + 2];
      const v = (r * 299 + g * 587 + b * 114) / 1000;
      const bit = v < threshold ? 1 : 0;
      if (bit) mono[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  const init = [0x1b, 0x40]; // ESC @
  const raster = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]; // GS v 0 m=0
  const feedCut = [0x1b, 0x64, 0x02, 0x1d, 0x56, 0x00]; // feed 2, full cut

  const out = new Uint8Array(
    init.length + raster.length + mono.length + feedCut.length
  );
  out.set(init, 0);
  out.set(raster, init.length);
  out.set(mono, init.length + raster.length);
  out.set(feedCut, init.length + raster.length + mono.length);
  return out;
}

// --------------- Type declarations ---------------
// USB Device interface (Serial interface-г web-serial.d.ts-ээс ирнэ)
interface USBDevice {
  vendorId: number;
  productId: number;
  configuration: any;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface?(interfaceNumber: number, alternateSetting: number): Promise<void>;
  transferOut(endpointNumber: number, data: ArrayBuffer): Promise<any>;
}

// --------------- Binary helpers ---------------
const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
};

// --------------- Print paths: Web Serial → WebUSB → Download/Share ---------------
async function printViaWebSerial(bytes: Uint8Array) {
  let port: SerialPort | null = null;
  
  // Хадгалагдсан port байгаа эсэхийг шалгах
  const savedPortInfo = localStorage.getItem('printer_serial_port');
  if (savedPortInfo) {
    try {
      // @ts-ignore
      const ports = await navigator.serial?.getPorts?.();
      if (ports && ports.length > 0) {
        port = ports[0]; // Эхний port-г ашиглах
      }
    } catch (e) {
      console.log('Saved port not available:', e);
    }
  }
  
  // Хэрэв хадгалагдсан port байхгүй бол шинээр сонгох
  if (!port) {
    // @ts-ignore
    port = await navigator.serial?.requestPort?.();
    if (!port) throw new Error("Web Serial not available");
    
    // Port-ийн мэдээллийг хадгалах
    localStorage.setItem('printer_serial_port', 'connected');
  }
  
  await port.open({ baudRate: 9600 });
  const w = port.writable!.getWriter();
  await w.write(bytes); // ✅ ArrayBuffer
  w.releaseLock();
  await port.close();
}

async function printViaWebUSB(bytes: Uint8Array) {
  // @ts-ignore
  const usb: USB = navigator.usb;
  if (!usb?.requestDevice) throw new Error("WebUSB not available");

  let device: USBDevice | null = null;
  
  // Хадгалагдсан USB device байгаа эсэхийг шалгах
  const savedUSBInfo = localStorage.getItem('printer_usb_device');
  if (savedUSBInfo) {
    try {
      // @ts-ignore
      const devices = await usb.getDevices();
      if (devices && devices.length > 0) {
        device = devices[0]; // Эхний device-г ашиглах
      }
    } catch (e) {
      console.log('Saved USB device not available:', e);
    }
  }
  
  // Хэрэв хадгалагдсан device байхгүй бол шинээр сонгох
  if (!device) {
    // @ts-ignore
    device = await usb.requestDevice({ filters: [] });
    if (!device) throw new Error("WebUSB device not selected");
    
    // Device-ийн мэдээллийг хадгалах
    localStorage.setItem('printer_usb_device', JSON.stringify({
      vendorId: device.vendorId,
      productId: device.productId
    }));
  }
  
  await device.open();
  if (!device.configuration) await device.selectConfiguration(1);

  // @ts-ignore
  const iface = device.configuration.interfaces.find((i: any) =>
    i.alternates.some((a: any) =>
      a.endpoints.some((e: any) => e.direction === "out")
    )
  );
  if (!iface) throw new Error("No OUT endpoint");
  // @ts-ignore
  const alt = iface.alternates.find((a: any) =>
    a.endpoints.some((e: any) => e.direction === "out")
  );
  const ifaceNum = iface.interfaceNumber;
  // @ts-ignore
  const outEp = alt.endpoints.find(
    (e: any) => e.direction === "out"
  ).endpointNumber;

  await device.claimInterface(ifaceNum);
  // @ts-ignore
  if (device.selectAlternateInterface)
    await device.selectAlternateInterface(ifaceNum, alt.alternateSetting);
  await device.transferOut(outEp, toArrayBuffer(bytes)); // ✅ ArrayBuffer
  try {
    await device.close();
  } catch {
    /* no-op */
  }
}

function downloadOrShare(bytes: Uint8Array, filename = "receipt.escpos") {
  const buf = toArrayBuffer(bytes);
  const blob = new Blob([buf], { type: "application/octet-stream" });
  const file = new File([blob], filename, { type: "application/octet-stream" });
  // @ts-ignore
  if (navigator.canShare?.({ files: [file] })) {
    // @ts-ignore
    return navigator.share?.({ files: [file], title: "Receipt (ESC/POS)" });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    a.remove();
  }
}

// --------------- Edge Function fetcher ---------------
async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}
async function fetchReceipt(orderId: string): Promise<ReceiptPayload> {
  const token = await getAccessToken();
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];
  if (!tenant_id) throw new Error("No tenant in token");

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt`
  );
  url.searchParams.set("tenant_id", tenant_id);
  url.searchParams.set("kind", "order");
  url.searchParams.set("id", orderId);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Receipt fetch failed: ${res.status}`);
  return res.json();
}

// --------------- Inner Page (must be inside Suspense) ---------------
function ReceiptPageInner() {
  const sp = useSearchParams(); // ✅ inside Suspense
  const router = useRouter();
  const orderId = sp.get("orderId") || "";

  const [payload, setPayload] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  // Хадгалагдсан төхөөрөмжийн статус
  const hasSavedSerial = !!localStorage.getItem('printer_serial_port');
  const hasSavedUSB = !!localStorage.getItem('printer_usb_device');

  useEffect(() => {
    (async () => {
      if (!orderId) return;
      setLoading(true);
      setErr(null);
      try {
        const p = await fetchReceipt(orderId);
        setPayload(p);
      } catch (e: any) {
        setErr(e?.message || "Failed to load receipt");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const receiptText = useMemo(
    () => (payload ? buildReceiptText(payload) : ""),
    [payload]
  );

  const onPrint = async () => {
    if (!payload) return;
    try {
      const canvas = await renderReceiptCanvas(payload);
      const bytes = canvasToEscPosRaster(canvas);

      try {
        await printViaWebSerial(bytes);
        alert("Хэвлэгдлээ (Web Serial).");
        // Хэвлэсний дараа dashboard руу шилжих
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      } catch {}
      try {
        await printViaWebUSB(bytes);
        alert("Хэвлэгдлээ (WebUSB).");
        // Хэвлэсний дараа dashboard руу шилжих
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      } catch {}

      await downloadOrShare(bytes);
      alert(
        "Төхөөрөмжтэй шууд холбогдож чадсангүй. .escpos файлыг татаж/шэйрлэж хэвлэнэ үү."
      );
      // Файл татсаны дараа ч dashboard руу шилжих
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (e) {
      console.error(e);
      alert(
        "Хэвлэх боломжгүй. Зөвшөөрөл/драйвер/кабелиа шалгаад дахин оролдоно уу."
      );
    }
  };

  const onDownload = async () => {
    if (!payload) return;
    const canvas = await renderReceiptCanvas(payload);
    const bytes = canvasToEscPosRaster(canvas);
    downloadOrShare(bytes);
    // Файл татсаны дараа dashboard руу шилжих
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  const clearSavedDevices = () => {
    localStorage.removeItem('printer_serial_port');
    localStorage.removeItem('printer_usb_device');
    alert('Хадгалагдсан хэвлэгчийн мэдээлэл устгагдлаа. Дараа дахин сонгоно уу.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Буцах
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Квитанц хэвлэх</h1>
                <p className="text-gray-500">Борлуулалтын баримт хэвлэх</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error States */}
        {!orderId && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Захиалгын ID байхгүй</h3>
                <p className="text-red-600">URL-д <code className="bg-red-100 px-1 rounded">?orderId=...</code> параметр нэмнэ үү.</p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-700">Квитанц ачаалж байна...</span>
              </div>
            </div>
          </div>
        )}

        {err && (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Алдаа гарлаа</h3>
                <p className="text-red-600">{err}</p>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Content */}
        {payload && (
          <div className="space-y-6">
            {/* Receipt Info */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Квитанцын мэдээлэл</h2>
                  <p className="text-gray-500">Захиалгын дэлгэрэнгүй</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">#{payload.order.order_no}</div>
                  <div className="text-sm text-gray-500">Захиалгын дугаар</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{payload.store.name}</div>
                    <div className="text-sm text-gray-500">Дэлгүүр</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{moneyMN(payload.order.total)}</div>
                    <div className="text-sm text-gray-500">Нийт дүн</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Printer Status */}
            {(hasSavedSerial || hasSavedUSB) && (
              <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Хэвлэгч холбогдсон</h3>
                    <p className="text-green-600">
                      Хадгалагдсан: 
                      {hasSavedSerial && " Serial"}
                      {hasSavedSerial && hasSavedUSB && ","}
                      {hasSavedUSB && " USB"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Хэвлэх сонголтууд</h3>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={onPrint}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Шууд хэвлэх</div>
                    <div className="text-sm opacity-90">Serial/USB холболт</div>
                  </div>
                </button>
                
                <button
                  onClick={onDownload}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">Файл татах</div>
                    <div className="text-sm opacity-90">ESC/POS формат</div>
                  </div>
                </button>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={clearSavedDevices}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200"
                  title="Хадгалагдсан хэвлэгчийн мэдээллийг устгах"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Төхөөрөмж сэргээх
                </button>
              </div>
            </div>

            {/* Receipt Preview */}
            <details className="bg-white rounded-2xl shadow-lg border border-gray-200">
              <summary className="cursor-pointer select-none p-6 hover:bg-gray-50 rounded-t-2xl transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-gray-900">Квитанцын текст үзэх</span>
                  <span className="text-sm text-gray-500">(Debug)</span>
                </div>
              </summary>
              <div className="border-t border-gray-200 p-6">
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-lg p-4 overflow-x-auto font-mono">
                  {receiptText}
                </pre>
              </div>
            </details>

            {/* Help Info */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Хэвлэх заавар</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>Web Serial:</strong> Desktop/Android Chrome/Edge дээр ажиллана</p>
                    <p>• <strong>iOS/Safari:</strong> ESC/POS файл татаж vendor апп ашиглана уу</p>
                    <p>• <strong>Vendor apps:</strong> Gprinter, RawBT гэх мэт</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------- Outer Page (Suspense wrapper, no hooks) ---------------
export default function Page() {
  return (
    <Suspense fallback={<main className="p-6 max-w-lg">Уншиж байна…</main>}>
      <ReceiptPageInner />
    </Suspense>
  );
}
