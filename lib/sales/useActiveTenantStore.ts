import { useEffect, useState } from 'react';

// super simple holder — replace with your tenant/store selector if you have one
export function useActiveTenantStore() {
  const [tenantId, setTenant] = useState<string | null>(null);
  const [storeId, setStore] = useState<string | null>(null);

  useEffect(() => {
    setTenant(localStorage.getItem('active-tenant-id'));
    setStore(localStorage.getItem('active-store-id'));
  }, []);

  return { tenantId, storeId };
}

