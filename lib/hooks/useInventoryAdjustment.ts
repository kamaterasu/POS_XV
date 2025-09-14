import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productAddToInventory } from '../inventory/inventoryApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

export interface InventoryAdjustmentData {
  store_id: string;
  variant_id: string;
  delta: number;
  reason?: "INITIAL" | "PURCHASE" | "ADJUSTMENT";
  note?: string;
  ref_table?: string;
  ref_id?: string;
}

// Hook for adjusting inventory quantities
export function useInventoryAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (adjustmentData: InventoryAdjustmentData) => {
      const token = await getAccessToken();
      return productAddToInventory(token, {
        ...adjustmentData,
        reason: adjustmentData.reason || "ADJUSTMENT",
        note: adjustmentData.note || "Manual inventory adjustment",
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate inventory-related queries after successful adjustment
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryGlobal });
      queryClient.invalidateQueries({ queryKey: queryKeys.productsByStore(variables.store_id) });
      
      // Also invalidate specific product if we can determine it
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.products,
        refetchType: 'active' 
      });
    },
  });
}

// Hook for bulk inventory adjustments (multiple items at once)
export function useBulkInventoryAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (adjustments: InventoryAdjustmentData[]) => {
      const token = await getAccessToken();
      const results = [];
      
      // Process adjustments sequentially to avoid overwhelming the API
      for (const adjustment of adjustments) {
        try {
          const result = await productAddToInventory(token, {
            ...adjustment,
            reason: adjustment.reason || "ADJUSTMENT",
            note: adjustment.note || "Bulk inventory adjustment",
          });
          results.push({ success: true, data: result, adjustment });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            adjustment 
          });
        }
        
        // Small delay between requests to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return results;
    },
    onSuccess: (results, variables) => {
      // Get unique store IDs from successful adjustments
      const storeIds = new Set();
      results.forEach(result => {
        if (result.success) {
          storeIds.add(result.adjustment.store_id);
        }
      });
      
      // Invalidate inventory queries for affected stores
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryGlobal });
      storeIds.forEach(storeId => {
        queryClient.invalidateQueries({ queryKey: queryKeys.productsByStore(storeId as string) });
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}