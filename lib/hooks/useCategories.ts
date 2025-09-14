import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getCategories,
  createCategory,
  createSubcategory
} from '../category/categoryApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

// Query hooks
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const token = await getAccessToken();
      return getCategories(token);
    },
  });
}

// Mutation hooks
export function useCreateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (categoryData: { name: string }) => {
      const token = await getAccessToken();
      return createCategory(categoryData.name, token);
    },
    onSuccess: () => {
      // Invalidate categories queries
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

export function useCreateSubcategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (subcategoryData: { parent_id: string; name: string }) => {
      const token = await getAccessToken();
      return createSubcategory(subcategoryData.parent_id, subcategoryData.name, token);
    },
    onSuccess: () => {
      // Invalidate categories queries
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    },
  });
}

// Note: Update and delete category functions are not implemented in the API yet