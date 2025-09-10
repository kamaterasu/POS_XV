"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { BiTransferAlt } from "react-icons/bi";
import { LiaListAlt } from "react-icons/lia";
import { FaArrowRotateLeft } from "react-icons/fa6";
import { VscGraph } from "react-icons/vsc";
import { FaRegUser } from "react-icons/fa";
import { IoExitOutline } from "react-icons/io5";
import { MdOutlineShoppingCart } from "react-icons/md";
import { TbTransfer } from "react-icons/tb";
import { MdOutlineCalculate } from "react-icons/md";
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
  // const goToOrderCount = () => router.push("/order");
  const goToTransferItems = () => router.push("/transfer");
  const goToCount = () => router.push("/count");

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
    const t = setTimeout(() => setLoading(false), 800);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header with glassmorphism effect */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-white/20 shadow-sm">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
                <BiTransferAlt size={24} />
              </div>
              <button
                onClick={goToManagement}
                disabled={!canAccessFeature(userRole, "management")}
                className={`transition-all duration-200 rounded-lg p-2 ${
                  !canAccessFeature(userRole, "management")
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-indigo-50 active:scale-[0.98]"
                }`}
                title={
                  !canAccessFeature(userRole, "management")
                    ? "Тун удахгүй"
                    : "Хэрэглэгч, эрхийн удирдлага"
                }
              >
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">
                    Удирдлагын самбар
                  </h1>
                  <FaRegUser
                    size={16}
                    className={
                      !canAccessFeature(userRole, "management")
                        ? "text-gray-400"
                        : "text-indigo-600"
                    }
                  />
                </div>
                <p className="text-sm text-gray-600 text-left">
                  Тавтай морилно уу, {userName || "Хэрэглэгч"}
                </p>
              </button>
            </div>

            <div className="flex items-center gap-3">
              Эрх:
              {userRole && (
                <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium shadow-lg">
                  {userRole}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="group p-2 rounded-xl flex items-center gap-2 bg-red-500 backdrop-blur-sm border border-red-600 shadow-sm hover:shadow-md hover:bg-red-600 transition-all duration-200 active:scale-95"
                title="Системээс гарах"
              >
                <IoExitOutline
                  size={20}
                  className="text-white group-hover:text-white transition-colors"
                />
                <span className="text-sm text-white">Гарах</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome section */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 shadow-sm mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm text-gray-600">
              Системд амжилттай холбогдлоо
            </span>
          </div>
          {/* <p className="text-gray-600 max-w-2xl mx-auto">
            Борлуулалтын цэгийн системийн удирдлагын самбар. Дараах үйл
            ажиллагааг гүйцэтгэх боломжтой.
          </p> */}
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Updated to 3 columns to fit 6 cards better */}
          <div className="fade-in-up stagger-1">
            <FeatureCard
              onClick={goTocheckout}
              Icon={BiTransferAlt}
              label="Борлуулалт"
              description="Бараа борлуулах, тооцоо хийх"
              gradient="from-blue-500 to-cyan-500"
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
          </div>
          <div className="fade-in-up stagger-2">
            <FeatureCard
              onClick={goToInventory}
              Icon={LiaListAlt}
              label="Агуулах"
              description="Бараа материалын бүртгэл"
              gradient="from-emerald-500 to-teal-500"
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
          </div>
          <div className="fade-in-up stagger-3">
            <FeatureCard
              onClick={goToProductReturn}
              Icon={FaArrowRotateLeft}
              label="Буцаалт"
              description="Бараа буцаах үйл ажиллагаа"
              gradient="from-orange-500 to-red-500"
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
              disabled={!canAccessFeature(userRole, "productReturn")}
            />
          </div>
          <div className="fade-in-up stagger-4">
            <FeatureCard
              onClick={goToReport}
              Icon={VscGraph}
              label="Тайлан"
              description="Борлуулалтын тайлан статистик"
              gradient="from-purple-500 to-pink-500"
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
              disabled={!canAccessFeature(userRole, "report")}
            />
          </div>

          <div className="fade-in-up stagger-5">
            <FeatureCard
              onClick={goToTransferItems}
              Icon={TbTransfer}
              label="Шилжүүлэг"
              description="Бараа материал шилжүүлэх"
              gradient="from-teal-500 to-green-500"
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
              disabled={!canAccessFeature(userRole, "transfer")}
            />
          </div>

          <div className="fade-in-up stagger-6">
            <FeatureCard
              onClick={goToCount}
              Icon={MdOutlineCalculate}
              label="Тооллого"
              description="Агуулахын тооллого хийх"
              gradient="from-indigo-500 to-blue-500"
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
              disabled={!canAccessFeature(userRole, "inventory")}
            />
          </div>
        </div>
      </div>

      <Loading
        open={loading}
        label="Уншиж байна"
        subLabel="Системийн мэдээллийг бэлдэж байна. Түр хүлээнэ үү..."
      />
    </div>
  );
}

/** Enhanced feature card with modern design */
function FeatureCard({
  onClick,
  Icon,
  label,
  description,
  gradient,
  iconBg,
  iconColor,
  disabled = false,
}: {
  onClick: () => void;
  Icon: IconType;
  label: string;
  description: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "Тун удахгүй" : undefined}
      className={`group relative w-full rounded-2xl bg-white/60 backdrop-blur-sm border border-white/40 shadow-sm 
                  p-6 text-left transition-all duration-300 overflow-hidden
                  ${
                    disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:shadow-xl hover:scale-[1.02] hover:bg-white/80 active:scale-[0.98]"
                  }`}
      aria-disabled={disabled}
    >
      {/* Gradient overlay on hover */}
      {!disabled && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
        />
      )}

      {/* Icon container */}
      <div
        className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-4 
                      ${
                        !disabled && "group-hover:scale-110"
                      } transition-transform duration-300`}
      >
        <Icon size={24} className={iconColor} />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-800">
          {label}
        </h3>
        <p className="text-sm text-gray-600 group-hover:text-gray-700">
          {description}
        </p>
      </div>

      {/* Arrow indicator */}
      {!disabled && (
        <div
          className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 
                        transition-all duration-300"
        >
          <svg
            className="w-3 h-3 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 bg-gray-100/50 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
          <span className="text-xs text-gray-500 bg-white/80 px-2 py-1 rounded-full">
            Тун удахгүй
          </span>
        </div>
      )}
    </button>
  );
}
