// Query keys for consistent caching
export const queryKeys = {
  // Products
  products: ['products'] as const,
  product: (id: string) => ['products', id] as const,
  productsByStore: (storeId: string) => ['products', 'store', storeId] as const,
  productsByCategory: (categoryId: string) => ['products', 'category', categoryId] as const,
  inventoryGlobal: ['inventory', 'global'] as const,
  productVariants: ['products', 'variants'] as const,

  // Categories
  categories: ['categories'] as const,

  // Users
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  userIds: ['users', 'ids'] as const,

  // Stores
  stores: ['stores'] as const,
  store: (id: string) => ['stores', id] as const,
  currentStore: ['stores', 'current'] as const,

  // Checkout & Orders
  checkoutOrders: (storeId?: string) => ['checkout', 'orders', storeId || 'all'] as const,
  checkout: (storeId: string) => ['checkout', storeId] as const,

  // Drafts
  drafts: ['drafts'] as const,

  // Transfers
  transfers: (params?: any) => ['transfers', params] as const,
  transfer: (id: string) => ['transfers', id] as const,

  // Returns
  returns: (params?: any) => ['returns', params] as const,

  // Reports
  salesSummary: (params: any) => ['reports', 'sales-summary', params] as const,
  salesByStore: (params: any) => ['reports', 'sales-by-store', params] as const,
  paymentsByMethod: (params: any) => ['reports', 'payments-by-method', params] as const,
  topVariants: (params: any) => ['reports', 'top-variants', params] as const,
  categorySummary: (params: any) => ['reports', 'category-summary', params] as const,
  inventorySnapshot: (params: any) => ['reports', 'inventory-snapshot', params] as const,
  returnsSummary: (params: any) => ['reports', 'returns-summary', params] as const,

  // Tenants
  tenants: ['tenants'] as const,
  tenant: (id: string) => ['tenants', id] as const,
};