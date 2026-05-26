"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import type { SchedulingSummaryBannerMetrics, TeamMatchCountRow } from "@/lib/scheduling-summary";
import type { CheckStatus } from "@/lib/lykkecup-check";

function overallStatus(metrics: SchedulingSummaryBannerMetrics): CheckStatus {
  if (metrics.orphanMatches > 0 || metrics.courtConflicts > 0) return "error";
  if (
    metrics.unscheduled > 0 ||
    metrics.teamsWrongCount > 0 ||
    metrics.outsidePoolPeriod > 0 ||
    metrics.teamRestWarnings > 0 ||
    metrics.relaxedTeamRest > 0
  ) {
    return "warn";
  }
  if (metrics.generated === 0) return "warn";
  return "ok";
}

function statusStyles(status: CheckStatus) {
  if (status === "ok") {
    return {
      border: "border-emerald-200/90 dark:border-emerald-900/40",
      bg: "bg-emerald-50/50 dark:bg-emerald-950/25",
      icon: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    };
  }
  if (status === "warn") {
    return {
      border: "border-amber-200/90 dark:border-amber-900/40",
      bg: "bg-amber-50/40 dark:bg-amber-950/20",
      icon: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    };
  }
  return {
    border: "border-red-200/90 dark:border-red-900/40",
    bg: "bg-red-50/40 dark:bg-red-950/20",
    icon: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  };
}

function statusLabel(status: CheckStatus) {
  if (status === "ok") return "Klar";
  if (status === "warn") return "Mangler opmærksomhed";
  return "Skal rettes";
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />;
  if (status === "warn") return <AlertTriangle className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />;
  return <XCircle className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />;
}

function Metric({
  label,
  value,
  warn,
  error,
  href,
}: {
  label: string;
  value: number;
  warn?: boolean;
  error?: boolean;
  href?: string;
}) {
  let valueClass = "text-gray-900 dark:text-white";
  if (error && value > 0) valueClass = "text-red-700 dark:text-red-300";
  else if (warn && value > 0) valueClass = "text-amber-800 dark:text-amber-300";

  const inner = (
    <>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</dd>
    </>
  );

  if (href && value > 0) {
    return (
      <Link
        href={href}
        className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 transition hover:border-teal-200 hover:bg-teal-50/60 dark:border-gray-700/50 dark:bg-gray-900/40 dark:hover:border-teal-800"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 dark:border-gray-700/50 dark:bg-gray-900/40">
      {inner}
    </div>
  );
}

type Props = {
  metrics: SchedulingSummaryBannerMetrics;
  teamRows: TeamMatchCountRow[];
  levelFilter?: string;
  title?: string;
  description?: string;
  kampprogramLinks?: boolean;
};

export function SchedulingSummaryBanner({
  metrics,
  teamRows,
  levelFilter = "",
  title = "Planlægningsstatus",
  description = "Overblik efter generering og auto-planlægning — ret resten i Kampprogram.",
  kampprogramLinks = true,
}: Props) {
  const status = overallStatus(metrics);
  const styles = statusStyles(status);
  const [showTeamIssues, setShowTeamIssues] = useState(metrics.teamsWrongCount > 0);

  const filteredTeamRows = useMemo(() => {
    if (!levelFilter) return teamRows;
    return teamRows.filter((r) => r.levelKey === levelFilter);
  }, [teamRows, levelFilter]);

  const unscheduledHref = kampprogramLinks ? "/kampprogram?filter=unscheduled" : undefined;
  const outsideHref = kampprogramLinks ? "/kampprogram?filter=outside-period" : undefined;

  return (
    <section className={`rounded-xl border p-4 shadow-lc-card dark:shadow-none sm:p-5 ${styles.border} ${styles.bg}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className={styles.icon}>
            <StatusIcon status={status} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
        >
          {statusLabel(status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Kampe oprettet" value={metrics.generated} />
        <Metric label="Planlagt" value={metrics.scheduled} />
        <Metric
          label="Mangler bane/tid"
          value={metrics.unscheduled}
          warn={metrics.unscheduled > 0}
          href={unscheduledHref}
        />
        <Metric
          label="Hold med rigtigt antal"
          value={metrics.teamsMatchOk}
          warn={metrics.teamsWithPlan > 0 && metrics.teamsMatchOk < metrics.teamsWithPlan}
        />
        <Metric
          label="Hold afviger"
          value={metrics.teamsWrongCount}
          warn={metrics.teamsWrongCount > 0}
          error={metrics.teamsWrongCount > 0}
        />
        <Metric
          label="Uden for pulje-periode"
          value={metrics.outsidePoolPeriod}
          warn={metrics.outsidePoolPeriod > 0}
          href={outsideHref}
        />
        <Metric
          label="Mangler pause"
          value={metrics.relaxedTeamRest}
          warn={metrics.relaxedTeamRest > 0}
        />
        <Metric
          label="Bane-konflikter"
          value={metrics.courtConflicts}
          warn={metrics.courtConflicts > 0}
          error={metrics.courtConflicts > 0}
        />
        <Metric label="Hold-pause" value={metrics.teamRestWarnings} warn={metrics.teamRestWarnings > 0} />
        <Metric label="Forældreløse" value={metrics.orphanMatches} error={metrics.orphanMatches > 0} />
      </dl>

      {metrics.teamsWithPlan > 0 ? (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          {metrics.teamsMatchOk}/{metrics.teamsWithPlan} hold har det planlagte antal kampe fra Opsætning → Kampe.
        </p>
      ) : null}

      {filteredTeamRows.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTeamIssues((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-[#0d9488] dark:text-white dark:hover:text-teal-300"
          >
            {showTeamIssues ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
            Hold med for få eller for mange kampe ({filteredTeamRows.length})
          </button>
          {showTeamIssues ? (
            <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/70 bg-white/60 dark:border-gray-700/50 dark:bg-gray-900/40">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="px-3 py-2">Hold</th>
                    <th className="px-3 py-2">Niveau</th>
                    <th className="px-3 py-2">Kampe</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamRows.map((row) => (
                    <tr key={row.teamId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.teamName}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {formatLevelShortLabel(row.levelKey)}
                      </td>
                      <td
                        className={`px-3 py-2 tabular-nums font-medium ${
                          row.status === "under"
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {row.actual}/{row.planned}
                        {row.status === "under" ? " (mangler)" : " (for mange)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {metrics.unscheduled > 0 && kampprogramLinks ? (
        <p className="mt-4 text-sm text-amber-900 dark:text-amber-100">
          <Link href="/kampprogram?filter=unscheduled" className="font-medium text-[#0d9488] hover:underline dark:text-teal-400">
            Åbn Kampprogram → Ikke planlagt
          </Link>
          {" "}
          for at færdiggøre de sidste kampe.
        </p>
      ) : null}
    </section>
  );
}

export function KampprogramScheduleFollowUp({
  unscheduledCount,
  message,
}: {
  unscheduledCount: number;
  message?: string | null;
}) {
  if (!message && unscheduledCount <= 0) return null;

  return (
    <div className="mt-3 rounded-md border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-sm text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-100">
      {message ? <p>{message}</p> : null}
      {unscheduledCount > 0 ? (
        <p className={message ? "mt-2" : undefined}>
          <Link
            href="/kampprogram?filter=unscheduled"
            className="font-semibold text-[#0d9488] hover:underline dark:text-teal-300"
          >
            Åbn Kampprogram → Ikke planlagt
          </Link>
          {" "}
          ({unscheduledCount} kamp{unscheduledCount === 1 ? "" : "e"} mangler bane eller tid)
        </p>
      ) : null}
    </div>
  );
}
