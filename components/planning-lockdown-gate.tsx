"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";

/** Skjuler interaktion på Holddannelse/Turnering-sider når Lockdown er aktiv. */
export function PlanningLockdownGate({ children }: { children: ReactNode }) {
  const { planningLockdown, message } = useKontrolcenterLockdown();

  if (!planningLockdown) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[12rem]">
      <div className="pointer-events-none select-none opacity-50">{children}</div>
      <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-gray-900/5 p-4 pt-8 dark:bg-black/25 sm:pt-12">
        <div
          role="status"
          className="pointer-events-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-center shadow-lg dark:border-amber-800 dark:bg-amber-950/90"
        >
          <Lock className="mx-auto h-8 w-8 text-amber-700 dark:text-amber-300" strokeWidth={2} aria-hidden />
          <p className="mt-3 text-base font-semibold text-amber-950 dark:text-amber-50">Lockdown er aktiv</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">{message}</p>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
            App Indhold og øvrige dele af KontrolCenter kan stadig redigeres. Kun administratorer kan slå Lockdown fra i
            menuen øverst.
          </p>
        </div>
      </div>
    </div>
  );
}
