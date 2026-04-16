"use client";

import { Building2, Search, UserCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Lc26HomeBundle } from "@/lib/lykkecup26-public";

type Props = {
  bundle: Lc26HomeBundle;
};

export function Lykkecup26HomeClient({ bundle }: Props) {
  const router = useRouter();
  const { players, error } = bundle;

  const [nameQuery, setNameQuery] = useState("");
  /** Valgt hjemmeklub (præcis streng som i databasen). */
  const [homeClub, setHomeClub] = useState("");
  const [playerPickId, setPlayerPickId] = useState("");

  const clubOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) {
      const c = p.home_club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [players]);

  const nameMatches = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [players, nameQuery]);

  const playersInClub = useMemo(() => {
    if (!homeClub) return [];
    return players
      .filter((p) => (p.home_club?.trim() ?? "") === homeClub)
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
  }, [players, homeClub]);

  function goToPlayer(id: string) {
    if (!id) return;
    router.push(`/lykkecup26/spiller/${id}`);
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50/90 px-5 py-4 text-sm text-red-900">
          Kunne ikke indlæse data. Prøv igen senere.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-10 sm:max-w-2xl sm:px-6 sm:py-14">
      <div className="mb-10 text-center sm:mb-12">
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-stone-900 sm:text-[1.75rem]">
          Find din spiller
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-stone-600">
          Søg efter navn, eller vælg hjemmeklub og spiller — så ser du LykkeCup-hold, holdkammerater, trænere og
          kampprogram.
        </p>
      </div>

      <div className="flex flex-col gap-5 sm:gap-6">
        {/* Navn */}
        <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,118,110,0.12)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-800 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.5)]">
              <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">Søg på navn</h2>
              <label htmlFor="lc26-name" className="sr-only">
                Søg på navn
              </label>
              <input
                id="lc26-name"
                type="search"
                autoComplete="off"
                placeholder="Fx Mads eller Emma …"
                className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-base leading-snug text-stone-900 outline-none ring-teal-500/0 transition placeholder:text-stone-400 focus:border-teal-400/80 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
              {nameMatches.length > 0 ? (
                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-stone-100 bg-white py-1">
                  {nameMatches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-stone-800 transition hover:bg-teal-50/80"
                        onClick={() => goToPlayer(p.id)}
                      >
                        <span>{p.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" strokeWidth={1.75} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : nameQuery.trim().length >= 2 ? (
                <p className="mt-3 text-sm text-stone-500">Ingen spillere matcher.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Hjemmeklub — "hold" i betydning LykkeLigahold / klub */}
        <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,118,110,0.12)] sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-900 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.5)]">
              <Building2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">Vælg hold</h2>
              <p className="mt-1 text-xs font-normal normal-case tracking-normal text-stone-500">
                Baseret på spillerens hjemmeklub
              </p>
              <label htmlFor="lc26-club" className="sr-only">
                Vælg hold ud fra hjemmeklub
              </label>
              <select
                id="lc26-club"
                className="mt-3 w-full cursor-pointer rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-base leading-snug text-stone-900 outline-none ring-teal-500/0 transition focus:border-teal-400/80 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                value={homeClub}
                onChange={(e) => {
                  setHomeClub(e.target.value);
                  setPlayerPickId("");
                }}
              >
                <option value="">Vælg klub …</option>
                {clubOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {!error && clubOptions.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">Der er ingen klubber registreret endnu.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Spiller på valgt klub */}
        {homeClub ? (
          <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,118,110,0.12)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-950 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.45)]">
                <UserCircle2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-stone-500">Vælg spiller</h2>
                <label htmlFor="lc26-player" className="sr-only">
                  Vælg spiller
                </label>
                {playersInClub.length === 0 ? (
                  <p className="mt-3 text-sm text-stone-500">Ingen spillere fra denne klub.</p>
                ) : (
                  <>
                    <select
                      id="lc26-player"
                      className="mt-3 w-full cursor-pointer rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-3 text-base leading-snug text-stone-900 outline-none ring-teal-500/0 transition focus:border-teal-400/80 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                      value={playerPickId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setPlayerPickId(id);
                        if (id) goToPlayer(id);
                      }}
                    >
                      <option value="">Vælg spiller …</option>
                      {playersInClub.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <p className="text-center text-xs text-stone-500">
          Har du brug for hjælp?{" "}
          <Link href="/lykkecup26/side-1" className="font-medium text-teal-800 underline-offset-2 hover:underline">
            Se mere her
          </Link>
        </p>
      </div>
    </div>
  );
}
