import { jwtDecode } from "jwt-decode";

type Payment = { method: string; amount: number };

export async function postCheckout(
  token: string,
  store_id: string,
  variant_id: string,
  quantity: number,
  price: number,
  method: Payment[],
  discount = 0,
  tax = 0
) {
  const decoded: any = jwtDecode(token);
  const tenant_id = decoded?.app_metadata?.tenants?.[0];

  const amount = quantity * price;
  const payments = method.map((m) => ({ method: m.method, amount: m.amount }));
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  if (paid !== amount) {
    throw new Error(`Төлсөн (${paid}) нийт дүнтэй (${amount}) тэнцэхгүй`);
  }

  const payload = {
    tenant_id,
    store_id,
    items: [{ variant_id, quantity, unit_price: price }],
    payments,
    discount,
    tax,
  };

  const url = new URL(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/checkout`
  );

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
}
