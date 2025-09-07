// components/Loading.tsx
import React from "react";

type LoadingProps = {
  open: boolean;
  label?: string;
  subLabel?: string;
  variant?: "overlay" | "inline";
  className?: string;
};

export function Loading({
  open,
  label = "Уншиж байна…",
  subLabel,
  variant = "overlay",
  className = "",
}: LoadingProps) {
  if (!open) return null;

  const content = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center gap-6 text-gray-800 ${className}`}
    >
      {/* Modern animated icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        {/* Pulse ring animation */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 opacity-20 animate-ping"></div>
      </div>

      {/* Text content */}
      <div className="text-center space-y-2">
        <div className="text-xl font-semibold tracking-tight text-gray-900">
          {label}
        </div>
        {subLabel && (
          <div className="text-sm text-gray-600 max-w-xs">{subLabel}</div>
        )}
      </div>

      {/* Modern progress bar */}
      <div className="w-64 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-loading-progress"></div>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1">
        <div
          className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="min-h-[240px] grid place-items-center bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 shadow-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-gradient-to-br from-slate-50/90 via-blue-50/90 to-indigo-50/90 backdrop-blur-md">
      <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-white/40 shadow-2xl p-10 max-w-sm w-full mx-4">
        {content}
      </div>
    </div>
  );
}

function PrinterFace() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none">
      <rect
        x="10"
        y="22"
        width="56"
        height="40"
        rx="12"
        fill="#fff"
        stroke="#374151"
      />
      <rect
        x="24"
        y="7"
        width="28"
        height="18"
        rx="4"
        fill="#fff"
        stroke="#374151"
      />
      <circle cx="32" cy="42" r="3" fill="#374151" />
      <circle cx="44" cy="42" r="3" fill="#374151" />
      <path
        d="M30 51c3 3 13 3 16 0"
        stroke="#374151"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="64" cy="42" r="2" fill="#374151" />
      <circle cx="64" cy="48" r="2" fill="#374151" />
    </svg>
  );
}
