import type { ReactNode } from "react";
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
};

/**
 * Fælles spillerdetaljer til modal og evt. fuld side.
 */
export function PlayerDetailContent({ player }: Props) {
  const prefsText = formatPreferences(player.preferences);
  const prefsIsMultiline = prefsText.includes("\n");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {player.name}
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Spillerdetaljer</p>

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
