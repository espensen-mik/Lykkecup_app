import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { levelPathSegment } from "@/lib/holddannelse";
import { fetchTurneringsplanOverview } from "@/lib/turnering";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turneringsplan",
  description: "Oversigt over niveauer til turneringsplanlægning",
};

export default async function TurneringPlanPage() {
  const { levels, error } = await fetchTurneringsplanOverview();

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Turneringsplan</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Turneringsplan
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Placeholder for kampplanlægning. Vælg et niveau for at se puljer og hold.
        </p>
      </header>

      {levels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900/35 dark:text-gray-400">
          Ingen turneringsdata fundet endnu.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-3">
          {levels.map((level) => (
            <li key={level.levelKey}>
              <Link
                href={`/turnering/plan/${levelPathSegment(level.levelKey)}`}
                className="block h-full rounded-xl border border-lc-border bg-white p-5 shadow-lc-card transition-colors hover:border-sky-300/80 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none dark:hover:border-sky-700/60"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{level.levelKey}</h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <Stat label="Puljer" value={level.poolCount} />
                  <Stat label="Hold" value={level.teamCount} accent />
                </dl>
                <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#0d9488] dark:text-teal-400">
                  Åbn planvisning
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                </p>
              </Link>
            </li>
          ))}
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

