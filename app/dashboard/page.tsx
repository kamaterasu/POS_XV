'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { BiTransferAlt } from "react-icons/bi";
import { LiaListAlt } from "react-icons/lia";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { VscGraph } from "react-icons/vsc";
import { FaRegUser } from "react-icons/fa";
import { IoExitOutline } from "react-icons/io5";
import type { IconType } from "react-icons";
import { supabase } from '@/lib/supabaseClient';
import { Loading } from '@/components/Loading';

export default function DashboardPage() {
  const router = useRouter();

    useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  const [loading, setLoading] = useState(true);

  

  const goTocheckout = () => router.push('/checkout');
  const goToInventory = () => router.push('/inventory');
  const goToReport = () => router.push('/report');
  const goToManagement = () => router.push('/management');
  const goToProductReturn = () => router.push('/productreturn');

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut failed:', e);
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-dvh bg-[#F7F7F5]">
      <div className="mx-auto max-w-screen-xl p-4 sm:p-6 lg:p-8 min-h-dvh flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <button
            className="w-fit rounded-xl border border-neutral-200 bg-white shadow px-4 py-2 text-sm hover:shadow-md active:scale-[0.99] transition"
          >
            Солдат
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <CardBtn onClick={goTocheckout}         Icon={BiTransferAlt}     label="Борлуулалт" />
            <CardBtn onClick={goToInventory}   Icon={LiaListAlt}        label="Агуулах" />
            <CardBtn onClick={goToProductReturn} Icon={FaArrowRotateLeft} label="Буцаалт" disabled />
            <CardBtn onClick={goToReport}        Icon={VscGraph}          label="Тайлан"  disabled />
            <CardBtn onClick={goToManagement}       Icon={FaRegUser}         label="Хяналт" />
          </div>
        </div>

        <div className="mt-auto flex justify-end">
          <button
            onClick={handleLogout}
            className="rounded-xl border border-neutral-200 bg-white shadow px-5 py-2.5 flex items-center gap-2 hover:shadow-md active:scale-[0.99] transition"
          >
            <IoExitOutline size={20} />
            Гарах
          </button>
        </div>
      </div>

      <Loading
        open={loading}
        label="Уншиж байна…"
        subLabel="Дашбоардын мэдээллийг бэлдэж байна"
      />
    </div>
  );
}

/** Нэг маягийн карт товч – disabled үед бүдгэрч, дарж болохгүй */
function CardBtn({
  onClick,
  Icon,
  label,
  disabled = false,
}: {
  onClick: () => void;
  Icon: IconType;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'Тун удахгүй' : undefined}
      className={`group w-full rounded-2xl border border-neutral-200 bg-white shadow-sm px-5 py-4 sm:py-5
                  flex items-center gap-4 hover:shadow-md active:scale-[0.99] transition
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:active:scale-100`}
      aria-disabled={disabled}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-[#F7F7F5]">
        <Icon size={22} />
      </span>
      <span className="text-base sm:text-lg font-medium">{label}</span>
    </button>
  );
}
