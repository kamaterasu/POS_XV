import { useQuery } from '@tanstack/react-query';
import { 
  getSalesSummary,
  getSalesByStore,
  getPaymentsByMethod,
  getTopVariants,
  getCategorySummary,
  getInventorySnapshot,
  getReturnsSummary
} from '../report/reportApi';
import { queryKeys } from './queryKeys';

// Sales Summary Report
export function useSalesSummary(params: {
  period?: "day" | "week" | "month";
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.salesSummary(params),
    queryFn: () => getSalesSummary(params),
    enabled: !!params,
  });
}

// Sales by Store Report
export function useSalesByStore(params: {
  period?: "day" | "week" | "month";
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.salesByStore(params),
    queryFn: () => getSalesByStore(params),
    enabled: !!params,
  });
}

// Payments by Method Report
export function usePaymentsByMethod(params: {
  period?: "day" | "week" | "month";
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.paymentsByMethod(params),
    queryFn: () => getPaymentsByMethod(params),
    enabled: !!params,
  });
}

// Top Variants Report
export function useTopVariants(params: {
  period?: "day" | "week" | "month";
  store_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.topVariants(params),
    queryFn: () => getTopVariants(params),
    enabled: !!params,
  });
}

// Category Summary Report
export function useCategorySummary(params: {
  period?: "day" | "week" | "month";
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.categorySummary(params),
    queryFn: () => getCategorySummary(params),
    enabled: !!params,
  });
}

// Inventory Snapshot Report
export function useInventorySnapshot(params: {
  store_id?: string;
  category_id?: string;
  low_stock_threshold?: number;
}) {
  return useQuery({
    queryKey: queryKeys.inventorySnapshot(params),
    queryFn: () => getInventorySnapshot(params),
    enabled: !!params,
  });
}

// Returns Summary Report
export function useReturnsSummary(params: {
  period?: "day" | "week" | "month";
  store_id?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: queryKeys.returnsSummary(params),
    queryFn: () => getReturnsSummary(params),
    enabled: !!params,
  });
}