"use client";

import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";

export function KontrolcenterLockdownToggle() {
  const { planningLockdown, isAdmin, toggleBusy, setPlanningLockdown } = useKontrolcenterLockdown();

  if (!isAdmin) return null;

  return (
    <label
      className={`inline-flex shrink-0 cursor-pointer select-none items-center gap-2.5 rounded-full border-2 border-white/40 bg-black/15 py-1 pl-2.5 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-[2px] transition hover:border-white/60 hover:bg-black/20 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/90 dark:border-white/30 dark:bg-black/25 ${
        planningLockdown
          ? "ring-2 ring-amber-200 ring-offset-2 ring-offset-[#14b8a6] dark:ring-amber-300/90 dark:ring-offset-teal-600"
          : ""
      } ${toggleBusy ? "pointer-events-none opacity-60" : ""}`}
      title={
        planningLockdown
          ? "Lockdown er aktiv — klik for at låse op"
          : "Slå Lockdown til — låser Holddannelse og Turnering"
      }
    >
      <span className="hidden text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-white drop-shadow sm:inline">
        Lockdown
      </span>
      <span
        className={`relative inline-flex h-[1.625rem] w-[2.875rem] shrink-0 items-center rounded-full p-0.5 shadow-inner ring-1 ring-black/15 transition-colors duration-200 dark:ring-white/10 ${
          planningLockdown
            ? "bg-amber-400 ring-amber-700/25 dark:bg-amber-500"
            : "bg-white/25 dark:bg-white/15"
        }`}
      >
        <input
          type="checkbox"
          role="switch"
          aria-checked={planningLockdown}
          aria-label={planningLockdown ? "Slå Lockdown fra" : "Slå Lockdown til"}
          className="sr-only"
          checked={planningLockdown}
          disabled={toggleBusy}
          onChange={(e) => void setPlanningLockdown(e.target.checked)}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute left-[3px] top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.22)] ring-1 ring-black/8 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            planningLockdown
              ? "translate-x-[1.2rem] shadow-[0_2px_8px_rgba(120,53,15,0.35)] ring-amber-900/10"
              : "translate-x-0"
          }`}
        />
      </span>
    </label>
  );
}
