'use client';
import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/helper/getAccessToken';
import { getUser } from '@/lib/user/userApi';
import { jwtDecode } from "jwt-decode";

export default function StorePage() {
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('No access token');
        const decoded: any = jwtDecode(token);
        const user_id = decoded.app_metadata.tenants?.[0];
        const users = await getUser(user_id, token); // user_id → token
        setData(users);
      } catch (e: any) {
        setError(e?.message || 'Алдаа гарлаа');
        // MOCK fallback
        setData([
          { id: 'u_mock_1', email: 'cashier@example.com', display_name: 'Mock Cashier', role: 'CASHIER' },
          { id: 'u_mock_2', email: 'manager@example.com', display_name: 'Mock Manager', role: 'MANAGER' },
        ]);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Хэрэглэгчид</h1>
        {error && <div className="mb-3 text-sm text-red-600">⚠ {error}</div>}
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-sm text-gray-700 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
