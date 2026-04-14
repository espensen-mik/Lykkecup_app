import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { levelPathSegment } from "@/lib/holddannelse";
import { fetchTurneringDashboardOverview } from "@/lib/turnering";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turnering",
  description: "Hoveddashboard for puljer og kampe",
};

export default async function TurneringDashboardPage() {
  const { levels, totals, error } = await fetchTurneringDashboardOverview();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Turnering</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse turneringsdata: {error}
        </div>
      </div>
    );
  }

  const pooledPct = totals.teamCount > 0 ? Math.round((totals.pooledTeams / totals.teamCount) * 1000) / 10 : 0;
  const matchPct = totals.expectedMatches > 0 ? Math.round((totals.matchesGenerated / totals.expectedMatches) * 1000) / 10 : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Turneringsdashboard
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Overblik over puljer og kampe pr. niveau. Tids- og baneplanlægning kommer i næste trin.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Niveauer" value={levels.length} />
        <Kpi label="Puljer" value={totals.poolCount} />
        <Kpi label="Hold i puljer" value={`${totals.pooledTeams}/${totals.teamCount}`} subValue={`${pooledPct}%`} />
        <Kpi
          label="Genererede kampe"
          value={`${totals.matchesGenerated}/${totals.expectedMatches}`}
          subValue={`${matchPct}%`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Niveauer</h2>
        {levels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
            Ingen turneringsdata fundet endnu.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {levels.map((level) => (
              <li key={level.levelKey}>
                <article className="h-full rounded-xl border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{level.levelKey}</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <Stat label="Spillere" value={level.playerCount} />
                    <Stat label="Puljer" value={level.poolCount} />
                    <Stat label="Kampe" value={level.matchesGenerated} />
                    <Stat label="Hold i pulje" value={`${level.pooledTeams}/${level.teamCount}`} />
                  </dl>
                  <div className="mt-4 space-y-2">
                    <Progress label="Puljefordeling" value={level.teamPooledPct} />
                    <Progress label="Kampgenerering" value={level.matchCoveragePct} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <LevelLink href={`/turnering/puljer/${levelPathSegment(level.levelKey)}`} label="Åbn puljer" />
                    <LevelLink href={`/turnering/plan/${levelPathSegment(level.levelKey)}`} label="Åbn plan" />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, subValue }: { label: string; value: string | number; subValue?: string }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">{value}</p>
      {subValue ? <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{subValue}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{clamped}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#3b82f6] transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function LevelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}
