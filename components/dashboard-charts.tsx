"use client";

import type { ReactNode } from "react";
import { ResponsiveBar } from "@nivo/bar";
import type { BarTooltipProps } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import type {
  AgeCountRow,
  ClubCountRow,
  GenderSlice,
  LevelCountRow,
} from "@/lib/dashboard-compute";
import { AnalyticsChartCard, ChartPlotWell } from "@/components/dashboard/analytics-chart-card";
import { SlimHorizontalBarChart } from "@/components/dashboard/slim-horizontal-bars";

const COLOR_LEVEL = "#14b8a6";
const COLOR_AGE = "#0d9488";
const COLOR_CLUB = "#3b82f6";
const COLOR_CLUB_LEAD = "#2563eb";

const PIE_COLORS = ["#14b8a6", "#3b82f6", "#0d9488", "#64748b", "#94a3b8", "#78716b"];

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

function ChartTooltipBox({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200/95 bg-white px-3.5 py-2.5 shadow-lg shadow-gray-900/[0.06] ring-1 ring-gray-900/[0.03]">
      {title ? (
        <p className="max-w-[min(280px,70vw)] text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
          {title}
        </p>
      ) : null}
      <div
        className={
          title
            ? "mt-2 text-base font-semibold tabular-nums text-gray-900"
            : "text-base font-semibold tabular-nums text-gray-900"
        }
      >
        {children}
      </div>
    </div>
  );
}

function AgeBarTooltip({ indexValue, value }: BarTooltipProps<AgeCountRow>) {
  const lbl = String(indexValue ?? "");
  const titleText =
    lbl === "Ukendt"
      ? "Alder · ikke angivet"
      : lbl === "25+"
        ? "Alder · 25 år eller derover"
        : lbl
          ? `Alder · ${lbl} år`
          : "Alder";
  return (
    <ChartTooltipBox title={titleText}>
      <span>
        {value}{" "}
        <span className="text-sm font-medium text-gray-500">spillere</span>
      </span>
    </ChartTooltipBox>
  );
}

type GenderPieDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
};

function PieSliceTooltip({ datum }: { datum: { label: string | number; value: number } }) {
  return (
    <ChartTooltipBox title={String(datum.label)}>
      <span>
        {datum.value}{" "}
        <span className="text-sm font-medium text-gray-500">spillere</span>
      </span>
    </ChartTooltipBox>
  );
}

type Props = {
  levelData: LevelCountRow[];
  clubData: ClubCountRow[];
  ageData: AgeCountRow[];
  genderData: GenderSlice[];
};

function formatBottomAxisInt(v: number | string): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n));
}

export function DashboardCharts({ levelData, clubData, ageData, genderData }: Props) {
  const genderTotal = genderData.reduce((s, d) => s + d.value, 0);
  const pieData: GenderPieDatum[] = genderData.map((d, i) => ({
    id: d.name,
    label: d.name,
    value: d.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const levelRows = levelData.map((row, i) => ({
    key: `lvl-${i}-${row.name}`,
    label: row.name,
    count: row.count,
  }));

  const clubRows = clubData.map((row, i) => ({
    key: `club-${i}-${row.club}`,
    label: row.club,
    count: row.count,
    rank: i + 1,
  }));

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
      <AnalyticsChartCard
        title="Spillere per niveau"
        subtitle="Fordeling på registrerede niveauer"
        accentClassName="bg-[#14b8a6]"
      >
        {levelRows.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartPlotWell>
            <SlimHorizontalBarChart
              rows={levelRows}
              barColor={COLOR_LEVEL}
              chartLabel="Spillere per niveau"
            />
          </ChartPlotWell>
        )}
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Top 5 klubber"
        subtitle="Klubber med flest spillere"
        accentClassName="bg-[#3b82f6]"
      >
        {clubRows.length === 0 ? (
          <EmptyChart message="Ingen klubdata" />
        ) : (
          <ChartPlotWell>
            <SlimHorizontalBarChart
              rows={clubRows}
              barColor={COLOR_CLUB}
              leadBarColor={COLOR_CLUB_LEAD}
              chartLabel="Top klubber efter antal spillere"
            />
          </ChartPlotWell>
        )}
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Aldersfordeling"
        subtitle="Antal spillere pr. alder — 25 år og opefter samlet som 25+"
        accentClassName="bg-[#0d9488]"
        className="lg:col-span-2"
      >
        {ageData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartPlotWell>
            <div className="h-[min(360px,52vh)] w-full min-h-[280px]">
              <ResponsiveBar<AgeCountRow>
                data={ageData}
                keys={["count"]}
                indexBy="label"
                theme={nivoTheme}
                margin={{ top: 12, right: 16, bottom: ageData.length > 14 ? 72 : 48, left: 48 }}
                padding={0.3}
                innerPadding={3}
                layout="vertical"
                borderRadius={4}
                borderWidth={0}
                colors={() => COLOR_AGE}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 10,
                  tickRotation: ageData.length > 14 ? -40 : 0,
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 8,
                  format: formatBottomAxisInt,
                }}
                enableGridY
                enableGridX={false}
                enableLabel={false}
                tooltip={AgeBarTooltip}
              />
            </div>
          </ChartPlotWell>
        )}
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Kønsfordeling"
        subtitle="Andel pr. registreret køn"
        accentClassName="bg-[#14b8a6]"
        className="lg:col-span-2"
      >
        {pieData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartPlotWell>
            <div className="mx-auto h-[min(360px,54vh)] w-full max-w-lg min-h-[280px]">
              <ResponsivePie<GenderPieDatum>
                data={pieData}
                id="id"
                value="value"
                theme={nivoTheme}
                margin={{ top: 16, right: 16, bottom: 72, left: 16 }}
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
                  `${d.label} · ${genderTotal ? Math.round((d.value / genderTotal) * 100) : 0}%`
                }
                enableArcLabels={false}
                tooltip={PieSliceTooltip}
                legends={[
                  {
                    anchor: "bottom",
                    direction: "row",
                    justify: false,
                    translateX: 0,
                    translateY: 52,
                    itemWidth: 110,
                    itemHeight: 16,
                    itemsSpacing: 8,
                    symbolSize: 12,
                    symbolShape: "circle",
                    itemTextColor: "#6b7280",
                    itemDirection: "left-to-right",
                  },
                ]}
              />
            </div>
          </ChartPlotWell>
        )}
      </AnalyticsChartCard>
    </div>
  );
}

function EmptyChart({ message = "Ingen data" }: { message?: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-gray-200/95 bg-gray-50/50 px-6 py-14">
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
}
