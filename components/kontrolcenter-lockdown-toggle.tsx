"use client";

import { Lock, LockOpen } from "lucide-react";
import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";

export function KontrolcenterLockdownToggle() {
  const { planningLockdown, isAdmin, toggleBusy, setPlanningLockdown } = useKontrolcenterLockdown();

  if (!isAdmin) return null;

  return (
    <label
      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition lg:px-4 lg:py-2 lg:text-sm ${
        planningLockdown
          ? "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100/90 dark:border-amber-700 dark:bg-amber-950/80 dark:text-amber-100"
          : "border-white/30 bg-white/95 text-[#0f766e] hover:bg-white"
      } ${toggleBusy ? "pointer-events-none opacity-70" : ""}`}
      title={
        planningLockdown
          ? "Lockdown er aktiv — Holddannelse og Turnering er låst"
          : "Slå Lockdown til for at låse Holddannelse og Turnering"
      }
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={planningLockdown}
        disabled={toggleBusy}
        onChange={(e) => void setPlanningLockdown(e.target.checked)}
      />
      {planningLockdown ? (
        <Lock className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <LockOpen className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
      <span>Lockdown</span>
    </label>
  );
}
