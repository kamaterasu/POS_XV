import { useQuery } from '@tanstack/react-query';
import { getStoredID } from '@/lib/store/storeApi';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { queryKeys } from './queryKeys';

export function useCurrentStore() {
  const { data: storeId, isLoading } = useQuery({
    queryKey: queryKeys.currentStore,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      return getStoredID(token);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    selectedStore: storeId ? { id: storeId, name: 'Current Store' } : null,
    isLoading,
  };
}