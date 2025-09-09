'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { getOrderById } from '@/lib/order/orderApi';
import { useRef, useState, type ChangeEvent } from 'react';

type Item = { name: string; qty: number; price: number };

export default function WebSerialPrinter() {
  const portRef = useRef<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [baud, setBaud] = useState(9600); // 9600 эсвэл 115200
  const [text, setText] = useState(
    'Сайн байна уу?\nPOS_X хэвлэл тест\nНийт: 5000₮'
  );

  async function connect() {
    if (!('serial' in navigator)) {
      alert('Таны браузер Web Serial API дэмжихгүй байна. Chrome ашиглана уу.');
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
      typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
        ? data
        : Uint8Array.from(data);
    await writer.write(buf);
    writer.releaseLock();
  }

  // === Canvas->Raster хэвлэл (кирилл найдвартай) ===
  async function printCanvas(t: string) {
    const W = 384;                         // 58мм принтерийн өргөн
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const lines = t.split('\n');
    const lineH = 28;
    canvas.width = W;
    canvas.height = lineH * lines.length + 20;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000'; ctx.font = '20px Arial';
    lines.forEach((ln, i) => ctx.fillText(ln, 0, 24 + i * lineH));

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bytesPerRow = Math.ceil(img.width / 8);
    const raster = new Uint8Array(bytesPerRow * img.height);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        if (lum < 160) raster[y * bytesPerRow + (x >> 3)] |= 1 << (7 - (x & 7));
      }
    }
    const xL = bytesPerRow & 0xff, xH = (bytesPerRow >> 8) & 0xff;
    const yL = img.height & 0xff, yH = (img.height >> 8) & 0xff;

    await write([0x1b, 0x40]); // init
    await write([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]); // GS v 0
    await write(raster);
    await write('\n\n\n'); // portable загварт cut ихэнхдээ байхгүй
  }
  
  // ЖИШЭЭ БАРИМТ — items -> текст -> canvas хэвлэх
  async function printReceipt(items: Item[]) {
    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    const pad = (s: string, n: number) => s.length > n ? s.slice(0, n) : s.padEnd(n);
    const num = (v: number, n: number) => String(v).padStart(n);

    const lines = [
      'POS_X / Туршилт',
      '------------------------------',
      ...items.map(it => {
        const amt = it.qty * it.price;
        return `${pad(it.name, 12)} ${num(it.qty,2)} x${num(it.price,6)} = ${num(amt,7)}`;
      }),
      '------------------------------',
      `Нийт: ${total}₮`,
      ''
    ];
    await printCanvas(lines.join('\n'));
  }

  async function disconnect() {
    try { await portRef.current?.close(); } finally { setConnected(false); }
  }
  const onBaudChange = (e: ChangeEvent<HTMLInputElement>) =>
    setBaud(Number(e.target.value));

  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <label>Baud: <input type="number" value={baud} onChange={onBaudChange} /></label>

      {!connected ? (
        <button onClick={connect}>Принтер холбох</button>
      ) : (
        <>
          <textarea rows={5} value={text} onChange={e => setText(e.target.value)} />
          <button onClick={() => printCanvas(text)}>Текст хэвлэх (Кирилл OK)</button>
          <button
            onClick={() =>
              printReceipt([
                { name: 'Цай', qty: 2, price: 1000 },
                { name: 'Сахар', qty: 1, price: 2000 }
              ])
            }
          >
            Жишээ баримт хэвлэх
          </button>
          <button onClick={disconnect}>Салгах</button>
        </>
      )}
    </div>
  );
}
