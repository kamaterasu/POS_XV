import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getStore,
  listStores,
  createStore,
  updateStore,
  deleteStore
} from '../store/storeApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

// Query hooks
export function useStores() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: async () => {
      const token = await getAccessToken();
      return listStores(token);
    },
  });
}

export function useStore() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: async () => {
      const token = await getAccessToken();
      return getStore(token);
    },
  });
}

// Mutation hooks
export function useCreateStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (storeNames: string[]) => {
      const token = await getAccessToken();
      return createStore(storeNames, token);
    },
    onSuccess: () => {
      // Invalidate stores queries
      queryClient.invalidateQueries({ queryKey: queryKeys.stores });
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storeId, storeName }: { storeId: string; storeName: string }) => {
      const token = await getAccessToken();
      return updateStore(storeId, storeName, token);
    },
    onSuccess: () => {
      // Invalidate stores queries
      queryClient.invalidateQueries({ queryKey: queryKeys.stores });
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (storeId: string) => {
      const token = await getAccessToken();
      return deleteStore(storeId, token);
    },
    onSuccess: () => {
      // Invalidate stores queries
      queryClient.invalidateQueries({ queryKey: queryKeys.stores });
    },
  });
}