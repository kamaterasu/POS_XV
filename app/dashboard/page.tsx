"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { BiTransferAlt } from "react-icons/bi";
import { LiaListAlt } from "react-icons/lia";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { VscGraph } from "react-icons/vsc";
import { FaRegUser } from "react-icons/fa";
import { IoExitOutline } from "react-icons/io5";
import type { IconType } from "react-icons";
import { supabase } from "@/lib/supabaseClient";
import { Loading } from "@/components/Loading";
import {
  getUserRole,
  canAccessFeature,
  type Role,
} from "@/lib/helper/getUserRole";
// import { getTenant, getTenantWithStore, createTenant, updateTenant, deleteTenant } from '@/lib/tenant/tenantApi';
// const tenant = await getTenant();
// const tenantStore = await getTenantWithStore(tenant.items?.[0]?.id);

export default function DashboardPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("Session:", session);

      if (!session) {
        router.replace("/login");
        return;
      }

      // Get user role
      const role = await getUserRole();
      setUserRole(role);
      console.log("User role:", role);

      // Get user name from user_metadata
      const displayName =
        session.user.user_metadata?.display_name ||
        session.user.email ||
        "Нэргүй хэрэглэгч";
      setUserName(displayName);

      // Debug: Print the token and user data as requested
      console.log("Token:", session.access_token);
      console.log("User data:", session.user);
    }
    checkAuth();
  }, [router]);

  const [loading, setLoading] = useState(true);

  const goTocheckout = () => router.push("/checkout");
  const goToInventory = () => router.push("/inventory");
  const goToReport = () => router.push("/report");
  const goToManagement = () => router.push("/management");
  const goToProductReturn = () => router.push("/productreturn");

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("signOut failed:", e);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);
  // useEffect(() => {
  //   // console.log("Tenant API:");
  //   // console.log(token);
  //   // console.log(tenant);
  //   // console.log(tenantStore);
  //   // updateTenant(tenant.items?.[0]?.id, "New Name").then(res => console.log(res));
  //   // deleteTenant(tenant.items?.[0]?.id).then(res => console.log(res));
  // })
  return (
    <div className="min-h-dvh bg-[#F7F7F5]">
      <div className="mx-auto max-w-screen-xl p-4 sm:p-6 lg:p-8 min-h-dvh flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button className="w-fit rounded-xl border border-neutral-200 bg-white shadow px-4 py-2 text-sm hover:shadow-md active:scale-[0.99] transition">
              Нэр: {userName || "Нэргүй хэрэглэгч"}
            </button>
            {userRole && (
              <div className="rounded-xl border border-neutral-200 bg-white shadow px-4 py-2 text-sm">
                Эрх: {userRole}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <CardBtn
              onClick={goTocheckout}
              Icon={BiTransferAlt}
              label="Борлуулалт"
            />
            <CardBtn
              onClick={goToInventory}
              Icon={LiaListAlt}
              label="Агуулах"
            />
            <CardBtn
              onClick={goToProductReturn}
              Icon={FaArrowRotateLeft}
              label="Буцаалт"
              disabled={!canAccessFeature(userRole, "productReturn")}
            />
            <CardBtn
              onClick={goToReport}
              Icon={VscGraph}
              label="Тайлан"
              disabled={!canAccessFeature(userRole, "report")}
            />
            <CardBtn
              onClick={goToManagement}
              Icon={FaRegUser}
              label="Хяналт"
              disabled={!canAccessFeature(userRole, "management")}
            />
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
      title={disabled ? "Тун удахгүй" : undefined}
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
