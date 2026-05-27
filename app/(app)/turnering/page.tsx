import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { levelPathSegment } from "@/lib/holddannelse";
import { fetchTurneringDashboardOverview } from "@/lib/turnering-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turnering",
  description: "Hoveddashboard for puljer og kampe",
};

export default async function TurneringDashboardPage() {
  const overview = await fetchTurneringDashboardOverview();
  const { levels, totals, error } = overview;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Turnering</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse turneringsdata: {error}
        </div>
      </div>
    );
  }

  const pooledPct = totals.teamCount > 0 ? Math.round((totals.pooledTeams / totals.teamCount) * 1000) / 10 : 0;
  const matchGeneratedPct =
    totals.expectedMatches > 0
      ? Math.round((totals.matchesGenerated / totals.expectedMatches) * 1000) / 10
      : 0;
  const matchScheduledPct =
    totals.matchesGenerated > 0
      ? Math.round((totals.matchesScheduled / totals.matchesGenerated) * 1000) / 10
      : 0;
  const unscheduledMatches = Math.max(0, totals.matchesGenerated - totals.matchesScheduled);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Turneringsdashboard
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Overblik over puljer og kampe pr. niveau. «Forventet» kommer fra puljestørrelse og kampe pr. hold under{" "}
          <Link href="/turnering/baner" className="font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400">
            Opsætning → Kampe
          </Link>
          — ikke fuld round-robin mellem alle hold i en pulje.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Niveauer" value={levels.length} tone="teal" />
        <Kpi label="Hold i alt" value={totals.teamCount} tone="violet" />
        <Kpi label="Puljer" value={totals.poolCount} tone="amber" />
        <Kpi
          label="Kampprogram i alt"
          value={totals.matchesGenerated}
          subValue={unscheduledMatches > 0 ? `${unscheduledMatches} uden bane/tid` : "Alle har bane/tid"}
          tone="blue"
        />
        <Kpi
          label="Hold i puljer"
          value={`${totals.pooledTeams}/${totals.teamCount}`}
          subValue={`${pooledPct}%`}
          tone="emerald"
        />
        <Kpi
          label="Genererede kampe"
          value={`${totals.matchesGenerated}/${totals.expectedMatches}`}
          subValue={`${matchGeneratedPct}% af forventet`}
          tone="rose"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampprogram pr. niveau</h2>
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
                    <Stat label="Hold i alt" value={level.teamCount} />
                    <Stat label="Hold i pulje" value={level.pooledTeams} />
                    <Stat label="Spillere" value={level.playerCount} />
                    <Stat label="Puljer" value={level.poolCount} />
                    <Stat label="Kampe i kampprogram" value={level.matchesGenerated} />
                    <Stat label="Forventede kampe" value={level.expectedMatches} />
                    <Stat label="Har bane/tid" value={level.matchesScheduled} />
                  </dl>
                  <div className="mt-4 space-y-2">
                    <Progress
                      label="Kampe genereret (ift. Opsætning)"
                      value={level.matchCoveragePct}
                    />
                    <Progress label="Tider sat (ift. genererede)" value={level.matchScheduledPct} />
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

function Kpi({
  label,
  value,
  subValue,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  subValue?: string;
  tone?: "teal" | "blue" | "violet" | "amber" | "rose" | "emerald";
}) {
  const toneClasses: Record<
    NonNullable<typeof tone>,
    { shell: string; value: string; label: string; sub: string }
  > = {
    teal: {
      shell: "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white dark:border-teal-900/40 dark:from-teal-950/25 dark:to-gray-900/35",
      value: "text-teal-700 dark:text-teal-300",
      label: "text-teal-700/80 dark:text-teal-300/80",
      sub: "text-teal-800/70 dark:text-teal-300/70",
    },
    blue: {
      shell: "border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-white dark:border-blue-900/40 dark:from-blue-950/25 dark:to-gray-900/35",
      value: "text-blue-700 dark:text-blue-300",
      label: "text-blue-700/80 dark:text-blue-300/80",
      sub: "text-blue-800/70 dark:text-blue-300/70",
    },
    violet: {
      shell: "border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-900/40 dark:from-violet-950/25 dark:to-gray-900/35",
      value: "text-violet-700 dark:text-violet-300",
      label: "text-violet-700/80 dark:text-violet-300/80",
      sub: "text-violet-800/70 dark:text-violet-300/70",
    },
    amber: {
      shell: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white dark:border-amber-900/40 dark:from-amber-950/25 dark:to-gray-900/35",
      value: "text-amber-700 dark:text-amber-300",
      label: "text-amber-700/80 dark:text-amber-300/80",
      sub: "text-amber-800/70 dark:text-amber-300/70",
    },
    rose: {
      shell: "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white dark:border-rose-900/40 dark:from-rose-950/25 dark:to-gray-900/35",
      value: "text-rose-700 dark:text-rose-300",
      label: "text-rose-700/80 dark:text-rose-300/80",
      sub: "text-rose-800/70 dark:text-rose-300/70",
    },
    emerald: {
      shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white dark:border-emerald-900/40 dark:from-emerald-950/25 dark:to-gray-900/35",
      value: "text-emerald-700 dark:text-emerald-300",
      label: "text-emerald-700/80 dark:text-emerald-300/80",
      sub: "text-emerald-800/70 dark:text-emerald-300/70",
    },
  };
  const styles = toneClasses[tone];
  return (
    <div className={`rounded-lg border p-4 shadow-lc-card dark:shadow-none ${styles.shell}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${styles.value}`}>{value}</p>
      {subValue ? <p className={`mt-1 text-xs font-medium ${styles.sub}`}>{subValue}</p> : null}
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
