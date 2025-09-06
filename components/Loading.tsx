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
      className={`flex flex-col items-center gap-4 text-neutral-800 ${className}`}
    >
      <PrinterFace />
      <div className="text-xl font-semibold tracking-tight">{label}</div>
      <div className="w-56 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
        <div className="h-full w-1/3 bg-indigo-400/70 animate-pulse rounded-full" />
      </div>
      {subLabel && (
        <div className="text-[13px] text-neutral-500">{subLabel}</div>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="min-h-[160px] grid place-items-center bg-white/40 rounded-xl border border-neutral-200">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#F7F7F5]/70 backdrop-blur-sm">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-xl p-8">
        {content}
      </div>
    </div>
  );
}

function PrinterFace() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none">
      <rect x="10" y="22" width="56" height="40" rx="12" fill="#fff" stroke="#374151" />
      <rect x="24" y="7" width="28" height="18" rx="4" fill="#fff" stroke="#374151" />
      <circle cx="32" cy="42" r="3" fill="#374151" />
      <circle cx="44" cy="42" r="3" fill="#374151" />
      <path d="M30 51c3 3 13 3 16 0" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="64" cy="42" r="2" fill="#374151" />
      <circle cx="64" cy="48" r="2" fill="#374151" />
    </svg>
  );
}
