import type { Metadata } from "next";
import { DashboardCharts } from "@/components/dashboard-charts";
import { OpenPlayerButton } from "@/components/open-player";
import {
  computeKpis,
  genderDistribution,
  playersPerLevel,
  recentPlayers,
  topClubs,
} from "@/lib/dashboard-compute";
import { fetchPlayersForDashboard } from "@/lib/players";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overblik",
  description: "Overblik — LykkeCup KontrolCenter",
};

function formatCell(value: string | null): string {
  if (value === null || value === "") return "—";
  return value;
}

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
  const genderData = genderDistribution(players);
  const recent = recentPlayers(players, 20);

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
            Spillere grupperet efter niveau, klub og køn.
          </p>
        </div>
        <DashboardCharts
          levelData={levelData}
          clubData={clubData}
          genderData={genderData}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="border-b border-lc-border px-5 py-4 dark:border-gray-700">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-gray-900 dark:text-white">
            Seneste spillere
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            De 20 senest registrerede (efter oprettelsestidspunkt, hvis tilgængeligt).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-lc-border bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Navn
                </th>
                <th className="px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Klub
                </th>
                <th className="px-5 py-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Niveau
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lc-border dark:divide-gray-700">
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Ingen spillere endnu.
                  </td>
                </tr>
              ) : (
                recent.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-lc-select dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-3.5">
                      <OpenPlayerButton
                        playerId={p.id}
                        className="font-medium text-[#0d9488] hover:text-[#0f766e] hover:underline dark:text-teal-400 dark:hover:text-teal-300"
                      >
                        {p.name}
                      </OpenPlayerButton>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                      {formatCell(p.home_club)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                      {formatCell(p.level)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
