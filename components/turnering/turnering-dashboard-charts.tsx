"use client";

import { ResponsiveBar } from "@nivo/bar";
import { AnalyticsChartCard, ChartPlotWell } from "@/components/dashboard/analytics-chart-card";
import type { TurneringDashboardLevelStats } from "@/lib/turnering";

type Props = {
  levels: TurneringDashboardLevelStats[];
};

const nivoTheme = {
  grid: {
    line: {
      stroke: "#eceef2",
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

type ProgressRow = {
  level: string;
  "Hold i puljer (%)": number;
  "Kampe genereret (%)": number;
};

type VolumeRow = {
  level: string;
  Spillere: number;
  Puljer: number;
  Kampe: number;
};

export function TurneringDashboardCharts({ levels }: Props) {
  const progressData: ProgressRow[] = levels.map((l) => ({
    level: l.levelKey,
    "Hold i puljer (%)": l.teamPooledPct,
    "Kampe genereret (%)": Math.min(100, l.matchCoveragePct),
  }));

  const volumeData: VolumeRow[] = levels.map((l) => ({
    level: l.levelKey,
    Spillere: l.playerCount,
    Puljer: l.poolCount,
    Kampe: l.matchesGenerated,
  }));

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <AnalyticsChartCard
        title="Fremdrift per niveau"
        subtitle="Andel hold placeret i puljer samt andel genererede kampe"
        accentClassName="bg-[#14b8a6]"
      >
        <ChartPlotWell>
          {progressData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveBar<ProgressRow>
                data={progressData}
                keys={["Hold i puljer (%)", "Kampe genereret (%)"]}
                indexBy="level"
                groupMode="grouped"
                margin={{ top: 12, right: 16, bottom: 72, left: 48 }}
                padding={0.32}
                innerPadding={4}
                colors={["#14b8a6", "#3b82f6"]}
                borderRadius={4}
                enableGridY
                enableGridX={false}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 0, tickPadding: 10, tickRotation: progressData.length > 6 ? -24 : 0 }}
                axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => `${v}%` }}
                valueScale={{ type: "linear", min: 0, max: 100 }}
                enableLabel={false}
                theme={nivoTheme}
                tooltip={({ id, value, indexValue }) => (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                    <p className="font-semibold text-gray-900">{String(indexValue)}</p>
                    <p className="text-gray-700">
                      {String(id)}: <span className="font-semibold">{value}%</span>
                    </p>
                  </div>
                )}
              />
            </div>
          )}
        </ChartPlotWell>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Volumen per niveau"
        subtitle="Spillere, puljer og genererede kampe"
        accentClassName="bg-[#3b82f6]"
      >
        <ChartPlotWell>
          {volumeData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveBar<VolumeRow>
                data={volumeData}
                keys={["Spillere", "Puljer", "Kampe"]}
                indexBy="level"
                groupMode="grouped"
                margin={{ top: 12, right: 16, bottom: 72, left: 48 }}
                padding={0.32}
                innerPadding={4}
                colors={["#0d9488", "#14b8a6", "#3b82f6"]}
                borderRadius={4}
                enableGridY
                enableGridX={false}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 0, tickPadding: 10, tickRotation: volumeData.length > 6 ? -24 : 0 }}
                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                enableLabel={false}
                theme={nivoTheme}
                tooltip={({ id, value, indexValue }) => (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                    <p className="font-semibold text-gray-900">{String(indexValue)}</p>
                    <p className="text-gray-700">
                      {String(id)}: <span className="font-semibold">{value}</span>
                    </p>
                  </div>
                )}
              />
            </div>
          )}
        </ChartPlotWell>
      </AnalyticsChartCard>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-gray-200/95 bg-gray-50/50 px-6 py-14">
      <p className="text-sm font-medium text-gray-500">Ingen turneringsdata endnu</p>
    </div>
  );
}
