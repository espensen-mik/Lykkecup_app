"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usePlayerModal } from "@/components/player-modal-context";

type PlayerListItem = {
  id: string;
  name: string;
};

type TeamListItem = {
  id: string;
  displayName: string;
  officialName: string;
  nickname: string | null;
  players: PlayerListItem[];
  coaches: { name: string }[];
};

type LevelGroup = {
  levelKey: string;
  teams: TeamListItem[];
};

export function AllTeamsOverviewList({ groups }: { groups: LevelGroup[] }) {
  const { openPlayer } = usePlayerModal();
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("da");

  const visibleGroups = useMemo(() => {
    const base = levelFilter === "all" ? groups : groups.filter((g) => g.levelKey === levelFilter);
    if (!q) return base;

    return base
      .map((g) => ({
        ...g,
        teams: g.teams.filter((team) => {
          const playerMatch = team.players.some((p) => p.name.toLocaleLowerCase("da").includes(q));
          const coachMatch = team.coaches.some((c) => c.name.toLocaleLowerCase("da").includes(q));
          return playerMatch || coachMatch;
        }),
      }))
      .filter((g) => g.teams.length > 0);
  }, [groups, levelFilter, q]);

  function highlight(text: string): ReactNode {
    if (!q) return text;
    const lower = text.toLocaleLowerCase("da");
    const idx = lower.indexOf(q);
    if (idx < 0) return text;
    const end = idx + q.length;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-amber-100 px-0.5 text-current dark:bg-amber-700/40">{text.slice(idx, end)}</mark>
        {text.slice(end)}
      </>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
        Ingen hold oprettet endnu.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-lc-border bg-white p-3 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Filtrer niveau
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              <option value="all">Alle niveauer</option>
              {groups.map((group) => (
                <option key={group.levelKey} value={group.levelKey}>
                  {group.levelKey}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Søg spiller/træner
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Fx Sofie eller Mads"
              className="mt-1.5 block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </label>
        </div>
      </div>

      {visibleGroups.map((group, idx) => (
        <section
          key={group.levelKey}
          className={`rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 ${
            levelFilter === "all" && idx > 0 ? "pt-5" : ""
          }`}
        >
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-300">
              {group.levelKey}
            </h2>
            <span className="h-px flex-1 bg-gradient-to-r from-teal-300/70 to-transparent dark:from-teal-700/70" />
          </div>

          <div className="mt-3 space-y-3">
            {group.teams.map((team) => (
              <article
                id={`team-${team.id}`}
                key={team.id}
                className="scroll-mt-24 rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{team.displayName}</p>
                    {team.displayName !== team.officialName ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{team.officialName}</p>
                    ) : null}
                  </div>
                  <p className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
                    {team.players.length} {team.players.length === 1 ? "spiller" : "spillere"}
                  </p>
                </div>

                {team.players.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ingen spillere på holdet endnu.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {team.players.map((player) => (
                      <li key={player.id}>
                        <button
                          type="button"
                          onClick={() => openPlayer(player.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-[#0f766e] transition hover:bg-teal-50 dark:border-teal-800 dark:bg-gray-950 dark:text-teal-200 dark:hover:bg-teal-950/40"
                          title="Åbn spillerdetaljer"
                        >
                          {highlight(player.name)}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Trænere
                  </p>
                  {team.coaches.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ingen trænere på holdet endnu.</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {team.coaches.map((coach) => (
                        <li
                          key={`${team.id}-${coach.name}`}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        >
                          {highlight(coach.name)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {visibleGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
          Ingen hold for det valgte niveau.
        </p>
      ) : null}
    </div>
  );
}
