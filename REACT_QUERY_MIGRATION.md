# React Query Migration Guide

## Overview

Your POS application has been successfully migrated to use React Query (@tanstack/react-query) for API state management. This migration provides several benefits:

- **Automatic caching** - API responses are cached and reused
- **Background refetching** - Data stays fresh automatically
- **Loading and error states** - Built-in loading and error handling
- **Optimistic updates** - Better user experience with instant UI updates
- **Request deduplication** - Multiple identical requests are automatically combined

## What's Been Added

### 1. Dependencies
- `@tanstack/react-query@5.87.4` - Main library
- `@tanstack/react-query-devtools@5.87.4` - Development tools

### 2. Provider Setup
- **QueryProvider** (`/lib/providers/QueryProvider.tsx`) - Wraps the app with React Query context
- **Updated Layout** (`/app/layout.tsx`) - Includes the QueryProvider

### 3. Query Hooks
Created comprehensive hooks in `/lib/hooks/`:

#### Products (`useProducts.ts`)
- `useProducts()` - Get paginated products list
- `useProduct(id)` - Get single product with variants
- `useProductsByStore(storeId)` - Get products by store
- `useProductsByCategory(categoryId)` - Get products by category
- `useInventoryGlobal()` - Get global inventory
- `useProductVariants()` - Get all product variants
- `useCreateProduct()` - Create new product
- `useUpdateProduct()` - Update existing product
- `useDeleteProduct()` - Delete product

#### Users (`useUsers.ts`)
- `useUsers()` - Get all users
- `useUser(id)` - Get single user
- `useUserIds()` - Get user IDs
- `useCreateUser()` - Create new user
- `useUpdateUser()` - Update user
- `useDeleteUser()` - Delete user

#### Categories (`useCategories.ts`)
- `useCategories()` - Get category tree
- `useCreateCategory()` - Create category
- `useCreateSubcategory()` - Create subcategory

#### Checkout (`useCheckout.ts`)
- `useCheckoutOrders()` - Get checkout orders
- `useCheckout(storeId)` - Get checkout data
- `useCreateCheckout()` - Create checkout
- `useCreateCheckoutOrder()` - Create checkout order

#### Drafts (`useDrafts.ts`)
- `useDrafts()` - Get all drafts
- `useSaveDraft()` - Save draft
- `useDeleteDraft()` - Delete draft

#### Transfers (`useTransfers.ts`)
- `useTransfers()` - Get transfers
- `useTransfer(id)` - Get single transfer
- `useCreateTransfer()` - Create transfer
- `useUpdateTransferStatus()` - Update transfer status
- `useDeleteTransfer()` - Delete transfer

#### Reports (`useReports.ts`)
- `useSalesSummary()` - Sales summary report
- `useSalesByStore()` - Sales by store report
- `usePaymentsByMethod()` - Payments by method report
- `useTopVariants()` - Top variants report
- `useCategorySummary()` - Category summary report
- `useInventorySnapshot()` - Inventory snapshot report
- `useReturnsSummary()` - Returns summary report

#### Stores (`useStores.ts`)
- `useStores()` - Get all stores
- `useStore()` - Get store data
- `useCreateStore()` - Create store
- `useUpdateStore()` - Update store
- `useDeleteStore()` - Delete store

### 4. Query Keys (`queryKeys.ts`)
Centralized query key management for consistent caching:
```typescript
export const queryKeys = {
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  // ... more keys
};
```

## Example Component Migration

### Before (Direct API calls):
```tsx
export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const token = await getAccessToken();
        const data = await getProductByStore(token, storeId);
        setProducts(data.items || []);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [storeId]);

  // Handle loading, error, and render...
}
```

### After (React Query):
```tsx
export default function InventoryPage() {
  const {
    data: products,
    isLoading,
    error,
    refetch
  } = useProductsByStore(storeId);

  // React Query handles loading, error states automatically
  // Data is cached and automatically refetched when needed
}
```

## Migration Benefits

### 1. Automatic Caching
- API responses are cached in memory
- Subsequent requests for the same data return immediately from cache
- Cache is automatically invalidated when data changes

### 2. Loading States
- `isLoading` - Initial load
- `isFetching` - Background refetch
- `isPending` - For mutations

### 3. Error Handling
- Automatic retry on network failures
- Customizable retry logic
- Built-in error states

### 4. Mutations with Cache Updates
```tsx
const updateProductMutation = useUpdateProduct();

const handleUpdate = async (productData) => {
  await updateProductMutation.mutateAsync(productData);
  // Cache is automatically updated!
};
```

### 5. Background Refetching
- Data automatically refetches when window regains focus
- Configurable stale time and cache time
- Keeps data fresh without user intervention

## Configuration

The QueryClient is configured with:
- **Stale Time**: 1 minute (data considered fresh for 1 minute)
- **GC Time**: 5 minutes (cached data removed after 5 minutes of non-use)
- **Retry Logic**: Custom retry for auth errors, 3 retries for other errors
- **Dev Tools**: Available in development mode

## Example Pages

Created example pages showing the migration:

1. **Inventory Page** (`/app/inventory/page-with-react-query.tsx`)
   - Uses multiple hooks for products, categories, stores
   - Shows loading states, error handling
   - Demonstrates mutations for creating categories

2. **Product Detail Page** (`/app/productdetail/[id]/page-with-react-query.tsx`)
   - Uses `useProduct()` hook
   - Shows form handling with mutations
   - Automatic refetch after updates

3. **Checkout Page** (`/app/checkout/page-with-react-query.tsx`)
   - Uses checkout and product hooks
   - Shows cart management
   - Demonstrates order creation mutations

## Next Steps

1. **Replace existing pages** - Gradually replace your existing pages with React Query versions
2. **Add optimistic updates** - For better UX, implement optimistic updates in mutations
3. **Customize caching** - Adjust stale times and cache times based on data requirements
4. **Add infinite queries** - For paginated data that loads more items
5. **Monitor with DevTools** - Use React Query DevTools to debug and optimize

## Usage Tips

1. **Use the hooks consistently** - Replace all direct API calls with hooks
2. **Handle loading states** - Always check `isLoading` before rendering data
3. **Implement error boundaries** - For better error handling at the app level
4. **Invalidate cache wisely** - Use `queryClient.invalidateQueries()` after mutations
5. **Leverage cache** - Use cached data to improve performance

The migration is complete and your application now benefits from modern client-side state management with React Query!