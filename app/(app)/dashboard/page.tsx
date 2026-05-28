import type { Metadata } from "next";
import { DashboardCharts } from "@/components/dashboard-charts";
import { fetchClubFeedbackCounts } from "@/lib/club-feedback";
import { fetchHolddannelseProgress } from "@/lib/holddannelse";
import {
  computeKpis,
  genderDistribution,
  playersByAgeBucket,
  playersPerLevel,
  topClubs,
} from "@/lib/dashboard-compute";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import { fetchPlayersForDashboard } from "@/lib/players";
import { fetchTurneringDashboardOverview } from "@/lib/turnering-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overblik",
  description: "Overblik — LykkeCup KontrolCenter",
};

export default async function DashboardPage() {
  const [{ players, error }, { progress: holddannelseProgress }, commentKpis, turneringOverview] = await Promise.all([
    fetchPlayersForDashboard(),
    fetchHolddannelseProgress(),
    fetchClubFeedbackCounts(24),
    fetchTurneringDashboardOverview(),
  ]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Overblik
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse data: {error}
        </div>
      </div>
    );
  }

  const kpis = computeKpis(players);
  const levelData = playersPerLevel(players);
  const clubData = topClubs(players, 5);
  const ageData = playersByAgeBucket(players);
  const genderData = genderDistribution(players);

  const commentTotalStr = commentKpis.error ? "—" : String(commentKpis.total);
  const commentRecentStr = commentKpis.error ? "—" : String(commentKpis.recent);
  const kampprogramTotalMatches = turneringOverview.error ? "—" : String(turneringOverview.totals.matchesGenerated);
  const kampprogramScheduledMatches = turneringOverview.error ? "—" : String(turneringOverview.totals.matchesScheduled);
  const kampprogramLevelRows = turneringOverview.error ? [] : turneringOverview.levels;

  const kpiItems = [
    { label: "Spillere i alt", value: String(kpis.totalPlayers), tone: "teal" as const },
    { label: "Unikke klubber", value: String(kpis.uniqueClubs), tone: "violet" as const },
    { label: "Antal niveauer", value: String(kpis.levelCount), tone: "amber" as const },
    {
      label: "Gennemsnitsalder",
      value: kpis.averageAge != null ? String(kpis.averageAge) : "—",
      tone: "blue" as const,
    },
    { label: "Kampprogram i alt", value: kampprogramTotalMatches, tone: "emerald" as const },
    { label: "Kampe med bane/tid", value: kampprogramScheduledMatches, tone: "rose" as const },
    { label: "Antal kommentarer i alt", value: commentTotalStr, tone: "teal" as const },
    { label: "Nye kommentarer", value: commentRecentStr, tone: "violet" as const },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 lg:space-y-12">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Overblik
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Nøgletal og fordeling for arrangementet — opdateret ved hver visning.
        </p>
      </header>

      <section>
        <h2 className="sr-only">Nøgletal</h2>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {kpiItems.map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            Kampprogram pr. niveau
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Hold og kampe pr. niveau fra Turneringsplan/Kampprogram.
          </p>
        </div>
        {turneringOverview.error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Kunne ikke indlæse Kampprogram-overblik: {turneringOverview.error}
          </p>
        ) : kampprogramLevelRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
            Ingen kampprogramdata endnu.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {kampprogramLevelRows.map((level) => (
              <li key={level.levelKey}>
                <article className="h-full rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{formatLevelShortLabel(level.levelKey)}</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <Stat label="Hold" value={level.teamCount} />
                    <Stat label="Puljer" value={level.poolCount} />
                    <Stat label="Kampe i alt" value={level.matchesGenerated} />
                    <Stat label="Har bane/tid" value={level.matchesScheduled} />
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            Holddannelse fremdrift
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Hvor mange spillere der allerede er placeret på et hold.
          </p>
        </div>
        <HolddannelseProgressCard
          assignedPlayers={holddannelseProgress?.assignedPlayers ?? 0}
          totalPlayers={holddannelseProgress?.totalPlayers ?? 0}
          percentAssigned={holddannelseProgress?.percentAssigned ?? 0}
        />
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
            Fordeling
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-400 dark:text-gray-500">
            Spillere grupperet efter niveau, klub, alder og køn.
          </p>
        </div>
        <DashboardCharts
          levelData={levelData}
          clubData={clubData}
          ageData={ageData}
          genderData={genderData}
        />
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "teal",
}: {
  label: string;
  value: string;
  tone?: "teal" | "blue" | "violet" | "amber" | "rose" | "emerald";
}) {
  const toneClasses: Record<
    NonNullable<typeof tone>,
    { shell: string; value: string; label: string }
  > = {
    teal: {
      shell: "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white dark:border-teal-900/40 dark:from-teal-950/25 dark:to-gray-900/35",
      value: "text-teal-700 dark:text-teal-300",
      label: "text-teal-700/80 dark:text-teal-300/80",
    },
    blue: {
      shell: "border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-white dark:border-blue-900/40 dark:from-blue-950/25 dark:to-gray-900/35",
      value: "text-blue-700 dark:text-blue-300",
      label: "text-blue-700/80 dark:text-blue-300/80",
    },
    violet: {
      shell: "border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-900/40 dark:from-violet-950/25 dark:to-gray-900/35",
      value: "text-violet-700 dark:text-violet-300",
      label: "text-violet-700/80 dark:text-violet-300/80",
    },
    amber: {
      shell: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white dark:border-amber-900/40 dark:from-amber-950/25 dark:to-gray-900/35",
      value: "text-amber-700 dark:text-amber-300",
      label: "text-amber-700/80 dark:text-amber-300/80",
    },
    rose: {
      shell: "border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white dark:border-rose-900/40 dark:from-rose-950/25 dark:to-gray-900/35",
      value: "text-rose-700 dark:text-rose-300",
      label: "text-rose-700/80 dark:text-rose-300/80",
    },
    emerald: {
      shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white dark:border-emerald-900/40 dark:from-emerald-950/25 dark:to-gray-900/35",
      value: "text-emerald-700 dark:text-emerald-300",
      label: "text-emerald-700/80 dark:text-emerald-300/80",
    },
  };
  const styles = toneClasses[tone];
  return (
    <div className={`rounded-lg border p-5 shadow-lc-card dark:shadow-none ${styles.shell}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${styles.label}`}>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${styles.value}`}>
        {value}
      </p>
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

function HolddannelseProgressCard({
  assignedPlayers,
  totalPlayers,
  percentAssigned,
}: {
  assignedPlayers: number;
  totalPlayers: number;
  percentAssigned: number;
}) {
  const safePct = Math.max(0, Math.min(100, percentAssigned));

  return (
    <div className="rounded-lg border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Spillere tildelt hold
        </p>
        <p className="text-sm font-medium tabular-nums text-gray-500 dark:text-gray-400">
          {assignedPlayers} / {totalPlayers}
        </p>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488] transition-[width] duration-500 ease-out"
          style={{ width: `${safePct}%` }}
          aria-hidden
        />
      </div>

      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">
        {safePct.toFixed(1)}%
      </p>
    </div>
  );
}
