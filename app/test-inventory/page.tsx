"use client";

import React, { useState } from 'react';
import { InventoryAdjustmentModal } from "@/components/inventoryComponents/InventoryAdjustmentModal";

export default function TestInventoryAdjustmentPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Барааны тоо ширхэг тохируулах - Тест хуудас
        </h1>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Шинэ функцийн тест
          </h2>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Энэ хуудас нь шинээр үүсгэсэн inventory adjustment функцийг тестлэхэд зориулагдсан.
            </p>
            
            <div className="space-y-2">
              <h3 className="font-medium">Функцийн боломжууд:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Бараа сонгох</li>
                <li>Барааны хувилбар сонгох</li>
                <li>Тоо ширхэг нэмэх/хасах</li>
                <li>Шалтгаан тэмдэглэх (Тохируулга, Худалдан авалт, Анхны үлдэгдэл)</li>
                <li>Нэмэлт тэмдэглэл нэмэх</li>
                <li>Урьдчилсан харагдац</li>
              </ul>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Барааны тоо ширхэг тохируулах
            </button>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Анхаарах зүйл:</h3>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• Энэ функц нь productAddToInventory API-г ашигладаг</li>
            <li>• Эерэг тоо оруулбал үлдэгдэл нэмэгдэнэ</li>
            <li>• Сөрөг тоо оруулбал үлдэгдэлээс хасагдана</li>
            <li>• React Query cache автоматаар шинэчлэгдэнэ</li>
          </ul>
        </div>
      </div>

      <InventoryAdjustmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}