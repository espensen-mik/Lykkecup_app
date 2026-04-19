import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase, getCurrentAuthAppUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analyse",
  description: "Brugsstatistik — LykkeCup KontrolCenter",
};

type PathRow = { path: string; views: number };

type AnalyticsSummary = {
  uniqueVisitors: number;
  totalViews: number;
  paths: PathRow[];
};

function parseSummary(raw: unknown): AnalyticsSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const uniqueVisitors = typeof o.uniqueVisitors === "number" ? o.uniqueVisitors : Number(o.uniqueVisitors);
  const totalViews = typeof o.totalViews === "number" ? o.totalViews : Number(o.totalViews);
  const pathsRaw = o.paths;
  const paths: PathRow[] = [];
  if (Array.isArray(pathsRaw)) {
    for (const row of pathsRaw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const path = typeof r.path === "string" ? r.path : "";
      const views = typeof r.views === "number" ? r.views : Number(r.views);
      if (path) paths.push({ path, views: Number.isFinite(views) ? views : 0 });
    }
  }
  if (!Number.isFinite(uniqueVisitors) || !Number.isFinite(totalViews)) return null;
  return { uniqueVisitors, totalViews, paths };
}

export default async function AnalysePage() {
  const user = await getCurrentAuthAppUser();
  if (!user) redirect("/login");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_lc_analytics_summary");
  const summary = error ? null : parseSummary(data);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Analyse</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Unikke enheder (anonym id i browser) og sidevisninger for LykkeCup-app og KontrolCenter.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-300"
        >
          Tilbage til Overblik
        </Link>
      </div>

      {error ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse statistik: {error.message}
        </div>
      ) : !summary ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Ingen data endnu — eller databasen er ikke opdateret med funktionen{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/50">get_lc_analytics_summary</code>.
        </div>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-lc-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Unikke enheder
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {summary.uniqueVisitors}
              </dd>
            </div>
            <div className="rounded-xl border border-lc-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Sidevisninger i alt
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {summary.totalViews}
              </dd>
            </div>
          </dl>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Hits pr. side (top 100)</h2>
            {summary.paths.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Ingen registrerede visninger endnu.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-0 text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Sti</th>
                      <th className="px-4 py-3 text-right">Visninger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {summary.paths.map((row) => (
                      <tr key={row.path} className="text-gray-800 dark:text-gray-200">
                        <td className="max-w-[min(100%,28rem)] truncate px-4 py-2.5 font-mono text-xs sm:text-sm" title={row.path}>
                          {row.path}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{row.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
