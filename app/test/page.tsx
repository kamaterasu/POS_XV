'use client'
import React, { useEffect, useState } from 'react'
import { getAccessToken } from "@/lib/helper/getAccessToken";
import { getUser } from '@/lib/user/userApi';

export default function StorePage() {
  const [data, setData] = useState([])

  useEffect(() => {
    async function fetchData() {
      const token = await getAccessToken();   // ⬅️ await хэрэгтэй
      const data = await getUser(token);
      setData(data);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Дэлгүүрийн мэдээлэл</h1>
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-sm text-gray-700 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
