import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LcHourlyViewsLine } from "@/components/analytics/lc-hourly-views-line";
import { createServerSupabase, getCurrentAuthAppUser } from "@/lib/auth-server";
import {
  addCalendarDaysIso,
  formatAnalyticsDayTitle,
  parseAnalyticsDayParam,
  parseHourlyViewsPayload,
  todayIsoInCopenhagen,
} from "@/lib/lc-analytics-display";

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

type PageProps = {
  searchParams: Promise<{ dag?: string }>;
};

export default async function AnalysePage({ searchParams }: PageProps) {
  const user = await getCurrentAuthAppUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const todayCph = todayIsoInCopenhagen();
  const selectedDay = parseAnalyticsDayParam(sp.dag) ?? todayCph;
  const dayTitle = formatAnalyticsDayTitle(selectedDay);
  const prevDay = addCalendarDaysIso(selectedDay, -1);
  const nextDay = addCalendarDaysIso(selectedDay, 1);
  const canGoNext = nextDay <= todayCph;

  const supabase = await createServerSupabase();

  const [{ data: summaryData, error: summaryError }, { data: hourlyData, error: hourlyError }] = await Promise.all([
    supabase.rpc("get_lc_analytics_summary"),
    supabase.rpc("get_lc_analytics_hourly_views", { p_day: selectedDay }),
  ]);

  const summary = summaryError ? null : parseSummary(summaryData);
  const hourlyPoints = hourlyError ? [] : parseHourlyViewsPayload(hourlyData);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Analyse</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Her kan du se statistik for brugen af LykkeCup26 App
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/admin"
            className="text-sm font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-300"
          >
            Tilbage til Overblik
          </Link>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lc-border bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <Link
              href={`/analyse?dag=${encodeURIComponent(prevDay)}`}
              className="rounded-lg px-2.5 py-1 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              ← Forrige dag
            </Link>
            <span className="hidden min-w-[10rem] text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:inline sm:min-w-[12rem] sm:text-sm sm:normal-case sm:tracking-normal">
              {selectedDay}
            </span>
            {canGoNext ? (
              <Link
                href={`/analyse?dag=${encodeURIComponent(nextDay)}`}
                className="rounded-lg px-2.5 py-1 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Næste dag →
              </Link>
            ) : (
              <span className="rounded-lg px-2.5 py-1 text-gray-400 dark:text-gray-500" title="Kan ikke vælge fremtidige dage">
                Næste dag →
              </span>
            )}
          </div>
        </div>
      </div>

      {summaryError ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse statistik: {summaryError.message}
        </div>
      ) : !summary ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Ingen data endnu — eller databasen er ikke opdateret med funktionen{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/50">get_lc_analytics_summary</code>.
        </div>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-lc-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Unikke enheder
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {summary.uniqueVisitors}
              </dd>
            </div>
            <div className="rounded-xl border border-lc-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Sidevisninger i alt
              </dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {summary.totalViews}
              </dd>
            </div>
            <div className="rounded-xl border border-lc-border bg-gradient-to-br from-teal-50/90 to-white p-5 shadow-sm dark:border-teal-900/40 dark:from-teal-950/50 dark:to-gray-900 sm:col-span-2 lg:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#0f766e] dark:text-teal-300">
                Valgt dag
              </dt>
              <dd className="mt-2 text-lg font-semibold capitalize leading-snug text-gray-900 dark:text-gray-50">
                {dayTitle}
              </dd>
              <dd className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{selectedDay}</dd>
            </div>
          </dl>

          <section className="mt-10">
            {hourlyError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                Timegraf kunne ikke hentes ({hourlyError.message}). Opret funktionen{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/50">
                  get_lc_analytics_hourly_views
                </code>{" "}
                i Supabase (se migration{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs dark:bg-amber-900/50">
                  20260421100000_lc_analytics_hourly_views.sql
                </code>
                ).
              </div>
            ) : (
              <LcHourlyViewsLine points={hourlyPoints} dayTitle={dayTitle} />
            )}
          </section>

          <section className="mt-12">
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
                        <td className="max-w-[min(100%,36rem)] truncate px-4 py-2.5 font-mono text-xs sm:text-sm" title={row.path}>
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
