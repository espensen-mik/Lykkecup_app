"use client";

import { useEffect, useState } from "react";
import { clearSavedProfile, getSavedProfile, saveSavedProfile, type Lc26SavedKind } from "@/lib/lc26-saved-player";

type Props = {
  kind: Lc26SavedKind;
  entityId: string;
  entityName: string;
  tone?: "default" | "inverse";
};

export function Lc26SavedPlayerControls({ kind, entityId, entityName, tone = "default" }: Props) {
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const p = getSavedProfile();
    setIsSaved(p?.id === entityId && p.kind === kind);
  }, [entityId, kind]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  }

  function handleSave() {
    const ok = saveSavedProfile(kind, entityId, entityName);
    if (!ok) {
      showToast("Kunne ikke gemme — prøv igen, eller tjek om privat browsing blokerer lagring.");
      return;
    }
    setIsSaved(true);
    showToast("Gemt i Mit LykkeCup. Du kan åbne den hurtigt fra forsiden eller menuen.");
  }

  function handleRemove() {
    clearSavedProfile();
    setIsSaved(false);
    showToast("Profilen er fjernet fra Mit LykkeCup.");
  }

  return (
    <div className={tone === "inverse" ? "" : "mb-10"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleSave}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition sm:w-auto ${
            tone === "inverse"
              ? "border border-white/65 bg-white text-lc26-teal hover:bg-white/90"
              : "border border-lc26-teal/45 bg-lc26-teal/[0.06] text-lc26-teal hover:bg-lc26-teal/12"
          }`}
        >
          {isSaved ? "Gemt i Mit LykkeCup" : "Gem i Mit LykkeCup"}
        </button>
        {isSaved ? (
          <button
            type="button"
            onClick={handleRemove}
            className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition sm:w-auto ${
              tone === "inverse"
                ? "border border-white/40 bg-transparent text-white hover:bg-white/10"
                : "border border-stone-200 bg-white text-lc26-navy/70 hover:bg-stone-50"
            }`}
          >
            Fjern fra Mit LykkeCup
          </button>
        ) : null}
      </div>
      {toast ? (
        <p
          className={`mt-3 text-sm leading-relaxed ${tone === "inverse" ? "text-white/85" : "text-lc26-navy/60"}`}
          role="status"
          aria-live="polite"
        >
          {toast}
        </p>
      ) : null}
    </div>
  );
}
