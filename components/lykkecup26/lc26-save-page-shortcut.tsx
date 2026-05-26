"use client";

import { useEffect, useState } from "react";
import {
  clearSavedProfile,
  isSavedPageShortcut,
  saveSavedPageShortcut,
} from "@/lib/lc26-saved-player";

type Props = {
  pagePath: string;
  label: string;
};

export function Lc26SavePageShortcut({ pagePath, label }: Props) {
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setIsSaved(isSavedPageShortcut(pagePath));
  }, [pagePath]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  }

  function handleSave() {
    const ok = saveSavedPageShortcut(pagePath, label);
    if (!ok) {
      showToast("Kunne ikke gemme — prøv igen, eller tjek om privat browsing blokerer lagring.");
      return;
    }
    setIsSaved(true);
    showToast("Gemt i Mit LykkeCup. Næste gang åbner appen direkte til dit program.");
  }

  function handleRemove() {
    clearSavedProfile();
    setIsSaved(false);
    showToast("Programmet er fjernet fra Mit LykkeCup.");
  }

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-white p-4 shadow-sm">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-amber-800/80">
        Gem til næste gang
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 sm:w-auto"
        >
          {isSaved ? "Gemt i Mit LykkeCup" : "Gem i Mit LykkeCup"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-lc26-navy/70 hover:bg-stone-50 sm:w-auto"
          >
            Fjern fra Mit LykkeCup
          </button>
        ) : null}
      </div>
      {toast ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-lc26-navy/60" role="status" aria-live="polite">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
