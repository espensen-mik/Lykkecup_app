import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ScanalyticsCheckInPie,
  ScanalyticsDeviceBars,
  ScanalyticsDeviceOverview,
  ScanalyticsMinuteLine,
  ScanalyticsStatCard,
} from "@/components/galla-scanner/scanalytics-charts";
import { createServerSupabase, getCurrentAuthAppUser } from "@/lib/auth-server";
import { fetchGallaScanalytics, pickDefaultScanDay } from "@/lib/galla-scanalytics-server";
import {
  formatAnalyticsDayTitle,
  parseAnalyticsDayParam,
  todayIsoInCopenhagen,
} from "@/lib/lc-analytics-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scanalytics",
  description: "QR scanner statistik — LykkeCup Galla",
};

type PageProps = {
  searchParams: Promise<{ dag?: string }>;
};

export default async function ScanalyticsPage({ searchParams }: PageProps) {
  const user = await getCurrentAuthAppUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const todayCph = todayIsoInCopenhagen();
  const requestedDay = parseAnalyticsDayParam(sp.dag) ?? todayCph;

  const supabase = await createServerSupabase();

  let payload;
  let loadError: string | null = null;
  try {
    payload = await fetchGallaScanalytics(supabase, requestedDay);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Kunne ikke indlæse data";
  }

  const selectedDay = payload?.selectedDay ?? pickDefaultScanDay([], todayCph);
  const dayTitle = formatAnalyticsDayTitle(selectedDay);
  const scanDays = payload?.scanDays ?? [];
  const dayIndex = scanDays.findIndex((d) => d.day === selectedDay);
  const prevDay = dayIndex >= 0 && dayIndex < scanDays.length - 1 ? scanDays[dayIndex + 1]?.day : null;
  const nextDay = dayIndex > 0 ? scanDays[dayIndex - 1]?.day : null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">Scanalytics</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Overblik over QR check-in for LykkeCup Galla — antal scans, enheder og peak-tidspunkter
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/admin"
            className="text-sm font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-300"
          >
            Tilbage til Overblik
          </Link>
          {scanDays.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lc-border bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900">
              {prevDay ? (
                <Link
                  href={`/scanalytics?dag=${encodeURIComponent(prevDay)}`}
                  className="rounded-lg px-2.5 py-1 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  ← Ældre dag
                </Link>
              ) : (
                <span className="rounded-lg px-2.5 py-1 text-gray-400 dark:text-gray-500">← Ældre dag</span>
              )}
              <span className="hidden min-w-[10rem] text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:inline sm:min-w-[12rem] sm:text-sm sm:normal-case sm:tracking-normal">
                {selectedDay}
              </span>
              {nextDay ? (
                <Link
                  href={`/scanalytics?dag=${encodeURIComponent(nextDay)}`}
                  className="rounded-lg px-2.5 py-1 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Nyere dag →
                </Link>
              ) : (
                <span className="rounded-lg px-2.5 py-1 text-gray-400 dark:text-gray-500">Nyere dag →</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse statistik: {loadError}
        </div>
      ) : payload ? (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <ScanalyticsStatCard label="Scannet ind" value={payload.summary.checkedIn} />
            <ScanalyticsStatCard label="Mangler check-in" value={payload.summary.remaining} />
            <ScanalyticsStatCard
              label="Andel scannet"
              value={`${payload.summary.checkedInPct}%`}
              hint={`${payload.summary.checkedIn} af ${payload.summary.total} billetter`}
            />
            <ScanalyticsStatCard
              label="Forskellige browsere"
              value={payload.summary.identifiedBrowserCount}
              hint={
                payload.summary.legacyScanCount > 0
                  ? `${payload.summary.legacyScanCount} ældre scans uden browser-id`
                  : payload.summary.identifiedBrowserCount === 0
                    ? "Ingen auto-ID endnu"
                    : `${payload.summary.identifiedBrowserCount} unikke browsere`
              }
            />
            <ScanalyticsStatCard
              label="Scans valgt dag"
              value={payload.summary.checkedIn > 0 ? (scanDays.find((d) => d.day === selectedDay)?.count ?? 0) : 0}
              hint={dayTitle}
              accent
            />
          </dl>

          <section className="mt-8">
            <ScanalyticsDeviceOverview
              identifiedBrowserCount={payload.summary.identifiedBrowserCount}
              identifiedBrowserCountForDay={payload.identifiedBrowserCountForDay}
              legacyScanCount={payload.summary.legacyScanCount}
              legacyScanCountForDay={payload.legacyScanCountForDay}
              identifiedBrowsers={payload.identifiedBrowsers}
            />
          </section>

          <section className="mt-10">
            <ScanalyticsMinuteLine
              points={payload.minuteForDay}
              dayTitle={dayTitle}
              peakMinute={payload.peakMinute}
            />
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
            <ScanalyticsCheckInPie checkedIn={payload.summary.checkedIn} remaining={payload.summary.remaining} />
            <ScanalyticsDeviceBars rows={payload.identifiedBrowsers} />
          </div>

          {payload.summary.legacyScanCount > 0 ? (
            <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Ældre scans uden browser-id</p>
              <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                {payload.summary.legacyScanCount} check-ins blev gemt som &quot;scanner&quot; før auto-identifikation.
                Antallet af telefoner/browsere bag disse kan desværre ikke findes bagefter — kun nye scans tælles
                korrekt.
              </p>
            </section>
          ) : null}

          {payload.identifiedBrowsers.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Browsere (detaljer)</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-0 text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Browser</th>
                      <th className="hidden px-4 py-3 sm:table-cell">IP</th>
                      <th className="px-4 py-3 text-right">Scans</th>
                      <th className="hidden px-4 py-3 text-right md:table-cell">Andel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {payload.identifiedBrowsers.map((row) => (
                      <tr key={row.shortId ?? row.device} className="text-gray-800 dark:text-gray-200">
                        <td className="px-4 py-2.5 font-medium">{row.device}</td>
                        <td className="hidden px-4 py-2.5 font-mono text-xs text-gray-500 sm:table-cell dark:text-gray-400">
                          {row.ip ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.count}</td>
                        <td className="hidden px-4 py-2.5 text-right tabular-nums text-gray-500 md:table-cell dark:text-gray-400">
                          {payload.summary.checkedIn > 0
                            ? `${Math.round((row.count / payload.summary.checkedIn) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {scanDays.length > 1 ? (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Scans pr. dag</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-0 text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Dato</th>
                      <th className="px-4 py-3 text-right">Scans</th>
                      <th className="px-4 py-3 text-right">Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {scanDays.map((row) => (
                      <tr key={row.day} className="text-gray-800 dark:text-gray-200">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{formatAnalyticsDayTitle(row.day)}</span>
                          <span className="mt-0.5 block font-mono text-xs text-gray-500 dark:text-gray-400">
                            {row.day}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{row.count}</td>
                        <td className="px-4 py-2.5 text-right">
                          {row.day === selectedDay ? (
                            <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                              Valgt
                            </span>
                          ) : (
                            <Link
                              href={`/scanalytics?dag=${encodeURIComponent(row.day)}`}
                              className="text-sm font-medium text-[#0f766e] hover:underline dark:text-teal-300"
                            >
                              Vis tidslinje
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
