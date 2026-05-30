"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lc26SavedProfileCard } from "@/components/lykkecup26/lc26-saved-profile-card";
import {
  clearSavedProfile,
  getSavedProfile,
  getSavedProfileHref,
  LC26_SAVED_PLAYER_KEY,
  LC26_SAVED_PROFILE_EVENT,
  type Lc26SavedProfile,
} from "@/lib/lc26-saved-player";

export function MitLykkecupClient() {
  const router = useRouter();
  const [saved, setSaved] = useState<Lc26SavedProfile | null>(null);

  useEffect(() => {
    function refreshSaved() {
      setSaved(getSavedProfile());
    }
    refreshSaved();
    window.addEventListener(LC26_SAVED_PROFILE_EVENT, refreshSaved);
    function onStorage(e: StorageEvent) {
      if (e.key === LC26_SAVED_PLAYER_KEY || e.key === null) refreshSaved();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LC26_SAVED_PROFILE_EVENT, refreshSaved);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.75rem]">Mit LykkeCup</h1>

      {!saved ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-[15px] font-medium text-lc26-navy">Ingen gemt profil endnu</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-lc26-navy/50">
            Find din spiller eller træner på forsiden — eller gem dit VIP-program via QR-kortet — og vælg Gem i Mit LykkeCup.
          </p>
          <Link
            href="/lykkecup26"
            className="mt-5 inline-flex rounded-xl bg-lc26-teal px-4 py-2.5 text-sm font-semibold text-white"
          >
            Gå til forsiden
          </Link>
        </div>
      ) : (
        <Lc26SavedProfileCard profile={saved} context="mit">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={getSavedProfileHref(saved)}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-lc26-navy shadow-sm transition hover:bg-stone-50"
            >
              Åbn min side
            </Link>
            <button
              type="button"
              onClick={() => {
                clearSavedProfile();
                setSaved(null);
                router.push("/lykkecup26");
              }}
              className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-medium text-white/95 transition hover:bg-white/15"
            >
              Skift profil
            </button>
          </div>
          <p className="mt-5 border-t border-white/15 pt-4">
            <button
              type="button"
              onClick={() => {
                clearSavedProfile();
                setSaved(null);
              }}
              className="text-sm font-medium text-white/70 underline-offset-2 transition hover:text-white/90 hover:underline"
            >
              Fjern fra Mit LykkeCup
            </button>
          </p>
        </Lc26SavedProfileCard>
      )}
    </div>
  );
}
