"use client";

import Link from "next/link";
import { Clock, MapPin, UsersRound } from "lucide-react";
import { formatDaTimeOnly } from "@/lib/datetime";
import { formatCourtWithVenue } from "@/lib/kampprogram";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import type { PlayerAssignedTeamSummary } from "@/lib/players";
import type {
  ParticipantCoach,
  ParticipantPerson,
  ParticipantScheduledMatch,
  ParticipantTeamRoster,
  ParticipantTeamSummary,
} from "@/lib/participant-modal-context";

function matchLocationLabel(match: ParticipantScheduledMatch): string | null {
  const court = match.courtName?.trim();
  const venue = match.venueName?.trim();
  if (court) return formatCourtWithVenue(court, venue);
  return null;
}

function MatchScheduleList({
  matches,
  showOwnTeam,
}: {
  matches: ParticipantScheduledMatch[];
  showOwnTeam?: boolean;
}) {
  if (matches.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Ingen kampe registreret endnu. Når kampene er planlagt, vises modstander, tid og bane her.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {matches.map((match) => {
        const timeLabel = match.startTime ? formatDaTimeOnly(match.startTime) : null;
        const locationLabel = matchLocationLabel(match);
        return (
          <li
            key={match.id}
            className="border border-gray-200 bg-gray-50/80 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-800/45"
          >
            {showOwnTeam && match.ownTeamName ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                {match.ownTeamName}
              </p>
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0f766e] dark:text-teal-300">
              Kamp mod
            </p>
            <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{match.opponentTeamName}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-200/80 pt-3 dark:border-gray-600/60">
              <div>
                <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
                  Tid
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {timeLabel ? `kl. ${timeLabel}` : "Ikke planlagt"}
                </dd>
              </div>
              <div className="border-l border-gray-200/80 pl-3 dark:border-gray-600/60">
                <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
                  Bane
                </dt>
                <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {locationLabel ?? "Ikke planlagt"}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

function PersonList({
  people,
  currentId,
  selfLabel,
}: {
  people: ParticipantPerson[];
  currentId?: string;
  selfLabel?: string;
}) {
  if (people.length === 0) {
    return <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Ingen registreret endnu.</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {people.map((p) => {
        const isSelf = currentId === p.id;
        return (
          <li
            key={p.id}
            className={`border px-3 py-2 text-sm ${
              isSelf
                ? "border-teal-300/80 bg-teal-50/80 dark:border-teal-800/70 dark:bg-teal-950/30"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {p.name}
              {isSelf && selfLabel ? (
                <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-teal-900/50 dark:text-teal-200">
                  {selfLabel}
                </span>
              ) : null}
            </span>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {p.home_club?.trim() || "—"} ·{" "}
              {p.age != null && !Number.isNaN(p.age) ? `${p.age} år` : "Alder —"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CoachList({ coaches, currentId }: { coaches: ParticipantCoach[]; currentId?: string }) {
  if (coaches.length === 0) {
    return <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Ingen trænere registreret endnu.</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {coaches.map((c) => {
        const isSelf = currentId === c.id;
        return (
          <li
            key={c.id}
            className={`border px-3 py-2 text-sm ${
              isSelf
                ? "border-teal-300/80 bg-teal-50/80 dark:border-teal-800/70 dark:bg-teal-950/30"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            }`}
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {c.name}
              {isSelf ? (
                <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-teal-900/50 dark:text-teal-200">
                  Dig
                </span>
              ) : null}
            </span>
            {c.home_club?.trim() ? (
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{c.home_club.trim()}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type PlayerProps = {
  mode: "player";
  assignedTeam: PlayerAssignedTeamSummary | null;
  teammates: ParticipantPerson[];
  coaches: ParticipantCoach[];
  matches: ParticipantScheduledMatch[];
  currentPlayerId: string;
  onTeamNavigate?: () => void;
};

type CoachProps = {
  mode: "coach";
  teams: ParticipantTeamSummary[];
  teamRosters: ParticipantTeamRoster[];
  matches: ParticipantScheduledMatch[];
  currentCoachId: string;
};

type Props = (PlayerProps | CoachProps) & {
  contextError?: string | null;
};

export function ParticipantModalContextPanel(props: Props) {
  const { contextError } = props;

  if (contextError) {
    return (
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
        Kunne ikke hente hold og kampprogram: {contextError}
      </div>
    );
  }

  if (props.mode === "player") {
    const { assignedTeam, teammates, coaches, matches, currentPlayerId, onTeamNavigate } = props;

    if (!assignedTeam) {
      return (
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-4 dark:border-gray-600 dark:bg-gray-800/30">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Ikke tilknyttet et hold</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Når spilleren er på et hold, vises holdkammerater, trænere og kampprogram her.
          </p>
        </section>
      );
    }

    const showOfficialSubtitle =
      assignedTeam.displayName.trim() !== assignedTeam.officialName.trim();

    return (
      <div className="space-y-4">
        <section className="border border-teal-200 bg-teal-50 px-3.5 py-3 dark:border-teal-800/70 dark:bg-teal-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#14b8a6] text-white dark:bg-teal-500">
              <UsersRound className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#0f766e] dark:text-teal-300">
                Hold og trænere
              </p>
              <p className="mt-1 break-words text-base font-bold text-gray-900 dark:text-white">
                {assignedTeam.displayName}
              </p>
              {showOfficialSubtitle ? (
                <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-400">{assignedTeam.officialName}</p>
              ) : null}
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {formatLevelShortLabel(assignedTeam.levelKey)}
              </p>
              <p className="mt-2">
                <Link
                  href={`/holddannelse/alle-hold#team-${encodeURIComponent(assignedTeam.teamId)}`}
                  onClick={() => onTeamNavigate?.()}
                  className="inline-flex items-center rounded-md border border-teal-300/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f766e] hover:bg-teal-50 dark:border-teal-700 dark:bg-transparent dark:text-teal-200 dark:hover:bg-teal-950/40"
                >
                  Se hold i Holddannelse
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-teal-200/80 pt-4 dark:border-teal-800/50">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Holdkammerater
            </h3>
            <PersonList people={teammates} currentId={currentPlayerId} selfLabel="Denne spiller" />
          </div>

          <div className="mt-4 border-t border-teal-200/80 pt-4 dark:border-teal-800/50">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Trænere</h3>
            <CoachList coaches={coaches} />
          </div>
        </section>

        <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            Kampprogram
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Kampe med modstander, tid og bane</p>
          <MatchScheduleList matches={matches} />
        </section>
      </div>
    );
  }

  const { teams, teamRosters, matches, currentCoachId } = props;
  const rosterByTeamId = new Map(teamRosters.map((r) => [r.teamId, r] as const));

  if (teams.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-4 dark:border-gray-600 dark:bg-gray-800/30">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Ikke tilknyttet et hold</p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Når træneren er knyttet til et hold, vises spillere, medtrænere og kampprogram her.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="border border-teal-200 bg-teal-50 px-3.5 py-3 dark:border-teal-800/70 dark:bg-teal-950/30">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-[#0f766e] dark:text-teal-300">
          Hold og trænere
        </p>
        <div className="mt-3 space-y-4">
          {teams.map((team) => {
            const roster = rosterByTeamId.get(team.teamId);
            const showOfficialSubtitle = team.displayName.trim() !== team.officialName.trim();
            return (
              <article
                key={team.teamId}
                className="border border-teal-200/70 bg-white/70 px-3 py-3 dark:border-teal-800/50 dark:bg-gray-900/40"
              >
                <p className="font-semibold text-gray-900 dark:text-gray-100">{team.displayName}</p>
                {showOfficialSubtitle ? (
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{team.officialName}</p>
                ) : null}
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{formatLevelShortLabel(team.levelKey)}</p>
                <p className="mt-2">
                  <Link
                    href={`/holddannelse/alle-hold#team-${encodeURIComponent(team.teamId)}`}
                    className="inline-flex items-center rounded-md border border-teal-300/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0f766e] hover:bg-teal-50 dark:border-teal-700 dark:bg-transparent dark:text-teal-200 dark:hover:bg-teal-950/40"
                  >
                    Se hold i Holddannelse
                  </Link>
                </p>

                <div className="mt-3 border-t border-gray-200/80 pt-3 dark:border-gray-700">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Spillere
                  </h3>
                  <PersonList people={roster?.players ?? []} />
                </div>

                <div className="mt-3 border-t border-gray-200/80 pt-3 dark:border-gray-700">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Trænere
                  </h3>
                  <CoachList coaches={roster?.coaches ?? []} currentId={currentCoachId} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Kampprogram</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Kampe for trænerens hold med tid og bane</p>
        <MatchScheduleList matches={matches} showOwnTeam={teams.length > 1} />
      </section>
    </div>
  );
}
