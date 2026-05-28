import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import type { CheckStatus } from "@/lib/lykkecup-check";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import type { TurneringsplanMatchStatus } from "@/lib/turneringsplan-status";

function statusIcon(status: CheckStatus) {
  if (status === "ok") return CheckCircle2;
  if (status === "warn") return AlertTriangle;
  return XCircle;
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
  if (status === "ok") return "OK";
  if (status === "warn") return "Bemærkninger";
  return "Skal rettes";
}

function formatRanAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  status: TurneringsplanMatchStatus;
  loadError?: string | null;
};

export function PlanOverviewStatus({ status, loadError }: Props) {
  const styles = statusStyles(status.overallStatus);
  const Icon = statusIcon(status.overallStatus);
  const m = status.metrics;

  return (
    <section
      className={`rounded-xl border p-4 shadow-lc-card dark:shadow-none sm:p-5 ${styles.border} ${styles.bg}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${styles.icon}`} strokeWidth={2} aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampstatus</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Overblik over genererede kampe, planlægning og konflikter. Opdateres når siden indlæses.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Sidst beregnet: {formatRanAt(status.ranAt)}
              {loadError ? (
                <span className="text-amber-700 dark:text-amber-300"> · Banenavne kunne ikke indlæses</span>
              ) : null}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
        >
          {statusLabel(status.overallStatus)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <Metric label="Forventet" value={m.expectedMatches} />
        <Metric label="Genereret" value={m.generatedMatches} highlight />
        <Metric label="Med bane & tid" value={m.scheduledMatches} />
        <Metric label="Mangler plan" value={m.unscheduledMatches} warn={m.unscheduledMatches > 0} />
        <Metric label="Bane-konflikter" value={m.courtConflicts} warn={m.courtConflicts > 0} error={m.courtConflicts > 0} />
        <Metric label="Hold-pause" value={m.teamRestWarnings} warn={m.teamRestWarnings > 0} />
        <Metric label="Mangler pause" value={m.relaxedRestMatches} warn={m.relaxedRestMatches > 0} />
        <Metric label="Pulje-sync" value={m.poolsOutOfSync} warn={m.poolsOutOfSync > 0} />
        <Metric label="Hold spænder perioder" value={m.teamsSpanningPeriods} warn={m.teamsSpanningPeriods > 0} />
        <Metric label="Forældreløse" value={m.orphanMatches} error={m.orphanMatches > 0} />
      </dl>

      {status.levelBreakdown.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/70 bg-white/60 dark:border-gray-700/50 dark:bg-gray-900/40">
          <table className="min-w-[480px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-3 py-2">Niveau</th>
                <th className="px-3 py-2">Forventet</th>
                <th className="px-3 py-2">Genereret</th>
                <th className="px-3 py-2">Planlagt</th>
                <th className="px-3 py-2">Mangler</th>
              </tr>
            </thead>
            <tbody>
              {status.levelBreakdown.map((row) => (
                <tr key={row.levelKey} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{formatLevelShortLabel(row.levelKey)}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{row.expected}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{row.generated}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{row.scheduled}</td>
                  <td
                    className={`px-3 py-2 tabular-nums font-medium ${
                      row.unscheduled > 0 ? "text-amber-800 dark:text-amber-300" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {row.unscheduled}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {status.issueGroups.length > 0 ? (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detaljer</h3>
          <ul className="space-y-2">
            {status.issueGroups.map((group) => {
              const gStyles = statusStyles(group.status);
              return (
                <li
                  key={group.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${gStyles.border} bg-white/70 dark:bg-gray-900/50`}
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {group.title}
                    <span className="ml-2 tabular-nums text-gray-500 dark:text-gray-400">({group.count})</span>
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-gray-700 dark:text-gray-300">
                    {group.items.map((item, idx) => (
                      <li key={`${group.id}-${idx}`} className="leading-snug">
                        {item}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-emerald-800 dark:text-emerald-200">
          Ingen konflikter fundet — kampantal og planlægning stemmer med opsætningen.
        </p>
      )}

      {m.unscheduledMatches > 0 ? (
        <p className="mt-4 text-sm text-amber-900 dark:text-amber-100">
          <Link
            href="/kampprogram?filter=unscheduled"
            className="font-medium text-[#0d9488] hover:underline dark:text-teal-400"
          >
            Åbn Kampprogram → Ikke planlagt
          </Link>
          {" "}
          ({m.unscheduledMatches} kamp{m.unscheduledMatches === 1 ? "" : "e"} mangler bane eller tid)
        </p>
      ) : null}

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Fuld kontrol af spillere, hold og puljer:{" "}
        <Link href="/kampprogram/check" className="font-medium text-[#0d9488] hover:underline dark:text-teal-400">
          LykkeCup Check
        </Link>
        .
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  warn = false,
  error = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
  error?: boolean;
}) {
  let valueClass = "text-gray-900 dark:text-white";
  if (error && value > 0) valueClass = "text-red-700 dark:text-red-300";
  else if (warn && value > 0) valueClass = "text-amber-800 dark:text-amber-300";
  else if (highlight) valueClass = "text-[#0f766e] dark:text-teal-300";

  return (
    <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 dark:border-gray-700/50 dark:bg-gray-900/40">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}
