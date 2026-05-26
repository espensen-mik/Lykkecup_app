"use client";

import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { runLykkecupCheckAction } from "@/lib/lykkecup-check-actions";
import type { CheckStatus, LykkecupCheckItem, LykkecupCheckResult } from "@/lib/lykkecup-check";

function statusIcon(status: CheckStatus) {
  if (status === "ok") return CheckCircle2;
  if (status === "warn") return AlertTriangle;
  return XCircle;
}

function statusStyles(status: CheckStatus) {
  if (status === "ok") {
    return {
      row: "border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/25",
      icon: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    };
  }
  if (status === "warn") {
    return {
      row: "border-amber-200/90 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20",
      icon: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    };
  }
  return {
    row: "border-red-200/90 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20",
    icon: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  };
}

function statusLabel(status: CheckStatus) {
  if (status === "ok") return "OK";
  if (status === "warn") return "Advarsel";
  return "Skal rettes";
}

function formatRanAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function courtUsageLineStatus(line: string): CheckStatus {
  const m = line.match(/: (-?\d+) ledige runder/);
  if (!m) return "ok";
  return Number(m[1]) <= 0 ? "error" : "ok";
}

function IssueLine({ itemId, issue }: { itemId: string; issue: string }) {
  if (itemId !== "court-usage") {
    return <li className="leading-snug">{issue}</li>;
  }
  const lineStatus = courtUsageLineStatus(issue);
  const styles = statusStyles(lineStatus);
  return (
    <li className={`leading-snug rounded px-1.5 py-0.5 ${lineStatus === "error" ? "bg-red-50/80 dark:bg-red-950/30" : "text-gray-700 dark:text-gray-300"}`}>
      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${lineStatus === "error" ? "bg-red-500" : "bg-emerald-500"}`} aria-hidden />
      <span className={lineStatus === "error" ? styles.icon : undefined}>{issue}</span>
    </li>
  );
}

function CheckRow({ item }: { item: LykkecupCheckItem }) {
  const styles = statusStyles(item.status);
  const Icon = statusIcon(item.status);

  return (
    <li className={`rounded-xl border px-4 py-4 sm:px-5 sm:py-5 ${styles.row}`}>
      <div className="flex gap-3 sm:gap-4">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${styles.icon}`} strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{item.description}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
            >
              {statusLabel(item.status)}
            </span>
          </div>

          {item.metrics.length > 0 ? (
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {item.metrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-white/60 bg-white/70 px-3 py-2 dark:border-gray-700/50 dark:bg-gray-900/40">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                    {m.label}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {item.issues.length > 0 ? (
            <ul className="mt-3 space-y-1 rounded-lg border border-black/5 bg-white/60 px-3 py-2.5 text-sm text-gray-700 dark:border-white/10 dark:bg-gray-900/50 dark:text-gray-300">
              {item.issues.map((issue, idx) => (
                <IssueLine key={`${item.id}-${idx}`} itemId={item.id} issue={issue} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function LykkecupCheckWorkspace() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LykkecupCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await runLykkecupCheckAction();
      if (res.error) {
        setError(res.error);
        setResult(null);
      } else {
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke køre tjek.");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, []);

  const hasResult = Boolean(result);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Live kontrol af spillere, hold, puljer og kampe. Kør tjekket når du har ændret puljer, genereret kampe eller
            planlagt baner — så du kan stole på at turneringen hænger sammen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d9488] disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
          {running ? "Tjekker…" : "Kør LykkeCup Check"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {hasResult && result ? (
        <>
          <div
            className={`rounded-xl border px-5 py-4 sm:px-6 sm:py-5 ${
              result.summary.error === 0 && result.summary.warn === 0
                ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : result.summary.error === 0
                  ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/25"
                  : "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/25"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              {result.summary.error === 0 && result.summary.warn === 0 ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden />
              ) : result.summary.error === 0 ? (
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden />
              ) : (
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden />
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {result.summary.error === 0 && result.summary.warn === 0
                    ? "Alt ser godt ud"
                    : result.summary.error === 0
                      ? "Ingen kritiske fejl — nogle advarsler"
                      : "Der er noget der skal rettes"}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Sidst kørt: {formatRanAt(result.ranAt)}</p>
              </div>
            </div>
            <dl className="mt-4 flex flex-wrap gap-4 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">OK</dt>
                <dd className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{result.summary.ok}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Advarsler</dt>
                <dd className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{result.summary.warn}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Skal rettes</dt>
                <dd className="text-xl font-bold tabular-nums text-red-700 dark:text-red-300">{result.summary.error}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Tjek i alt</dt>
                <dd className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{result.summary.total}</dd>
              </div>
            </dl>
          </div>

          <ul className="space-y-3">
            {result.items.map((item) => (
              <CheckRow key={item.id} item={item} />
            ))}
          </ul>
        </>
      ) : !running && !error ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-6 py-14 text-center dark:border-gray-600 dark:bg-gray-900/30">
          <ShieldCheck className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" strokeWidth={1.5} aria-hidden />
          <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-200">Klar til at tjekke turneringen</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Tryk på «Kør LykkeCup Check» for at hente live data og se om spillere, hold, puljer og kampprogram stemmer
            overens.
          </p>
        </div>
      ) : null}
    </div>
  );
}
