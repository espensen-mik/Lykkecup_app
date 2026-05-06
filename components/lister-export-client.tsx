"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { AllTeamsExport } from "@/components/all-teams-export";
import { downloadCsv } from "@/lib/csv";
import type { ListerCoachRow, ListerPlayerRow, ListerTeamRow } from "@/lib/lister";

const INGEN_KLUB = "Ingen klub";

type Props = {
  teams: ListerTeamRow[];
  players: ListerPlayerRow[];
  coaches: ListerCoachRow[];
  fetchError: string | null;
};

type PrintKind = "clubNames" | "clubDetails" | "alpha" | "playersByClub" | "mixedByClub" | "singleClub" | null;

function csvSlug(s: string): string {
  return s
    .trim()
    .slice(0, 40)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "klub";
}

function sortClubLabels(named: string[], includeIngen: boolean): string[] {
  const sorted = [...named].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  if (includeIngen) sorted.push(INGEN_KLUB);
  return sorted;
}

function clubLabelForPerson(home: string | null): string {
  return home && home.trim() ? home.trim() : INGEN_KLUB;
}

const rowBtnClass =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

export function ListerExportClient({ teams, players, coaches, fetchError }: Props) {
  const [printKind, setPrintKind] = useState<PrintKind>(null);
  const [selectedClub, setSelectedClub] = useState<string>("");

  const namedClubs = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) if (p.home_club) set.add(p.home_club);
    for (const c of coaches) if (c.home_club) set.add(c.home_club);
    return [...set].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [players, coaches]);

  const includeIngenKlub = useMemo(
    () => players.some((p) => !p.home_club?.trim()) || coaches.some((c) => !c.home_club?.trim()),
    [players, coaches],
  );

  const clubOrder = useMemo(
    () => sortClubLabels(namedClubs, includeIngenKlub),
    [namedClubs, includeIngenKlub],
  );

  useEffect(() => {
    if (clubOrder.length === 0) {
      setSelectedClub("");
      return;
    }
    setSelectedClub((cur) => (cur && clubOrder.includes(cur) ? cur : clubOrder[0]!));
  }, [clubOrder]);

  useEffect(() => {
    const onAfter = () => setPrintKind(null);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  function runPrint(kind: Exclude<PrintKind, null>) {
    setPrintKind(kind);
    setTimeout(() => window.print(), 0);
  }

  const downloadClubNamesCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [["Klubnavn"], ...clubOrder.map((name) => [name])];
    downloadCsv("lister-klubnavne.csv", rows);
  }, [clubOrder]);

  const downloadAlpha = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Navn", "Hjemmeklub", "Spiller_niveau", "Alder", "Køn", "Hold"],
      ...players.map((p) => [
        p.name,
        p.home_club ?? "",
        p.level ?? "",
        p.age != null ? p.age : "",
        p.gender ?? "",
        p.team_display ?? "",
      ]),
    ];
    downloadCsv("lister-alle-spillere-alfabetisk.csv", rows);
  }, [players]);

  const downloadPlayersByClub = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Hjemmeklub", "Navn", "Spiller_niveau", "Alder", "Køn", "Hold"],
    ];
    for (const klub of clubOrder) {
      const plist = players
        .filter((p) => clubLabelForPerson(p.home_club) === klub)
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
      for (const p of plist) {
        rows.push([
          klub,
          p.name,
          p.level ?? "",
          p.age != null ? p.age : "",
          p.gender ?? "",
          p.team_display ?? "",
        ]);
      }
    }
    downloadCsv("lister-spillere-fordelt-pa-klub.csv", rows);
  }, [players, clubOrder]);

  const downloadMixedByClub = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Hjemmeklub", "Rolle", "Navn", "Alder", "Spiller_niveau", "Køn", "Hold"],
    ];
    for (const klub of clubOrder) {
      const plist = players
        .filter((p) => clubLabelForPerson(p.home_club) === klub)
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
      for (const p of plist) {
        rows.push([
          klub,
          "Spiller",
          p.name,
          p.age != null ? p.age : "",
          p.level ?? "",
          p.gender ?? "",
          p.team_display ?? "",
        ]);
      }
      const clist = coaches
        .filter((c) => clubLabelForPerson(c.home_club) === klub)
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
      for (const c of clist) {
        rows.push([klub, "Træner", c.name, c.age != null ? c.age : "", "", "", ""]);
      }
    }
    downloadCsv("lister-traenere-og-spillere-fordelt-pa-klub.csv", rows);
  }, [players, coaches, clubOrder]);

  const downloadSingleClub = useCallback(() => {
    if (!selectedClub) return;
    const slug = csvSlug(selectedClub);
    const rows: (string | number | null | undefined)[][] = [
      ["Hjemmeklub", "Rolle", "Navn", "Alder", "Spiller_niveau", "Køn", "Hold"],
    ];
    for (const p of players
      .filter((p) => clubLabelForPerson(p.home_club) === selectedClub)
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }))) {
      rows.push([
        selectedClub,
        "Spiller",
        p.name,
        p.age != null ? p.age : "",
        p.level ?? "",
        p.gender ?? "",
        p.team_display ?? "",
      ]);
    }
    for (const c of coaches
      .filter((c) => clubLabelForPerson(c.home_club) === selectedClub)
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }))) {
      rows.push([selectedClub, "Træner", c.name, c.age != null ? c.age : "", "", "", ""]);
    }
    downloadCsv(`lister-spillere-og-traenere-${slug}.csv`, rows);
  }, [players, coaches, selectedClub]);

  const playersForPrintClub = useCallback(
    (klub: string) =>
      players
        .filter((p) => clubLabelForPerson(p.home_club) === klub)
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" })),
    [players],
  );

  const coachesForPrintClub = useCallback(
    (klub: string) =>
      coaches
        .filter((c) => clubLabelForPerson(c.home_club) === klub)
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" })),
    [coaches],
  );

  const singleClubPlayers = useMemo(
    () => (selectedClub ? playersForPrintClub(selectedClub) : []),
    [selectedClub, playersForPrintClub],
  );
  const singleClubCoaches = useMemo(
    () => (selectedClub ? coachesForPrintClub(selectedClub) : []),
    [selectedClub, coachesForPrintClub],
  );

  const clubDetails = useMemo(
    () =>
      clubOrder.map((club) => ({
        club,
        playersCount: players.filter((p) => clubLabelForPerson(p.home_club) === club).length,
        coachesCount: coaches.filter((c) => clubLabelForPerson(c.home_club) === club).length,
      })),
    [clubOrder, players, coaches],
  );

  const downloadClubDetailsCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Klub", "Antal spillere", "Antal trænere"],
      ...clubDetails.map((r) => [r.club, r.playersCount, r.coachesCount]),
    ];
    downloadCsv("lister-klub-detaljer.csv", rows);
  }, [clubDetails]);

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Kunne ikke indlæse data: {fetchError}
      </div>
    );
  }

  const th = "border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide";
  const td = "border-b border-neutral-300 px-2 py-1.5 text-sm";

  return (
    <>
      <div className="print:hidden space-y-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Vælg en liste og hent CSV eller udskriv. Indhold vises kun i udskrift / fil — ikke på skærmen.
        </p>

        <ul className="space-y-4">
          <li>
            <AllTeamsExport teams={teams} players={players} />
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Alle klubnavne</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={rowBtnClass}
                disabled={clubOrder.length === 0}
                onClick={() => runPrint("clubNames")}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button
                type="button"
                className={rowBtnClass}
                disabled={clubOrder.length === 0}
                onClick={downloadClubNamesCsv}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Klub detaljer</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={rowBtnClass}
                disabled={clubDetails.length === 0}
                onClick={() => runPrint("clubDetails")}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button
                type="button"
                className={rowBtnClass}
                disabled={clubDetails.length === 0}
                onClick={downloadClubDetailsCsv}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Alle spillere alfabetisk</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={rowBtnClass} onClick={() => runPrint("alpha")}>
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button type="button" className={rowBtnClass} onClick={downloadAlpha}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Alle spillere fordelt på klub</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={rowBtnClass} onClick={() => runPrint("playersByClub")}>
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button type="button" className={rowBtnClass} onClick={downloadPlayersByClub}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Trænere og spillere fordelt på klub
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={rowBtnClass} onClick={() => runPrint("mixedByClub")}>
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button type="button" className={rowBtnClass} onClick={downloadMixedByClub}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Spillere og trænere fra denne klub
                </span>
                <label className="mt-2 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Klub (hjemmeklub)
                  <select
                    value={selectedClub}
                    onChange={(e) => setSelectedClub(e.target.value)}
                    disabled={clubOrder.length === 0}
                    className="mt-1 block w-full max-w-md rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  >
                    {clubOrder.length === 0 ? <option value="">Ingen klubber i data</option> : null}
                    {clubOrder.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  className={rowBtnClass}
                  disabled={!selectedClub}
                  onClick={() => runPrint("singleClub")}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  Udskriv
                </button>
                <button type="button" className={rowBtnClass} disabled={!selectedClub} onClick={downloadSingleClub}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  CSV
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      {/* Kun synlig ved udskrift */}
      <div className="hidden print:block">
        {printKind === "clubNames" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Alle klubnavne</h1>
            {clubOrder.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen klubnavne i data.</p>
            ) : (
              <table className="w-full max-w-xl border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Klubnavn</th>
                  </tr>
                </thead>
                <tbody>
                  {clubOrder.map((name) => (
                    <tr key={name}>
                      <td className={td}>{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {printKind === "clubDetails" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Klub detaljer</h1>
            {clubDetails.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen klubber i data.</p>
            ) : (
              <table className="w-full max-w-2xl border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Klub</th>
                    <th className={th}>Antal spillere</th>
                    <th className={th}>Antal trænere</th>
                  </tr>
                </thead>
                <tbody>
                  {clubDetails.map((row) => (
                    <tr key={row.club}>
                      <td className={td}>{row.club}</td>
                      <td className={td}>{row.playersCount}</td>
                      <td className={td}>{row.coachesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {printKind === "alpha" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Alle spillere (alfabetisk)</h1>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Navn</th>
                  <th className={th}>Hjemmeklub</th>
                  <th className={th}>Niveau</th>
                  <th className={th}>Alder</th>
                  <th className={th}>Køn</th>
                  <th className={th}>Hold</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className={td}>{p.name}</td>
                    <td className={td}>{p.home_club ?? "—"}</td>
                    <td className={td}>{p.level ?? "—"}</td>
                    <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                    <td className={td}>{p.gender ?? "—"}</td>
                    <td className={td}>{p.team_display ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {printKind === "playersByClub" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Spillere fordelt på klub</h1>
            <div className="space-y-8">
              {clubOrder.map((klub) => {
                const plist = playersForPrintClub(klub);
                return (
                  <section key={klub} className="break-inside-avoid">
                    <h2 className="mb-2 border-b-2 border-black pb-1 text-base font-bold">{klub}</h2>
                    {plist.length === 0 ? (
                      <p className="text-sm text-neutral-600">Ingen spillere.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Navn</th>
                            <th className={th}>Niveau</th>
                            <th className={th}>Alder</th>
                            <th className={th}>Køn</th>
                            <th className={th}>Hold</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plist.map((p) => (
                            <tr key={p.id}>
                              <td className={td}>{p.name}</td>
                              <td className={td}>{p.level ?? "—"}</td>
                              <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                              <td className={td}>{p.gender ?? "—"}</td>
                              <td className={td}>{p.team_display ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}

        {printKind === "mixedByClub" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Trænere og spillere fordelt på klub</h1>
            <div className="space-y-8">
              {clubOrder.map((klub) => {
                const plist = playersForPrintClub(klub);
                const clist = coachesForPrintClub(klub);
                return (
                  <section key={klub} className="break-inside-avoid">
                    <h2 className="mb-3 border-b-2 border-black pb-1 text-base font-bold">{klub}</h2>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Spillere</p>
                    {plist.length === 0 ? (
                      <p className="mb-4 text-sm text-neutral-600">Ingen.</p>
                    ) : (
                      <table className="mb-4 w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Navn</th>
                            <th className={th}>Niveau</th>
                            <th className={th}>Alder</th>
                            <th className={th}>Køn</th>
                            <th className={th}>Hold</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plist.map((p) => (
                            <tr key={p.id}>
                              <td className={td}>{p.name}</td>
                              <td className={td}>{p.level ?? "—"}</td>
                              <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                              <td className={td}>{p.gender ?? "—"}</td>
                              <td className={td}>{p.team_display ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Trænere</p>
                    {clist.length === 0 ? (
                      <p className="text-sm text-neutral-600">Ingen.</p>
                    ) : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className={th}>Navn</th>
                            <th className={th}>Alder</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clist.map((c) => (
                            <tr key={c.id}>
                              <td className={td}>{c.name}</td>
                              <td className={td}>{c.age != null ? String(c.age) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}

        {printKind === "singleClub" && selectedClub ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Spillere og trænere — {selectedClub}</h1>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Spillere</p>
            {singleClubPlayers.length === 0 ? (
              <p className="mb-6 text-sm text-neutral-600">Ingen spillere med denne hjemmeklub.</p>
            ) : (
              <table className="mb-6 w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Navn</th>
                    <th className={th}>Niveau</th>
                    <th className={th}>Alder</th>
                    <th className={th}>Køn</th>
                    <th className={th}>Hold</th>
                  </tr>
                </thead>
                <tbody>
                  {singleClubPlayers.map((p) => (
                    <tr key={p.id}>
                      <td className={td}>{p.name}</td>
                      <td className={td}>{p.level ?? "—"}</td>
                      <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                      <td className={td}>{p.gender ?? "—"}</td>
                      <td className={td}>{p.team_display ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Trænere</p>
            {singleClubCoaches.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen trænere med denne hjemmeklub.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Navn</th>
                    <th className={th}>Alder</th>
                  </tr>
                </thead>
                <tbody>
                  {singleClubCoaches.map((c) => (
                    <tr key={c.id}>
                      <td className={td}>{c.name}</td>
                      <td className={td}>{c.age != null ? String(c.age) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
