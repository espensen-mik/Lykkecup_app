import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AllTeamsExport } from "@/components/all-teams-export";
import { AllTeamsOverviewList } from "@/components/holddannelse/all-teams-overview-list";
import { sortLevelKeysForNav } from "@/lib/holddannelse";
import { fetchListerExportData } from "@/lib/lister";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alle hold — Holddannelse",
  description: "Oversigt over alle oprettede hold i LykkeCup26",
};

export default async function AlleHoldPage() {
  const { teams, players, error } = await fetchListerExportData();

  const playerCountByTeamId = new Map<string, number>();
  for (const p of players) {
    if (!p.team_id) continue;
    playerCountByTeamId.set(p.team_id, (playerCountByTeamId.get(p.team_id) ?? 0) + 1);
  }

  const perLevel = new Map<string, { levelKey: string; teamCount: number; playersOnTeams: number }>();
  for (const t of teams) {
    const item = perLevel.get(t.levelKey) ?? { levelKey: t.levelKey, teamCount: 0, playersOnTeams: 0 };
    item.teamCount += 1;
    item.playersOnTeams += playerCountByTeamId.get(t.id) ?? 0;
    perLevel.set(t.levelKey, item);
  }
  const levelOrder = sortLevelKeysForNav([...perLevel.keys()]);
  const levelRows = levelOrder.map((key) => perLevel.get(key)!).filter(Boolean);

  const playersByTeamId = new Map<string, { id: string; name: string }[]>();
  for (const p of players) {
    if (!p.team_id) continue;
    const list = playersByTeamId.get(p.team_id) ?? [];
    list.push({ id: p.id, name: p.name });
    playersByTeamId.set(p.team_id, list);
  }
  for (const list of playersByTeamId.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
  }

  const teamsByLevel = new Map<
    string,
    {
      id: string;
      displayName: string;
      officialName: string;
      nickname: string | null;
      players: { id: string; name: string }[];
    }[]
  >();
  for (const team of teams) {
    const list = teamsByLevel.get(team.levelKey) ?? [];
    list.push({
      id: team.id,
      displayName: team.displayName,
      officialName: team.officialName,
      nickname: team.nickname,
      players: playersByTeamId.get(team.id) ?? [],
    });
    teamsByLevel.set(team.levelKey, list);
  }
  const levelGroups = sortLevelKeysForNav([...teamsByLevel.keys()]).map((key) => ({
    levelKey: key,
    teams: teamsByLevel.get(key) ?? [],
  }));

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <BackLink />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Alle hold</h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlaese data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="space-y-3">
        <BackLink />
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
            Holddannelse
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
            Alle hold
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Oversigt over alle oprettede hold, sorteret efter niveau.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {levelRows.map((row) => (
          <article
            key={row.levelKey}
            className="rounded-xl border border-lc-border bg-white px-4 py-3 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35"
          >
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {row.levelKey}
            </p>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Hold: <span className="font-semibold tabular-nums">{row.teamCount}</span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Spillere paa hold: <span className="font-semibold tabular-nums">{row.playersOnTeams}</span>
            </p>
          </article>
        ))}
      </section>

      <AllTeamsExport
        teams={teams}
        players={players}
        cardTitle="Alle hold til LykkeCup26"
        printTitle="Alle hold til LykkeCup26"
        csvFilename="alle-hold-til-lykkecup26.csv"
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Hold og spillere
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Klik på et spillernavn for at åbne spillerens detalje-modal.
        </p>
        <AllTeamsOverviewList groups={levelGroups} />
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/holddannelse"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      Tilbage til oversigt
    </Link>
  );
}
