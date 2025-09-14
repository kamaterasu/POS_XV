import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getCheckoutOrders,
  getCheckout,
  createCheckoutOrder
} from '../checkout/checkoutApi';
import { postCheckout } from '../sales/salesApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

// Query hooks
export function useCheckoutOrders(storeId?: string, limit: number = 20, offset: number = 0) {
  return useQuery({
    queryKey: [...queryKeys.checkoutOrders(storeId), limit, offset],
    queryFn: () => getCheckoutOrders(storeId, limit, offset),
  });
}

export function useCheckout(storeId: string) {
  return useQuery({
    queryKey: queryKeys.checkout(storeId),
    queryFn: async () => {
      const token = await getAccessToken();
      return getCheckout(token, storeId);
    },
    enabled: !!storeId,
  });
}

// Mutation hooks
export function useCreateCheckout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (checkoutData: {
      store_id: string;
      variant_id: string;
      quantity: number;
      price: number;
      method: any[];
      discount?: number;
      tax?: number;
    }) => {
      const token = await getAccessToken();
      return postCheckout(
        token,
        checkoutData.store_id,
        checkoutData.variant_id,
        checkoutData.quantity,
        checkoutData.price,
        checkoutData.method,
        checkoutData.discount || 0,
        checkoutData.tax || 0
      );
    },
    onSuccess: (data, variables) => {
      // Invalidate checkout-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.checkoutOrders() });
      queryClient.invalidateQueries({ queryKey: queryKeys.checkout(variables.store_id) });
    },
  });
}

export function useCreateCheckoutOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: {
      items: Array<{ variantId: string; qty: number; price: number }>;
      payments: any[];
      opts?: { discount?: number; tax?: number };
      store_id?: string;
    }) => {
      return createCheckoutOrder(
        orderData.items,
        orderData.payments,
        orderData.opts,
        orderData.store_id
      );
    },
    onSuccess: () => {
      // Invalidate checkout orders
      queryClient.invalidateQueries({ queryKey: queryKeys.checkoutOrders() });
    },
  });
}