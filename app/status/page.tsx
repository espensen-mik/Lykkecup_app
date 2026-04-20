"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StyledSelect } from "@/components/ui/styled-select";
import { supabase } from "@/lib/supabase";
import { LYKKECUP_EVENT_ID } from "@/lib/players";

type PlayerRow = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
  level: string | null;
};

type CoachRow = {
  id: string;
  name: string;
  home_club: string | null;
};

const INTRO_TEXT =
  "Her kan du se hvilke spillere og trænere, der er tilmeldt fra dit LykkeLigahold.";
const SNAPSHOT_LABEL = "Data er udtrukket:";
const SNAPSHOT_TIME = "20. April - 16.00";

const FREDE_MESSAGE =
  "Hej alle. Vi glæder os helt vildt til at se jer til LykkeCup. Her kan I se, hvem der er tilmeldt fra jeres hold. Når tilmeldingen er lukket får trænerne på det enkelte hold mulighed for at kommentere på niveauer og holdsammensætning. Hvis I har spørgsmål her og nu så skriv til mig på frederikke@lykkeliga.dk.\n\nOg hvis I kan se, at der er spillere og trænere på jeres hold der mangler at melde sig til - så prik lige til dem. Sidste frist for tilmelding er 1. maj";

const FREDE_TITLE = "Lykkelig medarbejder hos LykkeLiga";

function uniqueClubs(rows: { home_club: string | null }[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const c = r.home_club?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "da"));
}

export const dynamic = "force-dynamic";

export default function StatusPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [clubs, setClubs] = useState<string[]>([]);

  const [selectedClub, setSelectedClub] = useState<string>("");
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingBootstrap(true);
    setLoadError(null);

    const [{ data: pData, error: pErr }, { data: cData, error: cErr }] = await Promise.all([
      supabase
        .from("players")
        .select("id, name, home_club, age, level")
        .eq("event_id", LYKKECUP_EVENT_ID),
      supabase
        .from("coaches")
        .select("id, name, home_club")
        .eq("event_id", LYKKECUP_EVENT_ID),
    ]);

    if (pErr || cErr) {
      setLoadError((pErr ?? cErr)?.message ?? "Kunne ikke indlæse data.");
      setPlayers([]);
      setCoaches([]);
      setClubs([]);
      setSelectedClub("");
      setLoadingBootstrap(false);
      return;
    }

    const pRows = (pData ?? []) as PlayerRow[];
    const cRows = (cData ?? []) as CoachRow[];

    setPlayers(
      pRows
        .filter((p) => Boolean(p.id))
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" })),
    );
    setCoaches(
      cRows
        .filter((c) => Boolean(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" })),
    );

    const clubList = uniqueClubs([
      ...pRows.map((p) => ({ home_club: p.home_club })),
      ...cRows.map((c) => ({ home_club: c.home_club })),
    ]);
    setClubs(clubList);

    setSelectedClub("");
    setLoadingBootstrap(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPlayers = useMemo(() => {
    if (!selectedClub) return [];
    return players.filter((p) => (p.home_club ?? "") === selectedClub);
  }, [players, selectedClub]);

  const filteredCoaches = useMemo(() => {
    if (!selectedClub) return [];
    return coaches.filter((c) => (c.home_club ?? "") === selectedClub);
  }, [coaches, selectedClub]);

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 py-10 pb-8 sm:px-6 sm:py-14">
      <header className="mb-8 sm:mb-12">
        {/* Mobil: fuld bredde header-billede */}
        <div className="relative left-1/2 mb-8 w-screen max-w-[100vw] -translate-x-1/2 lg:hidden">
          <div className="relative aspect-[1920/800] w-full overflow-hidden bg-gray-200">
            <img
              src="/lykkecup_app_header.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>

        {/* Desktop: event-logo centreret øverst (samme som coach-feedback) */}
        <div className="mb-8 hidden justify-center lg:flex">
          <img
            src="/LykkeCUP26_blue.svg"
            alt="LykkeCup 2026"
            className="h-auto w-[200px] max-w-full object-contain object-center"
          />
        </div>

        <div className="mx-auto max-w-xl text-[15px] leading-relaxed text-gray-600 lg:mx-0">
          <p>{INTRO_TEXT}</p>
          <p className="mt-3">
            <span>{SNAPSHOT_LABEL} </span>
            <span className="inline-flex rounded-full bg-[#14b8a6] px-3 py-1 text-xs font-semibold tracking-wide text-white shadow-sm">
              {SNAPSHOT_TIME}
            </span>
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          className="mb-6 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="club-select" className="block text-sm font-medium text-gray-800">
          Klub
        </label>
        <StyledSelect
          id="club-select"
          wrapperClassName="mt-2"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-gray-900 shadow-sm outline-none ring-teal-500/20 transition focus:border-teal-500 focus:ring-4 disabled:opacity-60"
          value={selectedClub}
          onChange={(e) => setSelectedClub(e.target.value)}
          disabled={loadingBootstrap || clubs.length === 0}
        >
          <option value="">{loadingBootstrap ? "Indlæser klubber …" : "Vælg klub"}</option>
          {clubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </StyledSelect>
        {!loadingBootstrap && clubs.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Der er ingen klubber registreret for dette arrangement.</p>
        ) : null}
      </section>

      {loadingBootstrap ? (
        <p className="text-sm text-gray-500">Indlæser deltagere …</p>
      ) : (
        <>
          <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Tilmeldte spillere</h2>
            {!selectedClub ? (
              <p className="mt-4 text-sm text-gray-500">Vælg en klub ovenfor for at se spillere.</p>
            ) : filteredPlayers.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Ingen spillere fundet for denne klub.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200/90 shadow-sm">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 font-medium text-gray-700">Navn</th>
                      <th className="px-3 py-2.5 font-medium text-gray-700">Alder</th>
                      <th className="px-3 py-2.5 font-medium text-gray-700">Niveau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p, index) => (
                      <tr
                        key={p.id}
                        className={
                          (index % 2 === 0 ? "bg-white" : "bg-emerald-50/70") +
                          (index < filteredPlayers.length - 1 ? " border-b border-gray-100/90" : "")
                        }
                      >
                        <td className="px-3 py-2.5 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {p.age != null && !Number.isNaN(p.age) ? p.age : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{p.level?.trim() || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Tilmeldte trænere</h2>
            {!selectedClub ? (
              <p className="mt-4 text-sm text-gray-500">Vælg en klub ovenfor for at se trænere.</p>
            ) : filteredCoaches.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Ingen trænere fundet for denne klub.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200/90 shadow-sm">
                <table className="w-full min-w-[220px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 font-medium text-gray-700">Navn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoaches.map((c, index) => (
                      <tr
                        key={c.id}
                        className={
                          (index % 2 === 0 ? "bg-white" : "bg-emerald-50/70") +
                          (index < filteredCoaches.length - 1 ? " border-b border-gray-100/90" : "")
                        }
                      >
                        <td className="px-3 py-2.5 font-medium text-gray-900">{c.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Frederikke info-boks (samme stil som coach-feedback siden) */}
      <section className="mt-8 rounded-2xl border border-sky-100 bg-sky-50/60 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <img
            src="/Frede.jpg"
            alt="Frederikke"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-sky-200 sm:h-11 sm:w-11"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Frederikke</p>
            <p className="mt-0.5 text-xs text-gray-600">{FREDE_TITLE}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {FREDE_MESSAGE.split("\n\n")[0].replace(/frederikke@lykkeliga\.dk\.?/i, "")}
              <a
                href="mailto:frederikke@lykkeliga.dk"
                className="font-semibold text-sky-800 underline-offset-2 hover:underline"
              >
                frederikke@lykkeliga.dk
              </a>
              {"\n\n"}
              <strong>{FREDE_MESSAGE.split("\n\n")[1]}</strong>
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-10 border-t border-gray-200/90 pt-10 pb-6 dark:border-gray-700">
        <div className="flex justify-center">
          <img
            src="/lykkeliga-logo.svg"
            alt="Lykkeliga"
            className="h-5 w-auto max-w-[7rem] object-contain opacity-90 sm:h-6"
          />
        </div>
      </footer>
    </main>
  );
}

