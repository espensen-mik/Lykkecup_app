"use client";

import { useEffect, useState } from "react";
import { getSavedProfile, saveSavedProfile, type Lc26SavedKind } from "@/lib/lc26-saved-player";

type Props = {
  kind: Lc26SavedKind;
  entityId: string;
  entityName: string;
};

export function Lc26SavedPlayerControls({ kind, entityId, entityName }: Props) {
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

  return (
    <div className="mb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center rounded-xl border border-lc26-teal/45 bg-lc26-teal/[0.06] px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/12 sm:w-auto"
        >
          {isSaved ? "Gemt i Mit LykkeCup" : "Gem i Mit LykkeCup"}
        </button>
      </div>
      {toast ? (
        <p className="mt-3 text-sm leading-relaxed text-lc26-navy/60" role="status" aria-live="polite">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
