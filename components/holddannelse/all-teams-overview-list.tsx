"use client";

import { ExternalLink } from "lucide-react";
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
};

type LevelGroup = {
  levelKey: string;
  teams: TeamListItem[];
};

export function AllTeamsOverviewList({ groups }: { groups: LevelGroup[] }) {
  const { openPlayer } = usePlayerModal();

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
        Ingen hold oprettet endnu.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.levelKey} className="rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-300">
            {group.levelKey}
          </h2>

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
                          {player.name}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
