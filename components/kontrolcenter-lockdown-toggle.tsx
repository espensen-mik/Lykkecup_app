"use client";

import { Lock } from "lucide-react";
import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";
import {
  LOCKDOWN_TOGGLE_KNOB_CLASS,
  LOCKDOWN_TOGGLE_LABEL_CLASS,
} from "@/lib/kontrolcenter-lockdown-shared";

export function KontrolcenterLockdownToggle() {
  const { planningLockdown, isAdmin, toggleBusy, setPlanningLockdown } = useKontrolcenterLockdown();

  if (!isAdmin) return null;

  return (
    <label
      className={`inline-flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-full border-2 py-1 pl-2 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-[2px] transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/90 ${
        planningLockdown
          ? LOCKDOWN_TOGGLE_LABEL_CLASS
          : "border-white/40 bg-black/15 hover:border-white/60 hover:bg-black/20 dark:border-white/30 dark:bg-black/25"
      } ${toggleBusy ? "pointer-events-none opacity-60" : ""}`}
      title={
        planningLockdown
          ? "Lockdown er aktiv — Holddannelse og Turnering er låst. Klik for at låse op."
          : "Slå Lockdown til — låser Holddannelse og Turnering"
      }
    >
      {planningLockdown ? (
        <Lock className="h-4 w-4 shrink-0 text-white drop-shadow" strokeWidth={2.5} aria-hidden />
      ) : null}
      <span
        className={`hidden text-[0.65rem] font-extrabold uppercase tracking-[0.1em] drop-shadow sm:inline ${
          planningLockdown ? "text-white" : "text-white"
        }`}
      >
        {planningLockdown ? "Lockdown aktiv" : "Lockdown"}
      </span>
      <span
        className={`relative inline-flex h-[1.625rem] w-[2.875rem] shrink-0 items-center rounded-full p-0.5 shadow-inner ring-1 transition-colors duration-200 ${
          planningLockdown
            ? "bg-white ring-white/40"
            : "bg-white/25 ring-black/15 dark:bg-white/15 dark:ring-white/10"
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
          className={`pointer-events-none absolute left-[3px] top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.22)] ring-1 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            planningLockdown
              ? LOCKDOWN_TOGGLE_KNOB_CLASS
              : "translate-x-0 bg-white ring-black/8"
          }`}
        />
      </span>
    </label>
  );
}
