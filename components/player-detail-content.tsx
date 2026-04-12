import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import type { PlayerDetail } from "@/types/player";
import { formatBirthdate, formatPreferences } from "@/lib/format";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-lc-border py-5 last:border-b-0 dark:border-gray-700">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-2 text-base leading-relaxed text-gray-900 dark:text-gray-100">{value}</dd>
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
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {player.name}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Spillerdetaljer</p>

      {teamName ? (
        <div
          className="relative mt-6 overflow-hidden rounded-2xl border-2 border-[#14b8a6]/55 bg-gradient-to-br from-teal-50 via-white to-cyan-50/90 p-5 shadow-[0_12px_40px_-12px_rgba(13,148,136,0.35),inset_0_1px_0_0_rgba(255,255,255,0.8)] ring-1 ring-[#14b8a6]/20 dark:border-teal-500/45 dark:from-teal-950/70 dark:via-gray-950/40 dark:to-teal-950/30 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] dark:ring-teal-400/15"
          role="status"
          aria-label={`Tildelt hold: ${teamName}`}
        >
          <div
            className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-[#14b8a6]/20 blur-2xl dark:bg-teal-400/15"
            aria-hidden
          />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#14b8a6] text-white shadow-md shadow-teal-600/25 dark:bg-teal-500 dark:shadow-teal-900/40">
              <UsersRound className="h-6 w-6" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#0f766e] dark:text-teal-300">
                Tildelt hold
              </p>
              <p className="mt-1.5 break-words text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-white">
                {teamName}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <dl className="mt-6">
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
        <DetailRow
          label="Billet-ID"
          value={
            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
              {formatDash(player.ticket_id)}
            </span>
          }
        />
      </dl>
    </>
  );
}
