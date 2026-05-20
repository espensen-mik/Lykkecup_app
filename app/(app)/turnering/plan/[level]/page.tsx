import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TurneringPlanWorkspace } from "@/components/turnering/plan-workspace";
import { canonicalBanerLevelLabel, normalizeLevelKey } from "@/lib/holddannelse";
import { fetchTurneringPlanLevelData } from "@/lib/turnering-server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ level: string }>;
};

function decodeLevelParam(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { level } = await params;
  const levelKey = canonicalBanerLevelLabel(normalizeLevelKey(decodeLevelParam(level)));
  return {
    title: `${levelKey} — Turneringsplan`,
    description: `Kampplanlægning for niveau ${levelKey}`,
  };
}

export default async function TurneringPlanLevelPage({ params }: PageProps) {
  const { level } = await params;
  const levelKey = canonicalBanerLevelLabel(normalizeLevelKey(decodeLevelParam(level)));
  const bundle = await fetchTurneringPlanLevelData(levelKey);

  if (bundle.error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <BackLink />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Turneringsplan</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse data: {bundle.error}
        </div>
      </div>
    );
  }

  if (bundle.teams.length === 0 && bundle.pools.length === 0) notFound();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <div>
        <BackLink />
        <header className="mt-4 max-w-3xl">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
            Turnering · Turneringsplan
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
            {levelKey}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Puljer oprettes under Puljer. Her genererer du kampe og tildeler bane og tid automatisk.
          </p>
        </header>
      </div>

      <TurneringPlanWorkspace
        levelKey={levelKey}
        planMatchesPerTeam={bundle.planMatchesPerTeam}
        poolHint={bundle.poolHint}
        teamRestMinutes={bundle.teamRestMinutes}
        initialPools={bundle.pools}
        initialTeams={bundle.teams}
        initialMembers={bundle.members}
        initialPlayers={bundle.players}
        initialCoaches={bundle.coaches}
        initialTeamCoaches={bundle.teamCoaches}
        initialMatches={bundle.matches}
        courts={bundle.courts}
        periods={bundle.periods}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/turnering/plan"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      Tilbage til oversigt
    </Link>
  );
}

