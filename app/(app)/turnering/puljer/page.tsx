import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { levelPathSegment } from "@/lib/holddannelse";
import { fetchPuljerOverview } from "@/lib/turnering";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Puljer",
  description: "Fordel hold i puljer for turneringen",
};

export default async function TurneringPuljerPage() {
  const { levels, error } = await fetchPuljerOverview();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Puljer</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Puljer
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Vælg niveau for at tildele hold til puljer før kampene planlægges.
        </p>
      </header>

      {levels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
          Ingen hold fundet for arrangementet endnu.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          {levels.map((level) => {
            const pct = level.totalTeams > 0 ? Math.round((level.assignedTeams / level.totalTeams) * 100) : 0;
            return (
              <li key={level.levelKey}>
                <Link
                  href={`/turnering/puljer/${levelPathSegment(level.levelKey)}`}
                  className="block h-full rounded-xl border border-lc-border bg-white p-5 shadow-lc-card transition-colors hover:border-sky-300/80 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none dark:hover:border-sky-700/60"
                >
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{level.levelKey}</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <Stat label="Hold i alt" value={level.totalTeams} accent />
                    <Stat label="Puljer" value={level.poolCount} />
                    <Stat label="Fordelt" value={level.assignedTeams} />
                    <Stat label="Uden pulje" value={level.unassignedTeams} />
                  </dl>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-[0.6875rem] font-medium text-gray-500 dark:text-gray-400">
                      <span>Puljefordeling</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#3b82f6] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#0d9488] dark:text-teal-400">
                    Åbn pulje-arbejdsområde
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd
        className={`mt-0.5 font-semibold tabular-nums ${
          accent ? "text-[#0f766e] dark:text-teal-300" : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

