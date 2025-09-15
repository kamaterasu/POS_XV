"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getOrderById } from "@/lib/order/orderApi";

type Item = { name: string; qty: number; price: number };

function WebSerialPrinterContent() {
  const portRef = useRef<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [baud, setBaud] = useState(9600); // 9600 эсвэл 115200
  const [text, setText] = useState(
    "Сайн байна уу?\nPOS_X хэвлэл тест\nНийт: 5000₮"
  );
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sp = useSearchParams();
  const orderId = sp.get("orderId") || "";

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setErr(null);
    getOrderById(orderId)
      .then(setOrder)
      .catch((e) => setErr(e?.message || "Order fetch error"))
      .finally(() => setLoading(false));
  }, [orderId]);

  async function connect() {
    if (!("serial" in navigator)) {
      alert("Таны браузер Web Serial API дэмжихгүй байна. Chrome ашиглана уу.");
      return;
    }
    const ports = await navigator.serial.getPorts();
    let port = ports[0];
    if (!port) {
      port = await navigator.serial.requestPort();
    }
    // Давхар open() дуудагдахаас сэргийлнэ
    if (!port.readable || !port.writable) {
      await port.open({ baudRate: baud });
    }
    portRef.current = port;
    setConnected(true);
  }
  async function write(data: Uint8Array | number[] | string) {
    const port = portRef.current!;
    const writer = port.writable!.getWriter();
    const buf =
      typeof data === "string"
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
        ? data
        : Uint8Array.from(data);
    await writer.write(buf);
    writer.releaseLock();
  }

  // === Canvas->Raster хэвлэл (кирилл найдвартай) ===
  async function printCanvas(t: string) {
    const W = 384; // 58мм принтерийн өргөн
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const lines = t.split("\n");
    const lineH = 28;
    canvas.width = W;
    canvas.height = lineH * lines.length + 20;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";
    lines.forEach((ln, i) => ctx.fillText(ln, 0, 24 + i * lineH));

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bytesPerRow = Math.ceil(img.width / 8);
    const raster = new Uint8Array(bytesPerRow * img.height);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const lum =
          0.299 * img.data[i] +
          0.587 * img.data[i + 1] +
          0.114 * img.data[i + 2];
        if (lum < 160) raster[y * bytesPerRow + (x >> 3)] |= 1 << (7 - (x & 7));
      }
    }
    const xL = bytesPerRow & 0xff,
      xH = (bytesPerRow >> 8) & 0xff;
    const yL = img.height & 0xff,
      yH = (img.height >> 8) & 0xff;

    await write([0x1b, 0x40]); // init
    await write([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]); // GS v 0
    await write(raster);
    await write("\n\n\n"); // portable загварт cut ихэнхдээ байхгүй
  }

  // ЖИШЭЭ БАРИМТ — items -> текст -> canvas хэвлэх
  async function printReceipt(items: Item[]) {
    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    const pad = (s: string, n: number) =>
      s.length > n ? s.slice(0, n) : s.padEnd(n);
    const num = (v: number, n: number) => String(v).padStart(n);

    const lines = [
      "POS_X / Туршилт",
      "------------------------------",
      ...items.map((it) => {
        const amt = it.qty * it.price;
        return `${pad(it.name, 12)} ${num(it.qty, 2)} x${num(
          it.price,
          6
        )} = ${num(amt, 7)}`;
      }),
      "------------------------------",
      `Нийт: ${total}₮`,
      "",
    ];
    await printCanvas(lines.join("\n"));
  }

  async function printOrderReceipt() {
    if (!order) return;
    const pad = (s: string, n: number) =>
      s.length > n ? s.slice(0, n) : s.padEnd(n);
    const num = (v: number, n: number) => String(v).padStart(n);
    const lines = [
      `Дэлгүүр: ${order.store_id}`,
      `Захиалга #${order.id}`,
      `Огноо: ${order.created_at}`,
      "------------------------------",
      ...order.items.map((it: any) => {
        const amt = it.quantity * it.unit_price;
        return `${pad(it.product_name || "", 12)} ${num(it.quantity, 2)} x${num(
          it.unit_price,
          6
        )} = ${num(amt, 7)}`;
      }),
      "------------------------------",
      `Нийт: ${order.total}₮`,
      "",
    ];
    await printCanvas(lines.join("\n"));
  }

  async function disconnect() {
    try {
      await portRef.current?.close();
    } finally {
      setConnected(false);
    }
  }
  const onBaudChange = (e: ChangeEvent<HTMLInputElement>) =>
    setBaud(Number(e.target.value));

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
        Receipt Printer
      </h1>

      <div className="mb-6 p-4 bg-gray-50 rounded-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Baud Rate:
        </label>
        <input
          type="number"
          value={baud}
          onChange={onBaudChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {!connected ? (
        <button
          onClick={connect}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition duration-200 ease-in-out transform hover:scale-105"
        >
          🖨️ Принтер холбох
        </button>
      ) : (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center p-4 bg-blue-50 rounded-md">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-700">
                Захиалгын мэдээлэл ачааллаж байна…
              </span>
            </div>
          )}

          {err && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <span className="text-red-800">⚠️ {err}</span>
              </div>
            </div>
          )}

          {order && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="text-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">
                  📄 Захиалгын мэдээлэл
                </h2>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="text-sm font-medium text-gray-600">
                    Захиалга:
                  </span>
                  <span className="text-sm font-mono text-gray-800">
                    #{order.id}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="text-sm font-medium text-gray-600">
                    Дэлгүүр:
                  </span>
                  <span className="text-sm text-gray-800">
                    {order.store_id}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-white rounded border">
                  <span className="text-sm font-medium text-gray-600">
                    Огноо:
                  </span>
                  <span className="text-sm text-gray-800">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  📦 Бүтээгдэхүүн:
                </h3>
                <div className="bg-white rounded-md border border-gray-200">
                  {order.items.map((it: any, idx: number) => (
                    <div
                      key={it.id || idx}
                      className={`flex justify-between items-center p-3 ${
                        idx !== order.items.length - 1
                          ? "border-b border-gray-100"
                          : ""
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">
                          {it.product_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {it.quantity} × {it.unit_price.toLocaleString()}₮
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-800">
                        {(it.quantity * it.unit_price).toLocaleString()}₮
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-gray-300 pt-4 mb-6">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-md">
                  <span className="text-lg font-bold text-gray-800">
                    💰 Нийт дүн:
                  </span>
                  <span className="text-xl font-bold text-green-700">
                    {order.total.toLocaleString()}₮
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={printOrderReceipt}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md transition duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center"
                >
                  🖨️ Баримт хэвлэх
                </button>
                <button
                  onClick={disconnect}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center"
                >
                  ❌ Салгах
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WebSerialPrinter() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WebSerialPrinterContent />
    </Suspense>
  );
}
