"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import type { ListerPlayerRow, ListerTeamRow } from "@/lib/lister";

type Props = {
  teams: ListerTeamRow[];
  players: ListerPlayerRow[];
  cardTitle?: string;
  printTitle?: string;
  csvFilename?: string;
};

const rowBtnClass =
  "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";

export function AllTeamsExport({
  teams,
  players,
  cardTitle = "Alle hold til LykkeCup26",
  printTitle = "Alle hold til LykkeCup26",
  csvFilename = "lister-alle-hold-til-lykkecup26.csv",
}: Props) {
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    const onAfter = () => setPrintOpen(false);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  const playersPerTeam = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of players) {
      if (!p.team_id) continue;
      map.set(p.team_id, (map.get(p.team_id) ?? 0) + 1);
    }
    return map;
  }, [players]);

  const levelGroups = useMemo(() => {
    const byLevel = new Map<
      string,
      { id: string; displayName: string; officialName: string; nickname: string | null; playerCount: number }[]
    >();
    for (const t of teams) {
      const list = byLevel.get(t.levelKey) ?? [];
      list.push({
        id: t.id,
        displayName: t.displayName,
        officialName: t.officialName,
        nickname: t.nickname,
        playerCount: playersPerTeam.get(t.id) ?? 0,
      });
      byLevel.set(t.levelKey, list);
    }
    return [...byLevel.entries()].map(([levelKey, levelTeams]) => ({ levelKey, teams: levelTeams }));
  }, [teams, playersPerTeam]);

  function runPrint() {
    setPrintOpen(true);
    setTimeout(() => window.print(), 0);
  }

  function runCsv() {
    const rows: (string | number | null | undefined)[][] = [
      ["Niveau", "Hold", "Officielt holdnavn", "Kaldenavn", "Antal spillere"],
    ];
    for (const g of levelGroups) {
      for (const t of g.teams) {
        rows.push([g.levelKey, t.displayName, t.officialName, t.nickname ?? "", t.playerCount]);
      }
    }
    downloadCsv(csvFilename, rows);
  }

  return (
    <>
      <div className="print:hidden flex flex-col gap-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{cardTitle}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={rowBtnClass} disabled={teams.length === 0} onClick={runPrint}>
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Udskriv
          </button>
          <button type="button" className={rowBtnClass} disabled={teams.length === 0} onClick={runCsv}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {printOpen ? (
        <div className="hidden print:block text-black">
          <h1 className="mb-6 text-xl font-bold">{printTitle}</h1>
          {levelGroups.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen hold oprettet endnu.</p>
          ) : (
            <div className="space-y-8">
              {levelGroups.map((group) => (
                <section key={group.levelKey} className="break-inside-avoid">
                  <h2 className="mb-2 border-b-2 border-black pb-1 text-base font-bold">{group.levelKey}</h2>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Hold
                        </th>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Officielt holdnavn
                        </th>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Kaldenavn
                        </th>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Spillere
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={team.id}>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm">{team.displayName}</td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm">{team.officialName}</td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm">{team.nickname ?? "—"}</td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm tabular-nums">
                            {team.playerCount}
                          </td>
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
    </>
  );
}
