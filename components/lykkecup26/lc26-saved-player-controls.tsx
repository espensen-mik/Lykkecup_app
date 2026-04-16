"use client";

import { useEffect, useState } from "react";
import { clearSavedPlayer, getSavedPlayer, saveSavedPlayer } from "@/lib/lc26-saved-player";

type Props = {
  playerId: string;
  playerName: string;
};

export function Lc26SavedPlayerControls({ playerId, playerName }: Props) {
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const p = getSavedPlayer();
    setIsSaved(p?.id === playerId);
  }, [playerId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  }

  function handleSave() {
    const ok = saveSavedPlayer(playerId, playerName);
    if (!ok) {
      showToast("Kunne ikke gemme — prøv igen, eller tjek om privat browsing blokerer lagring.");
      return;
    }
    setIsSaved(true);
    showToast("Sådan — vi husker dig her på denne enhed. Find hurtigt tilbage fra forsiden.");
  }

  function handleRemove() {
    clearSavedPlayer();
    setIsSaved(false);
    showToast("Gemt spiller er fjernet. Du kan altid gemme igen.");
  }

  return (
    <div className="mb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {isSaved ? (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex w-full items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-lc26-navy/75 transition hover:border-stone-300 hover:bg-stone-50 sm:w-auto"
          >
            Fjern som min spiller
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex w-full items-center justify-center rounded-xl border border-lc26-teal/45 bg-lc26-teal/[0.06] px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/12 sm:w-auto"
          >
            Gem som min spiller
          </button>
        )}
      </div>
      {toast ? (
        <p className="mt-3 text-sm leading-relaxed text-lc26-navy/60" role="status" aria-live="polite">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
