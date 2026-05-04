"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import type { ListerPlayerRow, ListerTeamRow } from "@/lib/lister";

type PrintFocus =
  | "all"
  | "team-names"
  | "players-by-team"
  | "single-team"
  | "all-players"
  | "unassigned";

type Props = {
  teams: ListerTeamRow[];
  players: ListerPlayerRow[];
  fetchError: string | null;
};

function sectionPrintClass(printFocus: PrintFocus, focus: PrintFocus): string {
  if (printFocus === "all") return "";
  return printFocus === focus ? "" : "print:hidden";
}

function csvFileSlugPart(raw: string): string {
  const s = raw
    .trim()
    .slice(0, 48)
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return s.length > 0 ? s : "hold";
}

const actionBtnClass =
  "print:hidden inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800";

export function ListerExportClient({ teams, players, fetchError }: Props) {
  const [printFocus, setPrintFocus] = useState<PrintFocus>("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => teams[0]?.id ?? "");

  useEffect(() => {
    const onAfter = () => setPrintFocus("all");
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  useEffect(() => {
    if (teams.length === 0) {
      setSelectedTeamId("");
      return;
    }
    setSelectedTeamId((cur) => (cur && teams.some((t) => t.id === cur) ? cur : teams[0]!.id));
  }, [teams]);

  function runPrint(focus: PrintFocus) {
    setPrintFocus(focus);
    setTimeout(() => window.print(), 0);
  }

  const playersByTeamBlocks = useMemo(() => {
    const byTeam = new Map<string, ListerPlayerRow[]>();
    for (const p of players) {
      if (!p.team_id) continue;
      const list = byTeam.get(p.team_id) ?? [];
      list.push(p);
      byTeam.set(p.team_id, list);
    }
    for (const list of byTeam.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    }
    return teams.map((t) => ({
      team: t,
      players: byTeam.get(t.id) ?? [],
    }));
  }, [teams, players]);

  const unassigned = useMemo(() => {
    const list = players.filter((p) => !p.team_id);
    list.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    return list;
  }, [players]);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === selectedTeamId), [teams, selectedTeamId]);

  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeamId) return [];
    return players
      .filter((p) => p.team_id === selectedTeamId)
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
  }, [players, selectedTeamId]);

  const downloadTeamNamesCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Niveau", "Kaldenavn_visning", "Officielt_navn"],
      ...teams.map((t) => [t.levelKey, t.displayName, t.officialName]),
    ];
    downloadCsv("lister-holdnavne.csv", rows);
  }, [teams]);

  const downloadPlayersByTeamCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      [
        "Hold_niveau",
        "Hold_visning",
        "Hold_officielt_navn",
        "Navn",
        "Hjemmeklub",
        "Spiller_niveau",
        "Alder",
      ],
    ];
    for (const { team, players: plist } of playersByTeamBlocks) {
      for (const p of plist) {
        rows.push([
          team.levelKey,
          team.displayName,
          team.officialName,
          p.name,
          p.home_club ?? "",
          p.level ?? "",
          p.age != null ? p.age : "",
        ]);
      }
    }
    downloadCsv("lister-spillere-efter-hold.csv", rows);
  }, [playersByTeamBlocks]);

  const downloadSingleTeamCsv = useCallback(() => {
    if (!selectedTeam) return;
    const slug = csvFileSlugPart(`${selectedTeam.levelKey}-${selectedTeam.displayName}`);
    const rows: (string | number | null | undefined)[][] = [
      ["Hold_niveau", "Hold_visning", "Hold_officielt_navn", "Navn", "Hjemmeklub", "Spiller_niveau", "Alder", "Køn"],
      ...selectedTeamPlayers.map((p) => [
        selectedTeam.levelKey,
        selectedTeam.displayName,
        selectedTeam.officialName,
        p.name,
        p.home_club ?? "",
        p.level ?? "",
        p.age != null ? p.age : "",
        p.gender ?? "",
      ]),
    ];
    downloadCsv(`lister-hold-${slug}.csv`, rows);
  }, [selectedTeam, selectedTeamPlayers]);

  const downloadAllPlayersCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Navn", "Hjemmeklub", "Spiller_niveau", "Alder", "Køn", "Hold_visning"],
      ...players.map((p) => [
        p.name,
        p.home_club ?? "",
        p.level ?? "",
        p.age != null ? p.age : "",
        p.gender ?? "",
        p.team_display ?? "",
      ]),
    ];
    downloadCsv("lister-alle-spillere.csv", rows);
  }, [players]);

  const downloadUnassignedCsv = useCallback(() => {
    const rows: (string | number | null | undefined)[][] = [
      ["Navn", "Hjemmeklub", "Spiller_niveau", "Alder", "Køn"],
      ...unassigned.map((p) => [p.name, p.home_club ?? "", p.level ?? "", p.age != null ? p.age : "", p.gender ?? ""]),
    ];
    downloadCsv("lister-spillere-uden-hold.csv", rows);
  }, [unassigned]);

  const downloadAllCsvs = useCallback(() => {
    const fns = [
      downloadTeamNamesCsv,
      downloadPlayersByTeamCsv,
      downloadSingleTeamCsv,
      downloadAllPlayersCsv,
      downloadUnassignedCsv,
    ];
    fns.forEach((fn, i) => setTimeout(fn, i * 220));
  }, [
    downloadTeamNamesCsv,
    downloadPlayersByTeamCsv,
    downloadSingleTeamCsv,
    downloadAllPlayersCsv,
    downloadUnassignedCsv,
  ]);

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Kunne ikke indlæse data: {fetchError}
      </div>
    );
  }

  const th =
    "border-b border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300";
  const td = "border-b border-gray-100 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:text-gray-100";
  const sectionBox =
    "rounded-xl border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none";
  const sectionHead = "flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6";
  const h2 = "text-lg font-semibold tracking-tight text-gray-900 dark:text-white";
  const topBtnClass =
    "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

  return (
    <div className="space-y-8">
      <div className="print:hidden flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runPrint("all")} className={topBtnClass}>
            <Printer className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Udskriv alt
          </button>
          <button type="button" onClick={downloadAllCsvs} className={topBtnClass}>
            <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Download alle CSV
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Udskrift: browser eller PDF. CSV: UTF-8 med BOM (Excel-venlig). Knappen Download alle CSV henter fem filer,
          inkl. det hold du har valgt under Ét hold.
        </p>
      </div>

      <section
        className={`lister-print-section ${sectionBox} ${sectionPrintClass(printFocus, "team-names")}`}
      >
        <div className={sectionHead}>
          <h2 className={h2}>Alle holdnavne</h2>
          <div className="print:hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => runPrint("team-names")} className={actionBtnClass}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Udskriv
            </button>
            <button type="button" onClick={downloadTeamNamesCsv} className={actionBtnClass}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-5 pb-5 pt-1 sm:px-6">
          {teams.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ingen hold endnu.</p>
          ) : (
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>Niveau</th>
                  <th className={th}>Kaldenavn / visning</th>
                  <th className={th}>Officielt navn</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="lister-print-row">
                    <td className={td}>{t.levelKey}</td>
                    <td className={`${td} font-medium`}>{t.displayName}</td>
                    <td className={td}>{t.officialName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section
        className={`lister-print-section ${sectionBox} ${sectionPrintClass(printFocus, "players-by-team")}`}
      >
        <div className={sectionHead}>
          <div>
            <h2 className={h2}>Spillere efter hold</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Alle spillere på hold, grupperet og sorteret efter hold — derefter alfabetisk på spiller.
            </p>
          </div>
          <div className="print:hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => runPrint("players-by-team")} className={actionBtnClass}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Udskriv
            </button>
            <button type="button" onClick={downloadPlayersByTeamCsv} className={actionBtnClass}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="space-y-8 px-5 pb-6 pt-2 sm:px-6">
          {playersByTeamBlocks.map(({ team, players: plist }) => (
            <div key={team.id} className="lister-print-team-block break-inside-avoid">
              <h3 className="mb-2 border-b border-teal-500/30 pb-2 text-base font-semibold text-gray-900 dark:border-teal-400/25 dark:text-white">
                <span className="text-gray-500 dark:text-gray-400">{team.levelKey} · </span>
                {team.displayName}
                {team.nickname ? (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({team.officialName})
                  </span>
                ) : null}
              </h3>
              {plist.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Ingen spillere på dette hold.</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Navn</th>
                      <th className={th}>Hjemmeklub</th>
                      <th className={th}>Niveau</th>
                      <th className={th}>Alder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plist.map((p) => (
                      <tr key={p.id}>
                        <td className={td}>{p.name}</td>
                        <td className={td}>{p.home_club ?? "—"}</td>
                        <td className={td}>{p.level ?? "—"}</td>
                        <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        className={`lister-print-section ${sectionBox} ${sectionPrintClass(printFocus, "single-team")}`}
      >
        <div className={sectionHead}>
          <div>
            <h2 className={h2}>Ét hold</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Vælg hold og udskriv kun den spilleroversigt.
            </p>
          </div>
          <div className="print:hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => runPrint("single-team")} className={actionBtnClass}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Udskriv
            </button>
            <button
              type="button"
              onClick={downloadSingleTeamCsv}
              disabled={!selectedTeam}
              className={`${actionBtnClass} disabled:pointer-events-none disabled:opacity-40`}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 pb-6 sm:px-6">
          <label className="print:hidden block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Hold
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              {teams.length === 0 ? <option value="">Ingen hold</option> : null}
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.levelKey} — {t.displayName}
                </option>
              ))}
            </select>
          </label>

          {selectedTeam ? (
            <div className="lister-print-team-block break-inside-avoid">
              <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
                {selectedTeam.levelKey} · {selectedTeam.displayName}
              </h3>
              {selectedTeamPlayers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Ingen spillere på dette hold.</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Navn</th>
                      <th className={th}>Hjemmeklub</th>
                      <th className={th}>Niveau</th>
                      <th className={th}>Alder</th>
                      <th className={th}>Køn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeamPlayers.map((p) => (
                      <tr key={p.id}>
                        <td className={td}>{p.name}</td>
                        <td className={td}>{p.home_club ?? "—"}</td>
                        <td className={td}>{p.level ?? "—"}</td>
                        <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                        <td className={td}>{p.gender ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section
        className={`lister-print-section ${sectionBox} ${sectionPrintClass(printFocus, "all-players")}`}
      >
        <div className={sectionHead}>
          <div>
            <h2 className={h2}>Alle spillere (alfabetisk)</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Én linje pr. spiller med tilknyttet hold.</p>
          </div>
          <div className="print:hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => runPrint("all-players")} className={actionBtnClass}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Udskriv
            </button>
            <button type="button" onClick={downloadAllPlayersCsv} className={actionBtnClass}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-5 pb-5 pt-1 sm:px-6">
          {players.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ingen spillere.</p>
          ) : (
            <table className="w-full min-w-[40rem] border-collapse text-sm">
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
                  <tr key={p.id} className="lister-print-row">
                    <td className={`${td} font-medium`}>{p.name}</td>
                    <td className={td}>{p.home_club ?? "—"}</td>
                    <td className={td}>{p.level ?? "—"}</td>
                    <td className={td}>{p.age != null ? String(p.age) : "—"}</td>
                    <td className={td}>{p.gender ?? "—"}</td>
                    <td className={td}>{p.team_display ?? "Ikke på hold"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section
        className={`lister-print-section ${sectionBox} ${sectionPrintClass(printFocus, "unassigned")}`}
      >
        <div className={sectionHead}>
          <div>
            <h2 className={h2}>Spillere uden hold</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Spillere der ikke er på et hold i dette arrangement.
            </p>
          </div>
          <div className="print:hidden flex flex-wrap gap-2">
            <button type="button" onClick={() => runPrint("unassigned")} className={actionBtnClass}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Udskriv
            </button>
            <button type="button" onClick={downloadUnassignedCsv} className={actionBtnClass}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-5 pb-5 pt-1 sm:px-6">
          {unassigned.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Alle spillere er på et hold.</p>
          ) : (
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={th}>Navn</th>
                  <th className={th}>Hjemmeklub</th>
                  <th className={th}>Niveau</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-medium`}>{p.name}</td>
                    <td className={td}>{p.home_club ?? "—"}</td>
                    <td className={td}>{p.level ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
