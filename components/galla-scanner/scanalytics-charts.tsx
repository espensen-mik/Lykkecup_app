"use client";

import type { ReactNode } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { DefaultSeries, PointTooltipProps } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { ChartPlotWell } from "@/components/dashboard/analytics-chart-card";
import { SlimHorizontalBarChart } from "@/components/dashboard/slim-horizontal-bars";
import type { GallaDeviceScanCount } from "@/lib/galla-scanalytics-server";
import { normalizeHourlyPoints, type HourlyViewPoint } from "@/lib/lc-analytics-display";

const ACCENT = "#14b8a6";
const ACCENT_LEAD = "#0d9488";
const LINE_BG = "#0f172a";
const AXIS = "#94a3b8";
const GRID = "rgb(148 163 184 / 0.12)";

const lineTheme = {
  background: LINE_BG,
  text: { fill: AXIS, fontSize: 11 },
  grid: { line: { stroke: GRID, strokeWidth: 1 } },
  axis: {
    domain: { line: { stroke: GRID, strokeWidth: 1 } },
    ticks: {
      line: { stroke: GRID, strokeWidth: 1 },
      text: { fill: AXIS, fontSize: 11, fontWeight: 500 },
    },
    legend: { text: { fill: "#cbd5e1", fontSize: 12, fontWeight: 600 } },
  },
  crosshair: { line: { stroke: ACCENT, strokeWidth: 1, strokeOpacity: 0.6 } },
  tooltip: {
    container: {
      background: "#1e293b",
      color: "#f1f5f9",
      fontSize: 12,
      borderRadius: 8,
      border: "1px solid rgb(51 65 85)",
      boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
    },
  },
} as const;

type PieDatum = { id: string; label: string; value: number; color: string };

function ScanHourTooltip({ point }: PointTooltipProps<DefaultSeries>) {
  return (
    <div className="px-2 py-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time</div>
      <div className="mt-0.5 tabular-nums text-sm font-semibold text-white">{String(point.data.xFormatted)}</div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scannet</div>
      <div className="tabular-nums text-sm font-semibold text-teal-300">{point.data.yFormatted}</div>
    </div>
  );
}

function PieTooltip({ datum, total }: { datum: { label: string | number; value: number }; total: number }) {
  const pct = total > 0 ? Math.round((datum.value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-gray-200/95 bg-white px-3.5 py-2.5 shadow-lg dark:border-gray-600 dark:bg-gray-900">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400">
        {String(datum.label)}
      </p>
      <p className="mt-2 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {datum.value}{" "}
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          billetter ({pct}%)
        </span>
      </p>
    </div>
  );
}

export function ScanalyticsCheckInPie({ checkedIn, remaining }: { checkedIn: number; remaining: number }) {
  const pieData: PieDatum[] = [
    { id: "checked_in", label: "Checket ind", value: checkedIn, color: "#14b8a6" },
    { id: "remaining", label: "Mangler check-in", value: remaining, color: "#e2e8f0" },
  ].filter((d) => d.value > 0);

  const total = checkedIn + remaining;

  return (
    <div className="overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-700 sm:px-6 sm:pt-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Check-in status</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Andel af billetter der er scannet ind
        </p>
      </div>
      <div className="px-4 pb-6 pt-4 sm:px-6 sm:pb-7">
        {pieData.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Ingen billetter endnu</p>
        ) : (
          <ChartPlotWell>
            <div className="mx-auto h-[min(280px,45vh)] w-full max-w-md min-h-[220px]">
              <ResponsivePie<PieDatum>
                data={pieData}
                id="id"
                value="value"
                margin={{ top: 12, right: 12, bottom: 64, left: 12 }}
                innerRadius={0.55}
                padAngle={0.02}
                cornerRadius={3}
                borderWidth={2}
                borderColor="#ffffff"
                colors={(d) => d.data.color}
                enableArcLinkLabels
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsThickness={1}
                arcLinkLabelsColor={{ from: "color" }}
                arcLinkLabelsTextColor="#6b7280"
                arcLinkLabel={(d) =>
                  `${d.label} · ${total ? Math.round((d.value / total) * 100) : 0}%`
                }
                enableArcLabels={false}
                tooltip={(d) => <PieTooltip datum={d.datum} total={total} />}
                legends={[
                  {
                    anchor: "bottom",
                    direction: "row",
                    justify: false,
                    translateX: 0,
                    translateY: 48,
                    itemWidth: 120,
                    itemHeight: 14,
                    itemsSpacing: 8,
                    symbolSize: 11,
                    symbolShape: "circle",
                    itemTextColor: "#6b7280",
                    itemDirection: "left-to-right",
                  },
                ]}
              />
            </div>
          </ChartPlotWell>
        )}
      </div>
    </div>
  );
}

export function ScanalyticsDeviceBars({ rows }: { rows: GallaDeviceScanCount[] }) {
  const barRows = rows.map((r, i) => ({
    key: r.device,
    label: r.device,
    count: r.count,
    rank: i + 1,
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-700 sm:px-6 sm:pt-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Scans pr. enhed</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Hver scanner gemmer navnet i <code className="text-[11px]">checked_in_by</code>
        </p>
      </div>
      <div className="px-4 pb-6 pt-4 sm:px-6 sm:pb-7">
        {barRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Ingen scans endnu</p>
        ) : (
          <ChartPlotWell>
            <SlimHorizontalBarChart
              rows={barRows}
              barColor={ACCENT}
              leadBarColor={ACCENT_LEAD}
              chartLabel="Scans pr. enhed"
              countSuffix="billetter"
            />
          </ChartPlotWell>
        )}
      </div>
    </div>
  );
}

export function ScanalyticsHourlyLine({
  points,
  dayTitle,
  peakHour,
  peakLabel,
}: {
  points: HourlyViewPoint[];
  dayTitle: string;
  peakHour: number | null;
  peakLabel: string | null;
}) {
  const series = normalizeHourlyPoints(points);
  const data = [
    {
      id: "Scannet",
      data: series.map((p) => ({
        x: `${String(p.hour).padStart(2, "0")}:00`,
        y: p.views,
      })),
    },
  ];

  const maxViews = Math.max(1, ...series.map((p) => p.views));

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-900 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)]"
      role="img"
      aria-label={`Scans per time for ${dayTitle}`}
    >
      <div className="border-b border-slate-700/80 px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-teal-300/90">Tidsforløb</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">Scans per time</h2>
        <p className="mt-1 text-sm text-slate-400">{dayTitle} · Europe/Copenhagen</p>
        {peakLabel && peakHour != null ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-500/15 px-3 py-1.5 text-sm text-teal-200 ring-1 ring-teal-400/25">
            <span className="font-semibold">Peak:</span>
            <span>
              {peakLabel} ({series[peakHour]?.views ?? 0} billetter)
            </span>
          </p>
        ) : null}
      </div>
      <div className="h-[min(22rem,55vw)] w-full min-h-[260px] px-2 pb-4 pt-2 sm:min-h-[300px] sm:px-3 sm:pb-5">
        <ResponsiveLine
          data={data}
          theme={lineTheme}
          margin={{ top: 16, right: 28, bottom: 52, left: 52 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: 0, max: maxViews, stacked: false }}
          curve="monotoneX"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 0,
            tickPadding: 10,
            tickRotation: -35,
            legend: "Time",
            legendOffset: 44,
            legendPosition: "middle",
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 10,
            tickValues: 5,
            legend: "Antal scans",
            legendOffset: -44,
            legendPosition: "middle",
          }}
          colors={[ACCENT]}
          lineWidth={3}
          pointSize={10}
          pointColor={ACCENT}
          pointBorderWidth={2}
          pointBorderColor="#ffffff"
          enableGridX={false}
          enableGridY
          enableSlices={false}
          enableArea
          areaOpacity={0.12}
          areaBaselineValue={0}
          useMesh
          motionConfig="gentle"
          tooltip={ScanHourTooltip}
        />
      </div>
    </div>
  );
}

export function ScanalyticsStatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-xl border border-lc-border bg-gradient-to-br from-teal-50/90 to-white p-5 shadow-sm dark:border-teal-900/40 dark:from-teal-950/50 dark:to-gray-900"
          : "rounded-xl border border-lc-border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      }
    >
      <dt
        className={
          accent
            ? "text-xs font-semibold uppercase tracking-wide text-[#0f766e] dark:text-teal-300"
            : "text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        }
      >
        {label}
      </dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{value}</dd>
      {hint ? <dd className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</dd> : null}
    </div>
  );
}
