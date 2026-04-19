"use client";

import { ResponsiveLine } from "@nivo/line";
import type { DefaultSeries, PointTooltipProps } from "@nivo/line";
import { normalizeHourlyPoints, type HourlyViewPoint } from "@/lib/lc-analytics-display";

const ACCENT = "#2dd4bf";
const BG = "#0f172a";
const AXIS = "#94a3b8";
const GRID = "rgb(148 163 184 / 0.12)";

const lineTheme = {
  background: BG,
  text: { fill: AXIS, fontSize: 11 },
  grid: {
    line: { stroke: GRID, strokeWidth: 1 },
  },
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

function HourTooltip({ point }: PointTooltipProps<DefaultSeries>) {
  return (
    <div className="px-2 py-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Time</div>
      <div className="mt-0.5 tabular-nums text-sm font-semibold text-white">{String(point.data.xFormatted)}</div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Visninger</div>
      <div className="tabular-nums text-sm font-semibold text-teal-300">{point.data.yFormatted}</div>
    </div>
  );
}

type Props = {
  points: HourlyViewPoint[];
  dayTitle: string;
};

export function LcHourlyViewsLine({ points, dayTitle }: Props) {
  const series = normalizeHourlyPoints(points);
  const data = [
    {
      id: "Visninger",
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
      aria-label={`Visninger per time for ${dayTitle}`}
    >
      <div className="border-b border-slate-700/80 px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-teal-300/90">Dagsforløb</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">Visninger per time</h2>
        <p className="mt-1 text-sm text-slate-400">{dayTitle} · Europe/Copenhagen</p>
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
            legend: "Antal visninger",
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
          pointLabelYOffset={-12}
          tooltip={HourTooltip}
        />
      </div>
    </div>
  );
}
