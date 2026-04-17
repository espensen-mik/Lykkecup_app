"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearSavedProfile,
  getSavedProfile,
  getSavedProfileHref,
  LC26_SAVED_PLAYER_KEY,
  type Lc26SavedProfile,
} from "@/lib/lc26-saved-player";

export function MitLykkecupClient() {
  const router = useRouter();
  const [saved, setSaved] = useState<Lc26SavedProfile | null>(null);

  useEffect(() => {
    setSaved(getSavedProfile());
    function onStorage(e: StorageEvent) {
      if (e.key === LC26_SAVED_PLAYER_KEY || e.key === null) setSaved(getSavedProfile());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.75rem]">Mit LykkeCup</h1>

      {!saved ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-[15px] font-medium text-lc26-navy">Ingen gemt profil endnu</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-lc26-navy/50">
            Find din spiller eller træner på forsiden og gem i Mit LykkeCup.
          </p>
          <Link
            href="/lykkecup26"
            className="mt-5 inline-flex rounded-xl bg-lc26-teal px-4 py-2.5 text-sm font-semibold text-white"
          >
            Gå til forsiden
          </Link>
        </div>
      ) : (
        <section className="mt-6 rounded-2xl border border-lc26-teal/30 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-lc26-teal">
            {saved.kind === "coach" ? "Min trænerprofil" : "Min spillerprofil"}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-lc26-navy">{saved.name}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href={getSavedProfileHref(saved)}
              className="inline-flex items-center justify-center rounded-xl bg-lc26-teal px-4 py-2.5 text-sm font-semibold text-white"
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
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-lc26-navy/75"
            >
              Skift profil
            </button>
          </div>
          <p className="mt-5 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={() => {
                clearSavedProfile();
                setSaved(null);
              }}
              className="text-sm font-medium text-lc26-navy/45 underline-offset-2 hover:text-lc26-navy/65 hover:underline"
            >
              Fjern fra Mit LykkeCup
            </button>
          </p>
        </section>
      )}
    </div>
  );
}
