export type Mode = 'view' | 'count' | 'transfer' | 'receive' | 'create';

export type Product = {
  id: string;
  name: string;
  qty: number;
  price: number;
  imgPath?: string;
};

export type Variant = {
  id: string;
  color?: string;
  size?: string;
  sku?: string;
  barcode?: string;
  price?: number;
};

export type IncomingLine = {
  lineId: string;
  productId: string;
  name: string;
  imgPath?: string;
  expectedQty: number;
};

export type IncomingTransfer = {
  id: string;
  from: string;
  createdAt: string;
  note?: string;
  items: IncomingLine[];
};
