"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import {
  Building2,
  CheckCircle2,
  Hourglass,
  Mail,
  MessageSquareText,
  Target,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type ApiData = {
  totals: {
    players: number;
    coaches: number;
    clubs: number;
    commentsTotal: number;
    commentsHandled: number;
  };
  averages: {
    playersAge: number | null;
    coachesAge: number | null;
  };
  progress: {
    totalPlayers: number;
    assignedPlayers: number;
    percentAssigned: number;
  };
  charts: {
    playersTimeline: { day: string; added: number; total: number }[];
    clubBars: { club: string; players: number }[];
    levelDistribution: { id: string; label: string; value: number }[];
  };
  updatedAt: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

function useAnimatedNumber(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const startValue = value;
    const diff = target - startValue;
    if (diff === 0) return;
    const start = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      const p = Math.min(1, (ts - start) / durationMs);
      setValue(startValue + diff * p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

function daysUntilLykkeCup2026(): number {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventDate = new Date(2026, 5, 6);
  const diffDays = Math.ceil((eventDate.getTime() - todayStart.getTime()) / 86_400_000);
  return Math.max(0, diffDays);
}

function KpiCard({
  icon,
  label,
  value,
  suffix,
  cardClassName,
  iconClassName,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  cardClassName?: string;
  iconClassName?: string;
}) {
  const numeric = typeof value === "number" ? value : Number.NaN;
  const animated = useAnimatedNumber(Number.isFinite(numeric) ? numeric : 0);
  const display =
    typeof value === "number"
      ? Number.isInteger(value)
        ? Math.round(animated).toLocaleString("da-DK")
        : animated.toFixed(1).replace(".", ",")
      : value;

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-300/35 hover:shadow-[0_12px_34px_rgba(20,184,166,0.22)] ${cardClassName ?? ""}`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-teal-300/20 to-emerald-300/5 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-teal-200 ${iconClassName ?? ""}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-300/85">{label}</p>
          <p className="mt-1 text-4xl font-black tracking-tight text-white drop-shadow-[0_0_14px_rgba(45,212,191,0.35)]">
            {display}
            {suffix ? <span className="ml-1 text-2xl font-bold text-teal-200/95">{suffix}</span> : null}
          </p>
        </div>
      </div>
    </article>
  );
}

export function PublicDashboardScreen() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hourglassFlipped, setHourglassFlipped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/public-dashboard", { cache: "no-store" });
      const json = (await res.json()) as ApiData | { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Kunne ikke hente dashboarddata.");
        return;
      }
      setError(null);
      setData(json as ApiData);
    }

    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      window.location.reload();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHourglassFlipped((prev) => !prev), 2600);
    return () => window.clearInterval(id);
  }, []);

  const percent = data?.progress.percentAssigned ?? 0;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const progressTextInside = clampedPercent >= 8;
  const clubBars = (data?.charts.clubBars ?? []).slice().reverse();
  const daysLeft = daysUntilLykkeCup2026();
  const levelDistribution = data?.charts.levelDistribution ?? [];
  return (
    <main className="h-screen w-screen overflow-hidden bg-[#0B1E2D] px-5 py-5 text-white xl:px-8 xl:py-6">
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(45,212,191,0.16),transparent_40%),radial-gradient(circle_at_84%_10%,rgba(16,185,129,0.12),transparent_38%),radial-gradient(circle_at_60%_80%,rgba(59,130,246,0.12),transparent_48%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>
      <div className="relative mx-auto flex h-full w-full max-w-[1920px] flex-col">
        <header className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm xl:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-teal-200/90">Mission Control</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                LykkeCup 2026 - KontrolCenter Dashboard
              </h1>
            </div>
            <div className="rounded-xl border border-teal-300/25 bg-teal-400/10 px-4 py-2 text-right">
              <p className="text-xs uppercase tracking-wide text-teal-100/80">Live Data</p>
              <p className="text-lg font-bold text-teal-100">{data ? formatTime(data.updatedAt) : "—"}</p>
            </div>
          </div>
        </header>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-red-200">{error}</p>
        ) : null}

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
            <KpiCard icon={<Users className="h-5 w-5" />} label="Antal spillere tilmeldt" value={data?.totals.players ?? 0} />
            <KpiCard icon={<UsersRound className="h-5 w-5" />} label="Antal trænere tilmeldt" value={data?.totals.coaches ?? 0} />
            <KpiCard icon={<Building2 className="h-5 w-5" />} label="Antal klubber der deltager" value={data?.totals.clubs ?? 0} />
            <KpiCard
              icon={<UserRound className="h-5 w-5" />}
              label="Gennemsnitsalder spillere"
              value={data?.averages.playersAge ?? "—"}
              suffix={data?.averages.playersAge != null ? "år" : undefined}
            />
            <KpiCard
              icon={<UsersRound className="h-5 w-5" />}
              label="Gennemsnitsalder trænere"
              value={data?.averages.coachesAge ?? "—"}
              suffix={data?.averages.coachesAge != null ? "år" : undefined}
            />
            <KpiCard
              icon={<Mail className="h-5 w-5" />}
              label="Kommentarer fra traenere"
              value={data?.totals.commentsTotal ?? 0}
              cardClassName="border-cyan-300/35 bg-gradient-to-br from-cyan-400/16 via-teal-300/10 to-emerald-300/8 shadow-[0_14px_32px_rgba(34,211,238,0.20)]"
              iconClassName="animate-pulse [animation-duration:2.6s]"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Antal kommentarer håndteret"
              value={data?.totals.commentsHandled ?? 0}
            />
            <KpiCard
              icon={
                <span
                  className={`inline-flex transition-transform duration-700 ${hourglassFlipped ? "rotate-180" : "rotate-0"}`}
                >
                  <Hourglass className="h-5 w-5" />
                </span>
              }
              label="Antal dage til LykkeCup 2026"
              value={daysLeft}
              suffix="dage"
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm xl:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Holddannelse fremdrift</h2>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                {percent >= 100 ? <Target className="h-5 w-5 text-amber-400" aria-hidden /> : null}
                {data?.progress.assignedPlayers ?? 0} af {data?.progress.totalPlayers ?? 0} spillere
              </div>
            </div>
            <div className="h-12 w-full overflow-hidden rounded-full border border-white/10 bg-[#112B3C]">
              <div
                className={`flex h-full items-center bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-[width] duration-700 ease-out ${
                  progressTextInside ? "justify-end pr-3" : "justify-start pl-0"
                }`}
                style={{ width: `${clampedPercent}%` }}
              >
                {progressTextInside ? (
                  <span className="rounded-full bg-[#083344]/20 px-2.5 py-0.5 text-lg font-black tracking-tight text-white/95 shadow-[0_2px_8px_rgba(8,51,68,0.35)]">
                    {percent.toFixed(1)}%
                  </span>
                ) : null}
              </div>
            </div>
            {!progressTextInside ? (
              <p className="mt-1 text-right text-sm font-black text-teal-100">{percent.toFixed(1)}%</p>
            ) : null}
            <p className="mt-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-teal-100/85">
              Procent færdig: {percent.toFixed(1)}%
            </p>
          </section>

          <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <article className="min-h-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Top klubber</p>
              <div className="h-[calc(100%-1.5rem)] min-h-[260px]">
              <ResponsiveBar
                data={clubBars}
                keys={["players"]}
                indexBy="club"
                layout="horizontal"
                margin={{ top: 12, right: 24, bottom: 12, left: 170 }}
                padding={0.35}
                borderRadius={5}
                axisTop={null}
                axisRight={null}
                axisBottom={null}
                axisLeft={{ tickSize: 0, tickPadding: 8 }}
                colors={({ index }) => {
                  const palette = ["#2dd4bf", "#34d399", "#22d3ee", "#14b8a6", "#10b981"];
                  return palette[index % palette.length]!;
                }}
                labelSkipWidth={20}
                labelTextColor="#0b1e2d"
                theme={{
                  axis: { ticks: { text: { fill: "#b3c5d8", fontSize: 11 } } },
                  grid: { line: { stroke: "rgba(148,163,184,0.15)", strokeWidth: 1 } },
                  tooltip: { container: { background: "#0f2235", color: "#d8e7f7", border: "1px solid rgba(255,255,255,0.15)" } },
                }}
              />
            </div>
          </article>

            <article className="min-h-0 overflow-visible rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Spillere fordelt på niveau</p>
              <div className="h-[calc(100%-1.5rem)] min-h-[360px] overflow-visible px-1 pb-1">
              <ResponsivePie
                data={levelDistribution}
                margin={{ top: 52, right: 155, bottom: 72, left: 155 }}
                innerRadius={0.6}
                padAngle={1.2}
                cornerRadius={4}
                activeOuterRadiusOffset={6}
                arcLinkLabelsSkipAngle={0}
                arcLinkLabelsOffset={8}
                arcLinkLabelsDiagonalLength={10}
                arcLinkLabelsStraightLength={16}
                arcLinkLabel={(d) => `${String(d.label)} (${Number(d.value)})`}
                colors={({ id }) => {
                  const key = String(id).toLowerCase();
                  if (key.includes("power")) return "#34d399";
                  if (key.includes("cool")) return "#2dd4bf";
                  if (key.includes("turbo")) return "#22d3ee";
                  if (key.includes("jazz")) return "#60a5fa";
                  if (key.includes("funk")) return "#10b981";
                  return "#14b8a6";
                }}
                enableArcLabels={false}
                arcLinkLabelsColor="#c9d8e8"
                arcLinkLabelsTextColor="#eef6ff"
                theme={{
                  labels: { text: { fill: "#eef6ff", fontSize: 12, fontWeight: 600 } },
                  tooltip: { container: { background: "#0f2235", color: "#d8e7f7", border: "1px solid rgba(255,255,255,0.15)" } },
                }}
              />
            </div>
          </article>
          </section>
        </div>
      </div>
    </main>
  );
}
