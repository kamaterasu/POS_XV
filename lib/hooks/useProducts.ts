import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProduct,
  getProductById,
  getProductByStore,
  getProductByCategory,
  getInventoryGlobal,
  getAllProductVariants,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductInput,
  type UpdateProductInput
} from '../product/productApi';
import { getAccessToken } from '../helper/getAccessToken';
import { queryKeys } from './queryKeys';

// Query hooks
export function useProducts(params?: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...queryKeys.products, params],
    queryFn: async () => {
      const token = await getAccessToken();
      return getProduct(token, params);
    },
    enabled: true,
  });
}

export function useProduct(productId: string, opts?: { withVariants?: boolean; withStock?: boolean; storeId?: string }) {
  return useQuery({
    queryKey: [...queryKeys.product(productId), opts],
    queryFn: async () => {
      const token = await getAccessToken();
      return getProductById(token, productId, opts);
    },
    enabled: !!productId,
  });
}

export function useProductsByStore(storeId: string, limit = 500) {
  return useQuery({
    queryKey: [...queryKeys.productsByStore(storeId), limit],
    queryFn: async () => {
      const token = await getAccessToken();
      return getProductByStore(token, storeId, limit);
    },
    enabled: !!storeId,
  });
}

export function useProductsByCategory(categoryId: string) {
  return useQuery({
    queryKey: queryKeys.productsByCategory(categoryId),
    queryFn: async () => {
      const token = await getAccessToken();
      return getProductByCategory(token, categoryId);
    },
    enabled: !!categoryId,
  });
}

export function useInventoryGlobal(limit = 500) {
  return useQuery({
    queryKey: [...queryKeys.inventoryGlobal, limit],
    queryFn: async () => {
      const token = await getAccessToken();
      return getInventoryGlobal(token, limit);
    },
  });
}

export function useProductVariants() {
  return useQuery({
    queryKey: queryKeys.productVariants,
    queryFn: async () => {
      const token = await getAccessToken();
      return getAllProductVariants(token);
    },
  });
}

// Mutation hooks
export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productData: ProductInput) => {
      const token = await getAccessToken();
      return createProduct(token, productData);
    },
    onSuccess: () => {
      // Invalidate and refetch products-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryGlobal });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productData: UpdateProductInput) => {
      const token = await getAccessToken();
      return updateProduct(token, productData);
    },
    onSuccess: (data, variables) => {
      // Invalidate specific product and products list
      queryClient.invalidateQueries({ queryKey: queryKeys.product(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryGlobal });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productId: string) => {
      const token = await getAccessToken();
      return deleteProduct(token, productId);
    },
    onSuccess: (data, productId) => {
      // Remove specific product from cache and invalidate lists
      queryClient.removeQueries({ queryKey: queryKeys.product(productId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryGlobal });
    },
  });
}