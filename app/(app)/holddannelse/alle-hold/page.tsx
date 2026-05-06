import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AllTeamsExport } from "@/components/all-teams-export";
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
  const levelRows = [...perLevel.values()];

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
