"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClubCountRow, GenderSlice, LevelCountRow } from "@/lib/dashboard-compute";
import { formatLevelChartLabel, wrapTextLines } from "@/lib/chart-format";
import { AnalyticsChartCard, ChartPlotWell } from "@/components/dashboard/analytics-chart-card";
import {
  ClubBarTooltip,
  LevelBarTooltip,
  PieSliceTooltip,
} from "@/components/dashboard/analytics-tooltip";

const COLOR_LEVEL = "#14b8a6";
const COLOR_CLUB = "#3b82f6";
const COLOR_CLUB_LEAD = "#2563eb";

const PIE_COLORS = ["#14b8a6", "#3b82f6", "#0d9488", "#64748b", "#94a3b8", "#78716b"];

const GRID_STROKE = "#eceef2";

const TICK_AXIS = {
  fill: "#6b7280",
  fontSize: 11,
  fontWeight: 500 as const,
};

const CLUB_LABEL_MAX_CHARS = 26;
const CLUB_LINE_HEIGHT = 13;

type ClubTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
  index?: number;
};

/**
 * Full club names, multi-line, ranked — leaderboard-style Y-axis labels.
 */
function ClubLeaderboardTick({ x = 0, y = 0, payload, index = 0 }: ClubTickProps) {
  const rank = index + 1;
  const fullName = String(payload?.value ?? "");
  const lines = wrapTextLines(fullName, CLUB_LABEL_MAX_CHARS);
  const startY = y - ((lines.length - 1) * CLUB_LINE_HEIGHT) / 2;
  const labelX = x - 10;

  return (
    <text textAnchor="end" className="font-sans" dominantBaseline="middle">
      <tspan x={labelX} y={startY} fontSize={12} fontWeight={500}>
        <tspan fill="#94a3b8" fontWeight={600} fontSize={11}>
          {rank}.
        </tspan>
        <tspan fill="#1f2937">{lines[0] ? ` ${lines[0]}` : ""}</tspan>
      </tspan>
      {lines.slice(1).map((line, i) => (
        <tspan
          key={i}
          x={labelX}
          dy={CLUB_LINE_HEIGHT}
          fill="#1f2937"
          fontSize={12}
          fontWeight={500}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

type LevelChartRow = LevelCountRow & { shortLabel: string };

type Props = {
  levelData: LevelCountRow[];
  clubData: ClubCountRow[];
  genderData: GenderSlice[];
};

function clubValueLabel(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "";
  return `${n} spillere`;
}

export function DashboardCharts({ levelData, clubData, genderData }: Props) {
  const levelRows: LevelChartRow[] = levelData.map((row) => ({
    ...row,
    shortLabel: formatLevelChartLabel(row.name),
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
            <div className="h-[min(360px,52vh)] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={levelRows}
                  margin={{ top: 8, right: 12, left: 4, bottom: 52 }}
                  barCategoryGap="18%"
                  barGap={5}
                >
                  <CartesianGrid
                    strokeDasharray="4 10"
                    vertical={false}
                    stroke={GRID_STROKE}
                    strokeOpacity={1}
                  />
                  <XAxis
                    dataKey="shortLabel"
                    tick={TICK_AXIS}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    height={48}
                    dy={10}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={TICK_AXIS}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    content={LevelBarTooltip}
                    cursor={{ fill: "rgb(20 184 166 / 0.06)" }}
                    animationDuration={150}
                  />
                  <Bar
                    dataKey="count"
                    name="Antal"
                    fill={COLOR_LEVEL}
                    radius={[8, 8, 4, 4]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPlotWell>
        )}
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Top 5 klubber"
        subtitle="Klubber med flest spillere"
        accentClassName="bg-[#3b82f6]"
      >
        {clubData.length === 0 ? (
          <EmptyChart message="Ingen klubdata" />
        ) : (
          <ChartPlotWell>
            <div className="h-[min(380px,56vh)] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={clubData}
                  margin={{ top: 12, right: 12, left: 8, bottom: 12 }}
                  barCategoryGap="22%"
                  barGap={6}
                >
                  <CartesianGrid
                    strokeDasharray="4 10"
                    horizontal={false}
                    stroke={GRID_STROKE}
                    strokeOpacity={1}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={TICK_AXIS}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="club"
                    width={248}
                    tick={<ClubLeaderboardTick />}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <Tooltip
                    content={ClubBarTooltip}
                    cursor={{ fill: "rgb(59 130 246 / 0.07)" }}
                    animationDuration={150}
                  />
                  <Bar dataKey="count" name="Spillere" radius={[4, 10, 10, 4]} maxBarSize={36}>
                    {clubData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={i === 0 ? COLOR_CLUB_LEAD : COLOR_CLUB} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      offset={12}
                      formatter={clubValueLabel}
                      style={{
                        fill: "#64748b",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
        {genderData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartPlotWell>
            <div className="mx-auto h-[min(360px,54vh)] w-full max-w-lg min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="48%"
                    outerRadius="76%"
                    paddingAngle={2.5}
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={({ name, percent }) =>
                      `${name ?? ""} · ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={PieSliceTooltip} animationDuration={150} />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{
                      paddingTop: 24,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#6b7280",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
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
