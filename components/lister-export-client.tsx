"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { AllTeamsExport } from "@/components/all-teams-export";
import { compareCourtNamesForSchedule, formatTimeForInput } from "@/lib/baner-tider";
import { downloadCsv } from "@/lib/csv";
import { formatCourtWithVenue, type KampprogramMatch } from "@/lib/kampprogram";
import type { ListerCoachRow, ListerPlayerRow, ListerTeamRow } from "@/lib/lister";
import { kontrolCenterTeamDisplayName, type TeamDetailView } from "@/lib/team-detail";

const INGEN_KLUB = "Ingen klub";

type Props = {
  teams: ListerTeamRow[];
  players: ListerPlayerRow[];
  coaches: ListerCoachRow[];
  kampprogramMatches: KampprogramMatch[];
  kampprogramTeamDetails: Record<string, TeamDetailView>;
  fetchError: string | null;
};

type PrintKind =
  | "clubNames"
  | "clubDetails"
  | "alpha"
  | "playersByClub"
  | "mixedByClub"
  | "singleClub"
  | "coachTshirtByClub"
  | "kampprogramChronological"
  | "kampprogramByCourt"
  | null;

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

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function kampprogramVenueLabel(venueName: string): string {
  const lower = venueName.toLocaleLowerCase("da");
  if (lower.includes("boxen")) return "BOXEN";
  if (lower.includes("hal l")) return "Hal L";
  return venueName;
}

function kampprogramVenueSortRank(venueName: string): number {
  const lower = venueName.toLocaleLowerCase("da");
  if (lower.includes("boxen")) return 0;
  if (lower.includes("hal l")) return 1;
  return 2;
}

function normalizeTshirtSize(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const cleaned = raw.toUpperCase().replace(/\s+/g, "");
  const base = cleaned.split("(")[0] ?? cleaned;
  const upper = base.replace(/[^A-Z0-9]/g, "");
  if (upper === "XS") return "XS";
  if (upper === "S") return "S";
  if (upper === "M") return "M";
  if (upper === "L") return "L";
  if (upper === "XL" || upper === "1XL") return "XL";
  if (upper === "XXL" || upper === "2XL") return "2XL";
  if (upper === "XXXL" || upper === "3XL") return "3XL";
  if (upper === "XXXXL" || upper === "4XL") return "4XL";
  return upper;
}

const rowBtnClass =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

export function ListerExportClient({
  teams,
  players,
  coaches,
  kampprogramMatches,
  kampprogramTeamDetails,
  fetchError,
}: Props) {
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

  const sortedCoachTshirtRows = useMemo(
    () =>
      coaches
        .map((c) => ({
          id: c.id,
          club: clubLabelForPerson(c.home_club),
          name: c.name,
          tshirt: normalizeTshirtSize(c.tshirt_size),
        }))
        .sort((a, b) => {
          const byClub = a.club.localeCompare(b.club, "da", { sensitivity: "base" });
          if (byClub !== 0) return byClub;
          const byFirst = firstName(a.name).localeCompare(firstName(b.name), "da", { sensitivity: "base" });
          if (byFirst !== 0) return byFirst;
          return a.name.localeCompare(b.name, "da", { sensitivity: "base" });
        }),
    [coaches],
  );

  const coachTshirtByClubGroups = useMemo(() => {
    const byClub = new Map<string, typeof sortedCoachTshirtRows>();
    for (const row of sortedCoachTshirtRows) {
      const list = byClub.get(row.club) ?? [];
      list.push(row);
      byClub.set(row.club, list);
    }
    const order: string[] = [];
    const seen = new Set<string>();
    for (const row of sortedCoachTshirtRows) {
      if (seen.has(row.club)) continue;
      seen.add(row.club);
      order.push(row.club);
    }
    return order.map((club) => ({ club, rows: byClub.get(club) ?? [] }));
  }, [sortedCoachTshirtRows]);

  const downloadCoachTshirtByClub = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [["Klub", "Træner navn", "T-shirt størrelse"]];
    for (const group of coachTshirtByClubGroups) {
      if (rows.length > 1) rows.push([]);
      for (const row of group.rows) {
        rows.push([group.club, row.name, row.tshirt]);
      }
    }
    downloadCsv("lister-t-shirt-liste-traenere.csv", rows);
  }, [coachTshirtByClubGroups]);

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

  const kampprogramRows = useMemo(
    () =>
      kampprogramMatches
        .filter((m) => !m.isOrphan)
        .map((m) => ({
          id: m.id,
          time: formatTimeForInput(m.startTime) ?? "—",
          venueName: m.venueName?.trim() || "Ukendt hal",
          courtName: m.courtName?.trim() || "—",
          courtLabel: m.courtName ? formatCourtWithVenue(m.courtName, m.venueName) : "—",
          level: m.levelKey || "—",
          pool: m.poolName || "—",
          teamA: kontrolCenterTeamDisplayName(kampprogramTeamDetails[m.teamAId] ?? { teamName: "Ukendt hold", nickname: null, players: [], coaches: [] }),
          teamB: kontrolCenterTeamDisplayName(kampprogramTeamDetails[m.teamBId] ?? { teamName: "Ukendt hold", nickname: null, players: [], coaches: [] }),
        }))
        .sort((a, b) => a.time.localeCompare(b.time, "da") || a.courtLabel.localeCompare(b.courtLabel, "da", { sensitivity: "base" })),
    [kampprogramMatches, kampprogramTeamDetails],
  );

  const kampprogramChronologicalByVenue = useMemo(() => {
    const groups = new Map<string, typeof kampprogramRows>();
    for (const row of kampprogramRows) {
      const list = groups.get(row.venueName) ?? [];
      list.push(row);
      groups.set(row.venueName, list);
    }
    return [...groups.entries()]
      .sort((a, b) => {
        const byVenue =
          kampprogramVenueSortRank(a[0]) - kampprogramVenueSortRank(b[0]) ||
          a[0].localeCompare(b[0], "da", { sensitivity: "base" });
        return byVenue;
      })
      .map(([venueName, rows]) => ({
        venueName,
        venueTitle: kampprogramVenueLabel(venueName),
        rows: [...rows].sort(
          (a, b) =>
            a.time.localeCompare(b.time, "da") ||
            a.courtLabel.localeCompare(b.courtLabel, "da", { sensitivity: "base" }),
        ),
      }));
  }, [kampprogramRows]);

  const kampprogramByCourt = useMemo(() => {
    const groups = new Map<string, typeof kampprogramRows>();
    for (const row of kampprogramRows) {
      const list = groups.get(row.courtLabel) ?? [];
      list.push(row);
      groups.set(row.courtLabel, list);
    }
    return [...groups.entries()]
      .sort((a, b) => compareCourtNamesForSchedule(a[0], b[0]))
      .map(([court, rows]) => ({
        court,
        rows: [...rows].sort((a, b) => a.time.localeCompare(b.time, "da") || a.pool.localeCompare(b.pool, "da", { sensitivity: "base" })),
      }));
  }, [kampprogramRows]);

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

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">T-shirt liste - trænere</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={rowBtnClass} onClick={() => runPrint("coachTshirtByClub")}>
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
              <button type="button" className={rowBtnClass} onClick={downloadCoachTshirtByClub}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Kampprogram - kronologisk</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={rowBtnClass}
                disabled={kampprogramRows.length === 0}
                onClick={() => runPrint("kampprogramChronological")}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
              </button>
            </div>
          </li>

          <li className="flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Kampprogram per bane</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={rowBtnClass}
                disabled={kampprogramByCourt.length === 0}
                onClick={() => runPrint("kampprogramByCourt")}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Udskriv
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

        {printKind === "kampprogramChronological" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Kampprogram - kronologisk</h1>
            {kampprogramChronologicalByVenue.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen kampe i kampprogrammet.</p>
            ) : (
              <div className="space-y-8">
                {kampprogramChronologicalByVenue.map((group) => (
                  <section key={group.venueName} className="lister-print-club-page mb-8 break-inside-avoid">
                    <h2 className="mb-2 border-b-2 border-black pb-1 text-base font-bold">{group.venueTitle}</h2>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={th}>Tid</th>
                          <th className={th}>Bane</th>
                          <th className={th}>Kamp</th>
                          <th className={th}>Niveau</th>
                          <th className={th}>Pulje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id}>
                            <td className={td}>{row.time}</td>
                            <td className={td}>{row.courtName}</td>
                            <td className={td}>
                              {row.teamA} vs. {row.teamB}
                            </td>
                            <td className={td}>{row.level}</td>
                            <td className={td}>{row.pool}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {printKind === "kampprogramByCourt" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">Kampprogram per bane</h1>
            {kampprogramByCourt.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen kampe i kampprogrammet.</p>
            ) : (
              <div className="space-y-8">
                {kampprogramByCourt.map((group) => (
                  <section key={group.court} className="break-inside-avoid">
                    <h2 className="mb-2 border-b-2 border-black pb-1 text-base font-bold">{group.court}</h2>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={th}>Tid</th>
                          <th className={th}>Kamp</th>
                          <th className={th}>Niveau</th>
                          <th className={th}>Pulje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id}>
                            <td className={td}>{row.time}</td>
                            <td className={td}>
                              {row.teamA} vs. {row.teamB}
                            </td>
                            <td className={td}>{row.level}</td>
                            <td className={td}>{row.pool}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {printKind === "coachTshirtByClub" ? (
          <div className="text-black">
            <h1 className="mb-6 text-xl font-bold">T-shirt liste - trænere</h1>
            {coachTshirtByClubGroups.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen trænere i data.</p>
            ) : (
              <div>
                {coachTshirtByClubGroups.map((group) => (
                  <section key={group.club} className="lister-print-club-page mb-8 break-inside-avoid">
                    <h2 className="mb-2 border-b-2 border-black pb-1 text-base font-bold">{group.club}</h2>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={th}>Træner navn</th>
                          <th className={th}>T-shirt størrelse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.id}>
                            <td className={td}>{row.name}</td>
                            <td className={td}>{row.tshirt || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
