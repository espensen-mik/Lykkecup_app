import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import Link from "next/link";
import type { PlayerAssignedTeamSummary } from "@/lib/players";
import type { PlayerDetail } from "@/types/player";
import { formatBirthdate, formatPreferences } from "@/lib/format";

type EditablePlayerField = "name" | "home_club" | "birthdate" | "age" | "gender" | "level" | "preferences";

function DetailRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          {label}
        </dt>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Rediger
          </button>
        ) : null}
      </div>
      <dd className="mt-1.5 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function formatDash(value: string | number | null): string {
  if (value === null || value === "") return "—";
  return String(value);
}

function preferenceLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "egen_klub") return "Egen klub";
  if (key === "nye_venner") return "Nye venner";
  if (key === "alt_ok") return "Alt ok";
  if (key === "klar_pa_alt") return "Klar på alt";
  return raw;
}

function parsePreferenceList(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map((v) => preferenceLabel(String(v)));
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.map((v) => preferenceLabel(String(v)));
  } catch {
    // Not JSON; keep fallback below.
  }
  return null;
}

type Props = {
  player: PlayerDetail;
  /** Tildelt hold: kaldenavn stort når sat, officielt navn småt under. */
  assignedTeam?: PlayerAssignedTeamSummary | null;
  onEditField?: (field: EditablePlayerField) => void;
  onAssignedTeamNavigate?: () => void;
};

/**
 * Fælles spillerdetaljer til modal og evt. fuld side.
 */
export function PlayerDetailContent({ player, assignedTeam, onEditField, onAssignedTeamNavigate }: Props) {
  const parsedPrefs = parsePreferenceList(player.preferences);
  const prefsTextFriendly = parsedPrefs ? parsedPrefs.join(", ") : formatPreferences(player.preferences);
  const prefsIsMultiline = prefsTextFriendly.includes("\n");
  const showOfficialSubtitle =
    assignedTeam &&
    assignedTeam.displayName.trim() !== assignedTeam.officialName.trim();

  return (
    <>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Spillerdetaljer</p>

      {assignedTeam ? (
        <div
          className="mt-4 border border-teal-200 bg-teal-50 px-3.5 py-3 dark:border-teal-800/70 dark:bg-teal-950/30"
          role="status"
          aria-label={`Tildelt hold: ${assignedTeam.displayName}${
            showOfficialSubtitle ? ` (${assignedTeam.officialName})` : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#14b8a6] text-white dark:bg-teal-500">
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5 leading-tight">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#0f766e] dark:text-teal-300">
                Tildelt hold
              </p>
              <p className="mt-1 break-words text-base font-bold tracking-tight text-gray-900 dark:text-white">
                {assignedTeam.displayName}
              </p>
              {showOfficialSubtitle ? (
                <p className="mt-1 break-words text-xs font-normal text-gray-600 dark:text-gray-400">
                  {assignedTeam.officialName}
                </p>
              ) : null}
              <p className="mt-2">
                <Link
                  href={`/holddannelse/alle-hold#team-${encodeURIComponent(assignedTeam.teamId)}`}
                  onClick={() => onAssignedTeamNavigate?.()}
                  className="inline-flex items-center rounded-md border border-teal-300/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f766e] hover:bg-teal-50 dark:border-teal-700 dark:bg-transparent dark:text-teal-200 dark:hover:bg-teal-950/40"
                >
                  Se holdmedlemmer i Holddannelse
                </Link>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DetailRow label="Navn" value={formatDash(player.name)} onEdit={onEditField ? () => onEditField("name") : undefined} />
        <DetailRow
          label="Hjemmeklub"
          value={formatDash(player.home_club)}
          onEdit={onEditField ? () => onEditField("home_club") : undefined}
        />
        <DetailRow
          label="Fødselsdato"
          value={formatBirthdate(player.birthdate)}
          onEdit={onEditField ? () => onEditField("birthdate") : undefined}
        />
        <DetailRow label="Alder" value={formatDash(player.age)} onEdit={onEditField ? () => onEditField("age") : undefined} />
        <DetailRow label="Køn" value={formatDash(player.gender)} onEdit={onEditField ? () => onEditField("gender") : undefined} />
        <DetailRow label="Niveau" value={formatDash(player.level)} onEdit={onEditField ? () => onEditField("level") : undefined} />
        <DetailRow
          label="Præferencer"
          value={
            prefsIsMultiline ? (
              <pre className="mt-1 max-h-48 overflow-auto border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                {prefsTextFriendly}
              </pre>
            ) : (
              prefsTextFriendly
            )
          }
          onEdit={onEditField ? () => onEditField("preferences") : undefined}
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
