// =============================================
// FILE: lib/inventory/inventoryTypes.ts
// Type definitions for inventory/product management
// =============================================

export type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  cost?: number;
  qty: number;
  img?: string;
  description?: string;
  category_id?: string;
  variants?: Variant[];
  rawImg?: string; // For image URL resolution
};

export type Variant = {
  id: string;
  name?: string;
  sku?: string;
  price: number;
  cost?: number;
  qty: number;
  attrs?: Record<string, any>;
  rawImg?: string;
};

export type Mode = "view" | "edit" | "create" | "count" | "transfer" | "receive";

export type IncomingTransferItem = {
  lineId: string;
  name: string;
  expectedQty: number;
  imgPath?: string;
};

export type IncomingTransfer = {
  id: string;
  from: string;
  to?: string;
  status: string;
  createdAt?: string;
  transferredAt?: string;
  note?: string;
  items: IncomingTransferItem[];
};
