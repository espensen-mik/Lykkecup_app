import type { Metadata } from "next";
import { DashboardCharts } from "@/components/dashboard-charts";
import { fetchHolddannelseProgress } from "@/lib/holddannelse";
import {
  computeKpis,
  genderDistribution,
  playersByAgeBucket,
  playersPerLevel,
  topClubs,
} from "@/lib/dashboard-compute";
import { fetchPlayersForDashboard } from "@/lib/players";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overblik",
  description: "Overblik — LykkeCup KontrolCenter",
};

export default async function DashboardPage() {
  const [{ players, error }, { progress: holddannelseProgress }] = await Promise.all([
    fetchPlayersForDashboard(),
    fetchHolddannelseProgress(),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
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

  const kpiItems = [
    { label: "Spillere i alt", value: String(kpis.totalPlayers) },
    { label: "Unikke klubber", value: String(kpis.uniqueClubs) },
    { label: "Antal niveauer", value: String(kpis.levelCount) },
    {
      label: "Gennemsnitsalder",
      value: kpis.averageAge != null ? String(kpis.averageAge) : "—",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-10 lg:space-y-12">
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
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          {kpiItems.map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">
        {value}
      </p>
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
