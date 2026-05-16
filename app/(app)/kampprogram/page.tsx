import type { Metadata } from "next";
import { KampprogramWorkspace } from "@/components/kampprogram/kampprogram-workspace";
import { fetchKampprogramBundle } from "@/lib/kampprogram-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kampprogram",
  description: "Samlet kampprogram for turneringen — per bane og kronologisk",
};

export default async function KampprogramPage() {
  const bundle = await fetchKampprogramBundle();

  if (bundle.error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Kampprogram</h1>
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse kampprogram: {bundle.error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Kampprogram
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Samlet overblik over alle turneringskampe. Se programmet per bane eller kronologisk efter runder, når kampe er
          genereret og planlagt under Turneringsplan.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="p-6 sm:p-8">
          <KampprogramWorkspace initial={bundle} />
        </div>
      </div>
    </div>
  );
}
