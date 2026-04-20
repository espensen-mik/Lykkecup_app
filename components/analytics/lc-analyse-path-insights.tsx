"use client";

import type { ReactNode } from "react";
import { ResponsivePie } from "@nivo/pie";
import type { PathKindPieDatum } from "@/lib/lc-analytics-enrich";
import { ChartPlotWell } from "@/components/dashboard/analytics-chart-card";
import { SlimHorizontalBarChart } from "@/components/dashboard/slim-horizontal-bars";

const GRID_STROKE = "#eceef2";

const nivoTheme = {
  grid: {
    line: {
      stroke: GRID_STROKE,
      strokeWidth: 1,
      strokeDasharray: "4 6",
    },
  },
  axis: {
    domain: {
      line: { stroke: "transparent" },
    },
    ticks: {
      line: { stroke: "transparent" },
      text: {
        fill: "#6b7280",
        fontSize: 11,
        fontWeight: 500,
      },
    },
  },
} as const;

const BAR_COLOR = "#14b8a6";
const BAR_LEAD = "#0d9488";

function ChartTooltipBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200/95 bg-white px-3.5 py-2.5 shadow-lg shadow-gray-900/[0.06] ring-1 ring-gray-900/[0.03] dark:border-gray-600 dark:bg-gray-900">
      {title ? (
        <p className="max-w-[min(280px,70vw)] text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400">
          {title}
        </p>
      ) : null}
      <div
        className={
          title
            ? "mt-2 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50"
            : "text-base font-semibold tabular-nums text-gray-900 dark:text-gray-50"
        }
      >
        {children}
      </div>
    </div>
  );
}

function PathKindPieTooltip({
  datum,
  total,
}: {
  datum: { label: string | number; value: number };
  total: number;
}) {
  const pct = total > 0 ? Math.round((datum.value / total) * 100) : 0;
  return (
    <ChartTooltipBox title={String(datum.label)}>
      <span>
        {datum.value}{" "}
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">visninger</span>
        <span className="text-sm font-medium text-gray-400 dark:text-gray-500"> ({pct}%)</span>
      </span>
    </ChartTooltipBox>
  );
}

export type TopPathBarRow = {
  key: string;
  label: string;
  views: number;
  rank: number;
};

type Props = {
  pieData: PathKindPieDatum[];
  topBarRows: TopPathBarRow[];
};

export function LcAnalysePathInsights({ pieData, topBarRows }: Props) {
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const slimRows = topBarRows.map((r) => ({
    key: r.key,
    label: r.label,
    count: r.views,
    rank: r.rank,
  }));

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-700 sm:px-6 sm:pt-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Visninger efter sidetype</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Fordeling af sidevisninger (samme data som tabellen nedenfor)
          </p>
        </div>
        <div className="px-4 pb-6 pt-4 sm:px-6 sm:pb-7">
          {pieData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Ingen data til diagram</p>
          ) : (
            <ChartPlotWell>
              <div className="mx-auto h-[min(320px,50vh)] w-full max-w-lg min-h-[260px]">
                <ResponsivePie<PathKindPieDatum>
                  data={pieData}
                  id="id"
                  value="value"
                  theme={nivoTheme}
                  margin={{ top: 12, right: 12, bottom: 64, left: 12 }}
                  innerRadius={0.52}
                  padAngle={0.025}
                  cornerRadius={3}
                  borderWidth={2}
                  borderColor="#ffffff"
                  colors={(d) => d.data.color}
                  enableArcLinkLabels
                  arcLinkLabelsSkipAngle={8}
                  arcLinkLabelsThickness={1}
                  arcLinkLabelsColor={{ from: "color" }}
                  arcLinkLabelsTextColor="#6b7280"
                  arcLinkLabel={(d) =>
                    `${d.label} · ${pieTotal ? Math.round((d.value / pieTotal) * 100) : 0}%`
                  }
                  enableArcLabels={false}
                  tooltip={(d) => <PathKindPieTooltip datum={d.datum} total={pieTotal} />}
                  legends={[
                    {
                      anchor: "bottom",
                      direction: "row",
                      justify: false,
                      translateX: 0,
                      translateY: 48,
                      itemWidth: 100,
                      itemHeight: 14,
                      itemsSpacing: 6,
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

      <div className="overflow-hidden rounded-xl border border-lc-border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-700 sm:px-6 sm:pt-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Top sider</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Mest besøgte sider efter titel (op til 15)</p>
        </div>
        <div className="px-4 pb-6 pt-4 sm:px-6 sm:pb-7">
          {slimRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Ingen data</p>
          ) : (
            <ChartPlotWell>
              <SlimHorizontalBarChart
                rows={slimRows}
                barColor={BAR_COLOR}
                leadBarColor={BAR_LEAD}
                chartLabel="Top sider efter visninger"
                countSuffix="visninger"
              />
            </ChartPlotWell>
          )}
        </div>
      </div>
    </div>
  );
}
