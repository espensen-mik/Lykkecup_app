import type { Metadata } from "next";
import { DashboardCharts } from "@/components/dashboard-charts";
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
  const { players, error } = await fetchPlayersForDashboard();

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
