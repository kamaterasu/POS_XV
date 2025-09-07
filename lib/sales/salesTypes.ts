export type Item = {
  id: string;
  variant_id?: string; // Add variant_id field for backend mapping
  name: string;
  qty: number;
  price: number;
  imgPath: string;
  color?: string;
  size?: string;
};

export type Draft = {
  id: string; // timestamp эсвэл uuid
  title: string; // ж: "Захиалга - 12:30"
  items: Item[];
  createdAt: string; // ISO
  notes?: string;
};

export type PaymentRow = {
  method: "cash" | "card" | "qpay" | "wallet" | "other";
  amount: number;
  ref?: string;
};

export type QuickActions = {
  discountPercent: number; // 0..100
  includeVAT: boolean; // НӨАТ 10%
  deliveryFee: number; // хүргэлт
};
