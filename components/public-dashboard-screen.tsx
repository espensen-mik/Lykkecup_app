"use client";

import { Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ApiData = {
  totals: {
    players: number;
    coaches: number;
    clubs: number;
  };
  progress: {
    totalPlayers: number;
    assignedPlayers: number;
    percentAssigned: number;
  };
  ageDistribution: { label: string; count: number }[];
  updatedAt: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

export function PublicDashboardScreen() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/public-dashboard", { cache: "no-store" });
      const json = (await res.json()) as ApiData | { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Kunne ikke hente dashboarddata.");
        return;
      }
      setError(null);
      setData(json as ApiData);
    }

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const maxAgeCount = useMemo(() => {
    if (!data || data.ageDistribution.length === 0) return 1;
    return Math.max(...data.ageDistribution.map((r) => r.count), 1);
  }, [data]);

  const percent = data?.progress.percentAssigned ?? 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f0fbfa] to-white px-10 py-8 text-gray-900">
      <div className="mx-auto h-full w-full max-w-[1920px]">
        <h1 className="text-4xl font-extrabold tracking-tight text-[#0f766e]">
          LykkeCup 2026 - KontrolCenter Dashboard
        </h1>

        {error ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>
        ) : null}

        <section className="mt-8 grid grid-cols-4 gap-5">
          <article className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-gray-500">Antal spillere tilmeldt</p>
            <p className="mt-2 text-5xl font-bold text-[#0f766e]">{data?.totals.players ?? "—"}</p>
          </article>
          <article className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-gray-500">Antal trænere tilmeldt</p>
            <p className="mt-2 text-5xl font-bold text-[#0f766e]">{data?.totals.coaches ?? "—"}</p>
          </article>
          <article className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-gray-500">Antal klubber der deltager</p>
            <p className="mt-2 text-5xl font-bold text-[#0f766e]">{data?.totals.clubs ?? "—"}</p>
          </article>
          <article className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-gray-500">Sidst opdateret</p>
            <p className="mt-2 text-3xl font-bold text-[#0f766e]">{data ? formatTime(data.updatedAt) : "—"}</p>
            <p className="mt-2 text-sm text-gray-500">Opdaterer automatisk hvert minut</p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Holddannelse fremdrift</h2>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              {percent >= 100 ? <Target className="h-5 w-5 text-amber-500" aria-hidden /> : null}
              {data?.progress.assignedPlayers ?? 0} af {data?.progress.totalPlayers ?? 0} spillere
            </div>
          </div>
          <div className="h-10 w-full overflow-hidden rounded-full bg-teal-100">
            <div
              className="flex h-full items-center justify-end bg-gradient-to-r from-teal-500 to-teal-600 pr-3 text-sm font-bold text-white transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
            >
              {percent.toFixed(1)}%
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800">Aldersfordeling på spillere</h2>
          <div className="mt-5 grid grid-cols-12 items-end gap-3">
            {(data?.ageDistribution ?? []).map((row) => (
              <div key={row.label} className="flex flex-col items-center gap-2">
                <div className="text-xs font-semibold text-gray-500">{row.count}</div>
                <div
                  className="w-10 rounded-t-md bg-[#14b8a6]"
                  style={{ height: `${Math.max(8, Math.round((row.count / maxAgeCount) * 180))}px` }}
                />
                <div className="text-xs font-medium text-gray-600">{row.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
