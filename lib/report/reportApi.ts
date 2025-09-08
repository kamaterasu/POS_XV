import { supabase } from '../supabaseClient';
import { getTenantId } from '../helper/getTenantId';

const REPORT_API_URL = 'https://kaaszzouxgbyusxbobdx.supabase.co/functions/v1/report';

// Types for API responses
export interface SalesSummaryItem {
  period: string;
  orders: number;
  subtotal_gross: number;
  discount_gross: number;
  tax_gross: number;
  total_gross: number;
  returns_qty: number;
  returns_value: number;
  refunds_value: number;
  total_net: number;
  aov_gross: number;
  aov_net: number;
}

export interface SalesByStoreItem {
  store_id: string;
  store_name: string | null;
  orders: number;
  subtotal_gross: number;
  discount_gross: number;
  tax_gross: number;
  total_gross: number;
  returns_value: number;
  total_net: number;
}

export interface PaymentsByMethodItem {
  method: string;
  amount: number;
  count: number;
}

export interface TopVariantItem {
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  product_id: string | null;
  product_name: string | null;
  sold_qty: number;
  sold_revenue: number;
  returned_qty: number;
  return_value: number;
  net_qty: number;
  net_revenue: number;
}

export interface CategorySummaryItem {
  category_id: string | null;
  category_name: string | null;
  sold_qty: number;
  sold_revenue: number;
  returned_qty: number;
  return_value: number;
  net_qty: number;
  net_revenue: number;
}

export interface InventorySnapshotItem {
  store_id?: string;
  variant_id: string;
  sku: string | null;
  variant_name: string | null;
  product_id: string | null;
  product_name: string | null;
  qty: number;
  cost: number;
  value: number;
}

export interface ReturnsSummaryItem {
  period: string;
  qty: number;
  returns_value: number;
  refunds_value: number;
}

// Helper function to get authorization headers
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

// Helper function to make API requests
async function makeReportRequest<T>(params: Record<string, string>): Promise<T> {
  const headers = await getAuthHeaders();
  const tenant_id = await getTenantId();
  
  if (!tenant_id) {
    throw new Error('No tenant ID available');
  }

  const searchParams = new URLSearchParams({
    tenant_id,
    ...params
  });

  const response = await fetch(`${REPORT_API_URL}?${searchParams}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Sales Summary Report
export async function getSalesSummary(params: {
  period?: 'day' | 'week' | 'month';
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    period: string;
    tz: string;
    from: string;
    to: string;
    items: SalesSummaryItem[];
    totals: SalesSummaryItem;
  }>({
    type: 'sales_summary',
    period: params.period || 'day',
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Sales by Store Report
export async function getSalesByStore(params: {
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    items: SalesByStoreItem[];
  }>({
    type: 'sales_by_store',
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Payments by Method Report
export async function getPaymentsByMethod(params: {
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    payments: PaymentsByMethodItem[];
    refunds: PaymentsByMethodItem[];
    net_by_method: Array<{
      method: string;
      sales: number;
      refunds: number;
      net: number;
    }>;
  }>({
    type: 'payments_by_method',
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Top Variants Report
export async function getTopVariants(params: {
  limit?: number;
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    limit: number;
    items: TopVariantItem[];
  }>({
    type: 'top_variants',
    limit: (params.limit || 10).toString(),
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Category Summary Report
export async function getCategorySummary(params: {
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    items: CategorySummaryItem[];
  }>({
    type: 'category_summary',
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Inventory Snapshot Report
export async function getInventorySnapshot(params: {
  store_id?: string;
  only_in_stock?: boolean;
}) {
  return makeReportRequest<{
    type: string;
    scope: string;
    store_id?: string | null;
    items: InventorySnapshotItem[];
    totals: {
      qty: number;
      value: number;
    };
  }>({
    type: 'inventory_snapshot',
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.only_in_stock !== undefined && { only_in_stock: params.only_in_stock.toString() }),
  });
}

// Returns Summary Report
export async function getReturnsSummary(params: {
  period?: 'day' | 'week' | 'month';
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    period: string;
    tz: string;
    from: string;
    to: string;
    items: ReturnsSummaryItem[];
    totals: {
      qty: number;
      returns_value: number;
      refunds_value: number;
    };
  }>({
    type: 'returns_summary',
    period: params.period || 'day',
    ...(params.store_id && { store_id: params.store_id }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Returns by Store Report
export async function getReturnsByStore(params: {
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    items: Array<{
      store_id: string;
      store_name: string | null;
      qty: number;
      returns_value: number;
    }>;
  }>({
    type: 'returns_by_store',
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Refunds by Method Report
export async function getRefundsByMethod(params: {
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    items: Array<{
      method: string;
      amount: number;
      count: number;
    }>;
  }>({
    type: 'refunds_by_method',
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Top Returned Variants Report
export async function getTopReturnedVariants(params: {
  limit?: number;
  from?: string;
  to?: string;
}) {
  return makeReportRequest<{
    type: string;
    from: string;
    to: string;
    limit: number;
    items: Array<{
      variant_id: string;
      sku: string | null;
      variant_name: string | null;
      product_id: string | null;
      product_name: string | null;
      returned_qty: number;
      return_value: number;
    }>;
  }>({
    type: 'top_returned_variants',
    limit: (params.limit || 10).toString(),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
  });
}

// Utility function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('mn-MN', {
    style: 'currency',
    currency: 'MNT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('MNT', '₮');
}

// Utility function to format percentage
export function formatPercentage(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}
