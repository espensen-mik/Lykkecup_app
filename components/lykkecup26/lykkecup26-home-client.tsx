"use client";

import { ChevronRight, CircleUserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Lc26HomeBundle } from "@/lib/lykkecup26-public";
import { Lc26FunInboxTeaser } from "@/components/lykkecup26/lc26-fun-inbox";
import {
  getSavedProfile,
  getSavedProfileHref,
  LC26_SAVED_PLAYER_KEY,
  type Lc26SavedProfile,
} from "@/lib/lc26-saved-player";

type Props = {
  bundle: Lc26HomeBundle;
};

const card =
  "rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm sm:p-6";

const fieldBase =
  "mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base leading-snug text-lc26-navy outline-none transition placeholder:text-lc26-navy/35 focus:border-lc26-teal focus:ring-2 focus:ring-lc26-teal/20";

export function Lykkecup26HomeClient({ bundle }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { players, coaches, error } = bundle;

  const [savedProfile, setSavedProfile] = useState<Lc26SavedProfile | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [homeClub, setHomeClub] = useState("");
  /** Format `player:id` eller `coach:id` når valgt fra klublisten. */
  const [clubEntityPick, setClubEntityPick] = useState("");

  useEffect(() => {
    setSavedProfile(getSavedProfile());
  }, [pathname]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === LC26_SAVED_PLAYER_KEY || e.key === null) {
        setSavedProfile(getSavedProfile());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const clubOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) {
      const c = p.home_club?.trim();
      if (c) s.add(c);
    }
    for (const co of coaches) {
      const c = co.home_club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [players, coaches]);

  const nameMatches = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const playerHits = players
      .filter((p) => p.name.toLowerCase().includes(q))
      .map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: p.home_club?.trim() || "Spiller",
        kind: "player" as const,
      }));
    const coachHits = coaches
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.team_names[0] ?? c.home_club?.trim() ?? "Træner",
        kind: "coach" as const,
      }));
    return [...playerHits, ...coachHits]
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }))
      .slice(0, 12);
  }, [players, coaches, nameQuery]);

  const peopleInClub = useMemo(() => {
    if (!homeClub) return [];
    const rows: { kind: "player" | "coach"; id: string; name: string }[] = [
      ...players
        .filter((p) => (p.home_club?.trim() ?? "") === homeClub)
        .map((p) => ({ kind: "player" as const, id: p.id, name: p.name })),
      ...coaches
        .filter((c) => (c.home_club?.trim() ?? "") === homeClub)
        .map((c) => ({ kind: "coach" as const, id: c.id, name: c.name })),
    ];
    return rows.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
  }, [players, coaches, homeClub]);

  function goToEntity(kind: "player" | "coach", id: string) {
    if (!id) return;
    router.push(kind === "coach" ? `/lykkecup26/coach/${id}` : `/lykkecup26/spiller/${id}`);
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-200/90 bg-red-50/95 px-5 py-4 text-sm text-red-950">
          Kunne ikke indlæse data. Prøv igen senere.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="relative mb-16 w-full shrink-0" aria-label="LykkeCup 26">
        <div className="relative h-44 w-full overflow-hidden sm:h-52">
          <Image
            src="/lykkecupheader.jpg"
            alt=""
            fill
            className="object-cover object-[center_25%]"
            priority
            sizes="100vw"
          />
        </div>
        <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-lc26-teal sm:h-32 sm:w-32">
            <Image
              src="/26profile.png"
              alt="LykkeCup 26"
              width={128}
              height={128}
              className="h-full w-full rounded-full object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 sm:max-w-2xl sm:px-6 sm:pb-14">
      {savedProfile ? (
        <section
          className={`mb-8 rounded-2xl p-5 sm:mb-10 sm:p-6 ${
            savedProfile.kind === "coach"
              ? "border border-lc26-navy/80 bg-lc26-navy shadow-[0_14px_34px_-18px_rgb(22_51_88/0.9)]"
              : "border border-lc26-teal/70 bg-lc26-teal shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)]"
          }`}
          aria-labelledby="lc26-saved-heading"
        >
          <p id="lc26-saved-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-white/90">
            Mit LykkeCup
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CircleUserRound className="h-5 w-5 shrink-0 text-white/90" strokeWidth={1.75} aria-hidden />
            <p className="text-xl font-semibold tracking-tight text-white">{savedProfile.name}</p>
          </div>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-white/90">
            {savedProfile.kind === "coach" ? "Cheftræner" : "Håndboldstjerne"}
          </p>
          <p className="mt-1 text-xs text-white/80">Vi husker kun på denne telefon eller browser — uden login.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => router.push(getSavedProfileHref(savedProfile))}
              className={`inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold shadow-sm transition hover:bg-stone-50 active:scale-[0.99] sm:w-auto ${
                savedProfile.kind === "coach" ? "text-lc26-navy" : "text-lc26-teal"
              }`}
            >
              Åbn Mit LykkeCup
            </button>
          </div>
        </section>
      ) : null}

      <p className="mx-auto mb-6 max-w-md text-balance text-center text-base leading-snug text-lc26-navy/55 sm:mb-8">
        Søg efter spiller eller træner og se LykkeCup hold, holdkammerater og kampprogram
      </p>

      <div className="flex flex-col gap-5 sm:gap-6">
        <section className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-lc26-teal">Søg på navn</h2>
          <label htmlFor="lc26-name" className="sr-only">
            Søg på navn
          </label>
          <input
            id="lc26-name"
            type="search"
            autoComplete="off"
            placeholder="Fx Mads eller Emma …"
            className={fieldBase}
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
          />
          {nameMatches.length > 0 ? (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 py-1">
              {nameMatches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-lc26-navy transition hover:bg-lc26-teal/[0.07]"
                    onClick={() => goToEntity(p.kind, p.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{p.name}</span>
                      <span className="block truncate text-xs font-normal text-lc26-navy/45">{p.subtitle}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-lc26-teal/50" strokeWidth={1.75} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : nameQuery.trim().length >= 2 ? (
            <p className="mt-3 text-sm text-lc26-navy/45">Ingen spillere eller trænere matcher.</p>
          ) : null}
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-lc26-teal">Vælg hold</h2>
          <p className="mt-1 text-xs text-lc26-navy/45">Find din hjemmeklub på listen</p>
          <label htmlFor="lc26-club" className="sr-only">
            Vælg hold ud fra hjemmeklub
          </label>
          <select
            id="lc26-club"
            className={`${fieldBase} cursor-pointer`}
            value={homeClub}
            onChange={(e) => {
              setHomeClub(e.target.value);
              setClubEntityPick("");
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
            <div className="mt-4 rounded-xl border border-dashed border-lc26-teal/30 bg-stone-50/80 px-4 py-4 text-center">
              <p className="text-sm font-medium text-lc26-navy/75">Ingen klubber endnu</p>
              <p className="mt-1.5 text-xs leading-relaxed text-lc26-navy/45">
                Når spillere eller trænere er tilmeldt med hjemmeklub, kan du vælge klub her.
              </p>
            </div>
          ) : null}
        </section>

        {homeClub ? (
          <section className={card}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-lc26-teal">Vælg navn</h2>
            <p className="mt-1 text-xs text-lc26-navy/45">Find dit navn på listen</p>
            <label htmlFor="lc26-club-name" className="sr-only">
              Vælg navn på listen for den valgte klub
            </label>
            {peopleInClub.length === 0 ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 px-4 py-5 text-center">
                <p className="text-sm font-medium text-lc26-navy/75">Ingen spillere eller trænere fra denne klub</p>
                <p className="mt-1.5 text-xs leading-relaxed text-lc26-navy/45">
                  Tjek at klubnavnet matcher, eller søg på navn øverst.
                </p>
              </div>
            ) : (
              <select
                id="lc26-club-name"
                className={`${fieldBase} cursor-pointer`}
                value={clubEntityPick}
                onChange={(e) => {
                  const v = e.target.value;
                  setClubEntityPick(v);
                  if (!v) return;
                  const colon = v.indexOf(":");
                  if (colon < 1) return;
                  const kind = v.slice(0, colon) as "player" | "coach";
                  const id = v.slice(colon + 1);
                  if (id && (kind === "player" || kind === "coach")) goToEntity(kind, id);
                }}
              >
                <option value="">Vælg navn …</option>
                {peopleInClub.map((e) => (
                  <option key={`${e.kind}-${e.id}`} value={`${e.kind}:${e.id}`}>
                    {e.name}
                    {e.kind === "coach" ? " · træner" : ""}
                  </option>
                ))}
              </select>
            )}
          </section>
        ) : null}

        <p className="text-center text-xs text-lc26-navy/42">
          Har du brug for hjælp?{" "}
          <Link href="/lykkecup26/side-1" className="font-medium text-lc26-teal underline-offset-2 hover:underline">
            Se mere her
          </Link>
        </p>
      </div>
      </div>

      <Lc26FunInboxTeaser />
    </div>
  );
}
