"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";

function PlanningLockdownBanner({ message, viewOnly }: { message: string; viewOnly: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center p-4 pt-8 sm:pt-12">
      <div
        role="status"
        className="pointer-events-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-center shadow-lg dark:border-amber-800 dark:bg-amber-950/90"
      >
        <Lock className="mx-auto h-8 w-8 text-amber-700 dark:text-amber-300" strokeWidth={2} aria-hidden />
        <p className="mt-3 text-base font-semibold text-amber-950 dark:text-amber-50">Lockdown er aktiv</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">{message}</p>
        <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80">
          {viewOnly
            ? "Du kan stadig gennemse kampprogrammet og filtrere — men ikke redigere eller flytte kampe. App Indhold kan stadig redigeres."
            : "App Indhold og øvrige dele af KontrolCenter kan stadig redigeres. Kun administratorer kan slå Lockdown fra i menuen øverst."}
        </p>
      </div>
    </div>
  );
}

/**
 * Skjuler interaktion på Holddannelse/Turnering når Lockdown er aktiv.
 * `viewOnly` (Kampprogram): vis lockdown-banner, men lad filtre og visning virke — redigering håndteres lokalt.
 */
export function PlanningLockdownGate({
  children,
  viewOnly = false,
}: {
  children: ReactNode;
  viewOnly?: boolean;
}) {
  const { planningLockdown, message } = useKontrolcenterLockdown();

  if (!planningLockdown) {
    return <>{children}</>;
  }

  if (viewOnly) {
    return (
      <div className="relative min-h-[12rem]">
        {children}
        <PlanningLockdownBanner message={message} viewOnly />
      </div>
    );
  }

  return (
    <div className="relative min-h-[12rem]">
      <div
        className={[
          "opacity-75",
          // Keep pages fully readable/scrollable, but disable edit controls.
          "[&_button]:pointer-events-none [&_button]:cursor-not-allowed [&_button]:opacity-60",
          "[&_input]:pointer-events-none [&_input]:cursor-not-allowed [&_input]:opacity-60",
          "[&_select]:pointer-events-none [&_select]:cursor-not-allowed [&_select]:opacity-60",
          "[&_textarea]:pointer-events-none [&_textarea]:cursor-not-allowed [&_textarea]:opacity-60",
          "[&_[role='switch']]:pointer-events-none [&_[role='button']]:pointer-events-none",
          "[&_[contenteditable='true']]:pointer-events-none [&_[contenteditable='true']]:opacity-60",
        ].join(" ")}
      >
        {children}
      </div>
      <PlanningLockdownBanner message={message} viewOnly={false} />
    </div>
  );
}
