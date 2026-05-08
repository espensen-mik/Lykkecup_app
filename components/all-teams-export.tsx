"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { sortLevelKeysForNav } from "@/lib/holddannelse";
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
    const map = new Map<string, ListerPlayerRow[]>();
    for (const p of players) {
      if (!p.team_id) continue;
      const list = map.get(p.team_id) ?? [];
      list.push(p);
      map.set(p.team_id, list);
    }
    return map;
  }, [players]);

  const levelGroups = useMemo(() => {
    const byLevel = new Map<
      string,
      {
        id: string;
        levelKey: string;
        officialName: string;
        nickname: string | null;
        playerCount: number;
        averageAge: number | null;
        members: { name: string; club: string }[];
      }[]
    >();
    for (const t of teams) {
      const members = [...(playersPerTeam.get(t.id) ?? [])]
        .map((p) => ({
          name: p.name,
          club: p.home_club?.trim() || "Ingen klub",
        }))
        .sort((a, b) => {
          const byClub = a.club.localeCompare(b.club, "da", { sensitivity: "base" });
          if (byClub !== 0) return byClub;
          return a.name.localeCompare(b.name, "da", { sensitivity: "base" });
        });

      const ages = (playersPerTeam.get(t.id) ?? [])
        .map((p) => p.age)
        .filter((age): age is number => typeof age === "number" && Number.isFinite(age));
      const averageAge = ages.length > 0 ? Number((ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(1)) : null;

      const list = byLevel.get(t.levelKey) ?? [];
      list.push({
        id: t.id,
        levelKey: t.levelKey,
        officialName: t.officialName,
        nickname: t.nickname,
        playerCount: members.length,
        averageAge,
        members,
      });
      byLevel.set(t.levelKey, list);
    }
    return sortLevelKeysForNav([...byLevel.keys()]).map((levelKey) => ({
      levelKey,
      teams: byLevel.get(levelKey) ?? [],
    }));
  }, [teams, playersPerTeam]);

  function runPrint() {
    setPrintOpen(true);
    setTimeout(() => window.print(), 0);
  }

  function runCsv() {
    const rows: (string | number | null | undefined)[][] = [
      ["Niveau", "Hold (auto)", "Kaldenavn", "Gennemsnitsalder", "Antal spillere", "Klub", "Spiller"],
    ];
    for (const g of levelGroups) {
      for (const t of g.teams) {
        if (t.members.length === 0) {
          rows.push([g.levelKey, t.officialName, t.nickname ?? "", t.averageAge ?? "", t.playerCount, "", ""]);
          continue;
        }
        for (const m of t.members) {
          rows.push([g.levelKey, t.officialName, t.nickname ?? "", t.averageAge ?? "", t.playerCount, m.club, m.name]);
        }
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
                          Gns. alder
                        </th>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Spillere
                        </th>
                        <th className="border-b border-black px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide">
                          Medlemmer (sorteret på klub)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((team) => (
                        <tr key={team.id}>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm">
                            <p className="font-semibold">{team.officialName}</p>
                            <p className="text-xs text-neutral-600">Kaldenavn: {team.nickname ?? "—"}</p>
                          </td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm tabular-nums">
                            {team.averageAge != null ? String(team.averageAge).replace(".", ",") : "—"}
                          </td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm tabular-nums">
                            {team.playerCount}
                          </td>
                          <td className="border-b border-neutral-300 px-2 py-1.5 text-sm">
                            {team.members.length > 0 ? team.members.map((m) => `${m.club}: ${m.name}`).join(", ") : "—"}
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
