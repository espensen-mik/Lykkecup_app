import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import type { PlayerDetail } from "@/types/player";
import { formatBirthdate, formatPreferences } from "@/lib/format";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200/85 bg-white/85 px-3 py-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function formatDash(value: string | number | null): string {
  if (value === null || value === "") return "—";
  return String(value);
}

type Props = {
  player: PlayerDetail;
  /** Vises som fremhævet holdkort når spilleren er tildelt et hold */
  assignedTeamName?: string | null;
};

/**
 * Fælles spillerdetaljer til modal og evt. fuld side.
 */
export function PlayerDetailContent({ player, assignedTeamName }: Props) {
  const prefsText = formatPreferences(player.preferences);
  const prefsIsMultiline = prefsText.includes("\n");
  const teamName = assignedTeamName?.trim();

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {player.name}
      </h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Spillerdetaljer</p>

      {teamName ? (
        <div
          className="relative mt-4 overflow-hidden rounded-xl border border-[#14b8a6]/45 bg-gradient-to-br from-teal-50 via-white to-cyan-50/90 p-3.5 shadow-[0_10px_30px_-14px_rgba(13,148,136,0.45)] ring-1 ring-[#14b8a6]/15 dark:border-teal-500/40 dark:from-teal-950/70 dark:via-gray-950/40 dark:to-teal-950/30 dark:ring-teal-400/10"
          role="status"
          aria-label={`Tildelt hold: ${teamName}`}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-[#14b8a6]/20 blur-2xl dark:bg-teal-400/15"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14b8a6] text-white shadow-md shadow-teal-600/25 dark:bg-teal-500 dark:shadow-teal-900/40">
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5 leading-tight">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#0f766e] dark:text-teal-300">
                Tildelt hold
              </p>
              <p className="mt-1 break-words text-base font-bold tracking-tight text-gray-900 dark:text-white">
                {teamName}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DetailRow label="Hjemmeklub" value={formatDash(player.home_club)} />
        <DetailRow label="Fødselsdato" value={formatBirthdate(player.birthdate)} />
        <DetailRow label="Alder" value={formatDash(player.age)} />
        <DetailRow label="Køn" value={formatDash(player.gender)} />
        <DetailRow label="Niveau" value={formatDash(player.level)} />
        <DetailRow
          label="Præferencer"
          value={
            prefsIsMultiline ? (
              <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-gray-100 bg-gray-50 p-3 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                {prefsText}
              </pre>
            ) : (
              prefsText
            )
          }
        />
        <div className="sm:col-span-2">
          <DetailRow
            label="Billet-ID"
            value={
              <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                {formatDash(player.ticket_id)}
              </span>
            }
          />
        </div>
      </dl>
    </>
  );
}
