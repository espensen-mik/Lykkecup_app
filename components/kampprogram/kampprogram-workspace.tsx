"use client";

import { CalendarClock, Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TeamDetailModal, TeamNameWithHover } from "@/components/teams/team-detail-ui";
import { StyledSelect } from "@/components/ui/styled-select";
import { deleteOrphanMatchesAction } from "@/lib/kampprogram-actions";
import {
  compareCourtNamesForSchedule,
  compareCourtTypes,
  courtTypeLabel,
  formatTimeForInput,
  timeToMinutes,
  type CourtType,
} from "@/lib/baner-tider";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import { getLevelVisualClasses } from "@/lib/level-colors";
import {
  buildCourtTimelineRows,
  formatCourtWithVenue,
  groupKampprogramByRound,
  type KampprogramBundle,
  type KampprogramLevelTiming,
  type KampprogramMatch,
  type KampprogramMatchFilter,
  type KampprogramTableRow,
} from "@/lib/kampprogram";
import { RelaxedRestScheduleHover } from "@/components/kampprogram/relaxed-rest-schedule-hover";
import { matchHasCurrentPauseIssue } from "@/lib/team-match-schedule";
import { kontrolCenterTeamDisplayName, type TeamDetailView } from "@/lib/team-detail";
import { useKontrolcenterLockdown } from "@/components/kontrolcenter-lockdown-context";
import { ManualScheduleDialog } from "@/components/turnering/manual-schedule-dialog";
import { teamRestMinutesBetweenMatches, teamRestViolatingTeamIdsByMatchId } from "@/lib/turnering-scheduler";

type ViewMode = "court" | "rounds";

type Props = {
  initial: KampprogramBundle;
  initialMatchFilter?: KampprogramMatchFilter;
};

type KampprogramMatchConflictHints = {
  courtOverlap: boolean;
  teamRestViolation: boolean;
  violatingTeamIds: string[];
  teamRestMinutes: number;
};

function overlapsMinutes(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

function buildKampprogramMatchConflictHints(
  matches: readonly KampprogramMatch[],
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): Map<string, KampprogramMatchConflictHints> {
  const out = new Map<string, KampprogramMatchConflictHints>();
  const byCourt = new Map<string, Array<{ id: string; start: number; end: number }>>();
  const byLevel = new Map<string, KampprogramMatch[]>();

  for (const m of matches) {
    if (m.isOrphan || !m.isScheduled || !m.courtId || !m.startTime || !m.endTime) continue;
    const start = timeToMinutes(m.startTime);
    const end = timeToMinutes(m.endTime);
    if (start == null || end == null || end <= start) continue;

    const courtList = byCourt.get(m.courtId) ?? [];
    courtList.push({ id: m.id, start, end });
    byCourt.set(m.courtId, courtList);

    const levelList = byLevel.get(m.levelKey) ?? [];
    levelList.push(m);
    byLevel.set(m.levelKey, levelList);
  }

  const courtOverlapIds = new Set<string>();
  for (const rows of byCourt.values()) {
    const sorted = [...rows].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (!overlapsMinutes(prev.start, prev.end, cur.start, cur.end)) continue;
      courtOverlapIds.add(prev.id);
      courtOverlapIds.add(cur.id);
    }
  }

  const teamRestByMatchId = new Map<string, { teamIds: string[]; restMinutes: number }>();
  for (const [levelKey, levelMatches] of byLevel) {
    const timing = levelTimingByLevel[levelKey];
    const restMinutes = teamRestMinutesBetweenMatches(timing?.roundLengthMinutes ?? 10);
    const violations = teamRestViolatingTeamIdsByMatchId(
      levelMatches.map((m) => ({
        id: m.id,
        team_a_id: m.teamAId,
        team_b_id: m.teamBId,
        start_time: m.startTime,
        end_time: m.endTime,
      })),
      restMinutes,
    );
    for (const [matchId, teamIds] of violations) {
      teamRestByMatchId.set(matchId, { teamIds, restMinutes });
    }
  }

  for (const m of matches) {
    if (m.isOrphan) continue;
    const courtOverlap = courtOverlapIds.has(m.id);
    const teamRest = teamRestByMatchId.get(m.id);
    const teamRestViolation = Boolean(teamRest);
    if (!courtOverlap && !teamRestViolation && !m.scheduledOutsidePoolPeriod) {
      continue;
    }
    out.set(m.id, {
      courtOverlap,
      teamRestViolation,
      violatingTeamIds: teamRest?.teamIds ?? [],
      teamRestMinutes: teamRest?.restMinutes ?? 0,
    });
  }

  return out;
}

function OutsidePoolPeriodBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
      title="Kampens starttid ligger uden for pulje-periodens klokke-vindue"
    >
      udenfor periode
    </span>
  );
}

/** Matches that show «Mangler pause» or «Uden hold-pause» in Status (baseret på aktuel tidsplan). */
function matchHasPauseIssue(
  m: KampprogramMatch,
  allMatches: readonly KampprogramMatch[],
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>,
): boolean {
  if (m.isOrphan || !m.isScheduled) return false;
  const hints = conflictHintsByMatchId.get(m.id);
  if (hints?.teamRestViolation && !m.scheduleRelaxedTeamRest) return true;
  return matchHasCurrentPauseIssue(m, allMatches, levelTimingByLevel);
}

function MatchStatusBadges({
  match,
  allMatches,
  teamDetails,
  levelTimingByLevel,
  conflictHints,
}: {
  match: KampprogramMatch;
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
  conflictHints?: KampprogramMatchConflictHints;
}) {
  const showHardTeamRestViolation =
    conflictHints?.teamRestViolation && !match.scheduleRelaxedTeamRest;
  const showRelaxedPauseBadge = matchHasCurrentPauseIssue(
    match,
    allMatches,
    levelTimingByLevel,
  );

  const hasBadges =
    match.scheduledOutsidePoolPeriod ||
    showRelaxedPauseBadge ||
    conflictHints?.courtOverlap ||
    showHardTeamRestViolation;

  if (!hasBadges) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  }

  const violatingTeamNames = (conflictHints?.violatingTeamIds ?? [])
    .map((teamId) => kontrolCenterTeamDisplayName(teamDetailOrFallback(teamId, teamDetails)))
    .join(", ");

  return (
    <div className="flex flex-wrap gap-1">
      {conflictHints?.courtOverlap ? (
        <span
          className="inline-flex shrink-0 items-center rounded-md border border-red-300 bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          title="Bane overlapper med en anden kamp på samme tid"
        >
          Bane-konflikt
        </span>
      ) : null}
      {showHardTeamRestViolation ? (
        <span
          className="inline-flex shrink-0 items-center rounded-md border border-red-300 bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-950 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100"
          title={
            violatingTeamNames
              ? `${violatingTeamNames} mangler pause (min. ${conflictHints!.teamRestMinutes} min)`
              : `Hold mangler pause (min. ${conflictHints!.teamRestMinutes} min)`
          }
        >
          Uden hold-pause
        </span>
      ) : null}
      {match.scheduledOutsidePoolPeriod ? <OutsidePoolPeriodBadge /> : null}
      {showRelaxedPauseBadge ? (
        <RelaxedRestScheduleHover
          match={match}
          allMatches={allMatches}
          teamDetails={teamDetails}
          levelTimingByLevel={levelTimingByLevel}
        />
      ) : null}
    </div>
  );
}

function MatchActionButtons({
  match,
  onManualSchedule,
  planningLockdown,
}: {
  match: KampprogramMatch;
  onManualSchedule?: (match: KampprogramMatch) => void;
  planningLockdown: boolean;
}) {
  if (match.isOrphan || !onManualSchedule) return null;

  const label = match.isScheduled ? "Rediger" : "Planlæg manuelt";
  const buttonClass = match.isScheduled
    ? "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800"
    : "inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/80 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/70";
  const lockedClass =
    "inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-400 opacity-60 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500";

  if (planningLockdown) {
    return (
      <button type="button" disabled className={lockedClass} title="Lockdown er aktiv — kampe kan ikke redigeres">
        <CalendarClock className="h-3 w-3" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onManualSchedule(match)} className={buttonClass}>
      <CalendarClock className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

function fmtTimeRange(start: string | null, end: string | null): string {
  const s = formatTimeForInput(start);
  const e = formatTimeForInput(end);
  if (s && e) return `${s}\u2011${e}`;
  if (s) return s;
  return "—";
}

type KampprogramCsvRow = {
  rowType: "match" | "idle" | "unscheduled";
  section: string;
  court: string;
  time: string;
  teamA: string;
  teamB: string;
  level: string;
  pool: string;
  period: string;
  status: string;
  segment: string;
};

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function matchStatusLabels(
  m: KampprogramMatch,
  allMatches: readonly KampprogramMatch[],
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>,
): string {
  const labels: string[] = [];
  const conflict = conflictHintsByMatchId.get(m.id);
  if (conflict?.courtOverlap) labels.push("Bane-konflikt");
  if (conflict?.teamRestViolation && !m.scheduleRelaxedTeamRest) labels.push("Uden hold-pause");
  if (m.scheduledOutsidePoolPeriod) labels.push("udenfor periode");
  if (matchHasCurrentPauseIssue(m, allMatches, levelTimingByLevel)) labels.push("Mangler pause");
  return labels.join(" | ") || "OK";
}

function formatKampprogramCsvTimestamps(downloadedAt: Date): { iso: string; local: string } {
  return {
    iso: downloadedAt.toISOString(),
    local: new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "medium" }).format(downloadedAt),
  };
}

/** Eksempel til UI — viser præcis format uden at opdatere ved hver render. */
const KAMPPROGRAM_CSV_TIMESTAMP_EXAMPLE = formatKampprogramCsvTimestamps(new Date("2026-05-27T14:30:00.000Z"));

function triggerCsvDownload(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Ensartet kolonnebredde på tværs af alle bane-/runde-tabeller (undgår hop ved scroll). */
function KampprogramTableColgroup({ showCourt }: { showCourt: boolean }) {
  return (
    <colgroup>
      {showCourt ? <col style={{ width: "11rem" }} /> : null}
      <col style={{ width: "6.75rem" }} />
      <col />
      <col style={{ width: "7.25rem" }} />
      <col style={{ width: "5.25rem" }} />
      <col style={{ width: "6.5rem" }} />
      <col style={{ width: "9.5rem" }} />
    </colgroup>
  );
}

function KampprogramTableHead({ showCourt }: { showCourt: boolean }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50/90 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
        {showCourt ? <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Bane</th> : null}
        <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Tid</th>
        <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Kamp</th>
        <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Niveau</th>
        <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Pulje</th>
        <th
          className="px-3 py-2.5 font-semibold uppercase tracking-wide"
          title="Puljens tildelte periode — ikke klokkeslæt"
        >
          Periode
        </th>
        <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Status</th>
      </tr>
    </thead>
  );
}

const kampprogramTimeCellClass =
  "whitespace-nowrap px-3 py-3 align-top tabular-nums text-[0.8125rem] leading-snug tracking-tight";
const kampprogramTableWrapClass =
  "overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700";
const kampprogramTableClass = "w-full min-w-[44rem] table-fixed text-sm";

function teamDetailOrFallback(
  teamId: string,
  teamDetails: Record<string, TeamDetailView>,
): TeamDetailView {
  return (
    teamDetails[teamId] ?? {
      teamName: "Ukendt hold",
      nickname: null,
      players: [],
      coaches: [],
    }
  );
}

function MatchTable({
  rows,
  showCourt,
  showManualSchedule,
  planningLockdown,
  allMatches,
  teamDetails,
  levelTimingByLevel,
  conflictHintsByMatchId,
  onOpenTeam,
  onManualSchedule,
}: {
  rows: KampprogramMatch[];
  showCourt: boolean;
  showManualSchedule?: boolean;
  planningLockdown: boolean;
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>;
  onOpenTeam: (teamId: string) => void;
  onManualSchedule?: (match: KampprogramMatch) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ingen kampe i dette udsnit.</p>;
  }
  return (
    <div className={kampprogramTableWrapClass}>
      <table className={kampprogramTableClass}>
        <KampprogramTableColgroup showCourt={Boolean(showCourt)} />
        <KampprogramTableHead showCourt={Boolean(showCourt)} />
        <tbody>
          {rows.map((m, index) => {
            const lv = getLevelVisualClasses(m.levelKey);
            const detailA = teamDetailOrFallback(m.teamAId, teamDetails);
            const detailB = teamDetailOrFallback(m.teamBId, teamDetails);
            const zebra =
              index % 2 === 0
                ? "bg-white dark:bg-gray-900/25"
                : "bg-gray-50/95 dark:bg-gray-800/40";
            return (
              <tr key={m.id} className={`border-b border-gray-100 last:border-0 dark:border-gray-800/80 ${zebra}`}>
                {showCourt ? (
                  <td className="px-3 py-3 align-top text-gray-900 dark:text-white">
                    {m.courtName ? (
                      <span className="block truncate font-medium" title={formatCourtWithVenue(m.courtName, m.venueName)}>
                        {formatCourtWithVenue(m.courtName, m.venueName)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className={`${kampprogramTimeCellClass} font-medium text-gray-700 dark:text-gray-200`}>
                  {fmtTimeRange(m.startTime, m.endTime)}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex min-w-0 items-center gap-x-1.5 gap-y-0.5">
                    <TeamNameWithHover
                      detail={detailA}
                      onOpenDetail={() => onOpenTeam(m.teamAId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                    <span
                      className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                      aria-hidden
                    >
                      Vs.
                    </span>
                    <TeamNameWithHover
                      detail={detailB}
                      onOpenDetail={() => onOpenTeam(m.teamBId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={`${lv.badge} whitespace-nowrap`} title={m.levelKey}>
                    {formatLevelShortLabel(m.levelKey)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-gray-600 dark:text-gray-300">{m.poolName}</td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                  {m.periodName ?? "—"}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-2">
                    <MatchStatusBadges
                      match={m}
                      allMatches={allMatches}
                      teamDetails={teamDetails}
                      levelTimingByLevel={levelTimingByLevel}
                      conflictHints={conflictHintsByMatchId.get(m.id)}
                    />
                    {showManualSchedule ? (
                      <MatchActionButtons
                        match={m}
                        onManualSchedule={onManualSchedule}
                        planningLockdown={planningLockdown}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KampprogramTimelineTable({
  rows,
  showCourt,
  showManualSchedule,
  planningLockdown,
  allMatches,
  teamDetails,
  levelTimingByLevel,
  conflictHintsByMatchId,
  onOpenTeam,
  onManualSchedule,
}: {
  rows: KampprogramTableRow[];
  showCourt: boolean;
  showManualSchedule?: boolean;
  planningLockdown: boolean;
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>;
  onOpenTeam: (teamId: string) => void;
  onManualSchedule?: (match: KampprogramMatch) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Ingen kampe planlagt på denne bane.</p>
    );
  }

  return (
    <div className={kampprogramTableWrapClass}>
      <table className={kampprogramTableClass}>
        <KampprogramTableColgroup showCourt={Boolean(showCourt)} />
        <KampprogramTableHead showCourt={Boolean(showCourt)} />
        <tbody>
          {rows.map((row, index) => {
            const zebra =
              index % 2 === 0
                ? "bg-white dark:bg-gray-900/25"
                : "bg-gray-50/95 dark:bg-gray-800/40";
            const trailingColSpan = 5;

            if (row.type === "idle") {
              return (
                <tr
                  key={`idle-${row.courtId}-${row.startTime}`}
                  className="border-b border-emerald-100/90 bg-emerald-50/70 last:border-0 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                >
                  {showCourt ? (
                    <td className="px-3 py-3 align-top text-emerald-800/80 dark:text-emerald-200/80">
                      <span className="block truncate" title={formatCourtWithVenue(row.courtName, row.venueName)}>
                        {formatCourtWithVenue(row.courtName, row.venueName)}
                      </span>
                    </td>
                  ) : null}
                  <td className={`${kampprogramTimeCellClass} text-emerald-800/80 dark:text-emerald-200/80`}>
                    {fmtTimeRange(row.startTime, row.endTime)}
                  </td>
                  <td
                    colSpan={trailingColSpan}
                    className="px-3 py-3 font-medium italic text-emerald-800/90 dark:text-emerald-200/90"
                  >
                    Ledig bane
                  </td>
                </tr>
              );
            }

            const m = row.match;
            const lv = getLevelVisualClasses(m.levelKey);
            const detailA = teamDetailOrFallback(m.teamAId, teamDetails);
            const detailB = teamDetailOrFallback(m.teamBId, teamDetails);
            const showActions =
              showManualSchedule &&
              (row.segmentLabel == null || row.segmentLabel.startsWith("1."));

            return (
              <tr
                key={`${m.id}-${row.slotStartTime}`}
                className={`border-b border-gray-100 last:border-0 dark:border-gray-800/80 ${zebra}`}
              >
                {showCourt ? (
                  <td className="px-3 py-3 align-top text-gray-900 dark:text-white">
                    {m.courtName ? (
                      <span className="block truncate font-medium" title={formatCourtWithVenue(m.courtName, m.venueName)}>
                        {formatCourtWithVenue(m.courtName, m.venueName)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className={`${kampprogramTimeCellClass} font-medium text-gray-700 dark:text-gray-200`}>
                  <span className="whitespace-nowrap">{fmtTimeRange(row.slotStartTime, row.slotEndTime)}</span>
                  {row.segmentLabel ? (
                    <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-teal-800 dark:text-teal-300">
                      {row.segmentLabel}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex min-w-0 items-center gap-x-1.5 gap-y-0.5">
                    <TeamNameWithHover
                      detail={detailA}
                      onOpenDetail={() => onOpenTeam(m.teamAId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                    <span
                      className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                      aria-hidden
                    >
                      Vs.
                    </span>
                    <TeamNameWithHover
                      detail={detailB}
                      onOpenDetail={() => onOpenTeam(m.teamBId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className={`${lv.badge} whitespace-nowrap`} title={m.levelKey}>
                    {formatLevelShortLabel(m.levelKey)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-gray-600 dark:text-gray-300">{m.poolName}</td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                  {m.periodName ?? "—"}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-2">
                    <MatchStatusBadges
                      match={m}
                      allMatches={allMatches}
                      teamDetails={teamDetails}
                      levelTimingByLevel={levelTimingByLevel}
                      conflictHints={conflictHintsByMatchId.get(m.id)}
                    />
                    {showActions ? (
                      <MatchActionButtons
                        match={m}
                        onManualSchedule={onManualSchedule}
                        planningLockdown={planningLockdown}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnscheduledSection({
  rows,
  allMatches,
  teamDetails,
  levelTimingByLevel,
  conflictHintsByMatchId,
  onOpenTeam,
  onManualSchedule,
  planningLockdown,
  id,
}: {
  rows: KampprogramMatch[];
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>;
  onOpenTeam: (teamId: string) => void;
  onManualSchedule: (match: KampprogramMatch) => void;
  planningLockdown: boolean;
  id?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-lg border border-amber-300 bg-amber-50/70 p-4 shadow-sm ring-1 ring-amber-200/80 dark:border-amber-800/60 dark:bg-amber-950/30 dark:ring-amber-900/40"
    >
      <h2 className="text-base font-semibold text-amber-950 dark:text-amber-50">Ikke planlagt</h2>
      <p className="mt-0.5 text-sm text-amber-900/90 dark:text-amber-100/90">
        {rows.length} kamp{rows.length === 1 ? "" : "e"} mangler bane eller tid — planlæg dem her, eller brug «Rediger» på
        en planlagt kamp og «Fjern planlægning» for at flytte den hertil.
      </p>
      <div className="mt-3">
        <MatchTable
          rows={rows}
          showCourt={false}
          showManualSchedule
          planningLockdown={planningLockdown}
          allMatches={allMatches}
          teamDetails={teamDetails}
          levelTimingByLevel={levelTimingByLevel}
          conflictHintsByMatchId={conflictHintsByMatchId}
          onOpenTeam={onOpenTeam}
          onManualSchedule={onManualSchedule}
        />
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">{value}</p>
    </div>
  );
}

export function KampprogramWorkspace({
  initial,
  initialMatchFilter = "all",
}: Props) {
  const router = useRouter();
  const { planningLockdown } = useKontrolcenterLockdown();
  const [view, setView] = useState<ViewMode>("court");
  const [levelFilter, setLevelFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [courtTypeFilter, setCourtTypeFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState<KampprogramMatchFilter>(initialMatchFilter);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [orphanActionMsg, setOrphanActionMsg] = useState<string | null>(null);
  const [manualScheduleMatch, setManualScheduleMatch] = useState<KampprogramMatch | null>(null);
  const [scheduleActionMsg, setScheduleActionMsg] = useState<string | null>(null);

  const teamDetails = initial.teamDetails;
  const orphanMatches = useMemo(() => initial.matches.filter((m) => m.isOrphan), [initial.matches]);
  const unscheduledValidCount = Math.max(0, initial.stats.unscheduled - initial.stats.orphanMatches);

  useEffect(() => {
    if (initialMatchFilter === "unscheduled" && unscheduledValidCount > 0) {
      document.getElementById("ikke-planlagt")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [initialMatchFilter, unscheduledValidCount]);

  useEffect(() => {
    if (planningLockdown) setManualScheduleMatch(null);
  }, [planningLockdown]);
  const conflictHintsByMatchId = useMemo(
    () => buildKampprogramMatchConflictHints(initial.matches, initial.levelTimingByLevel),
    [initial.matches, initial.levelTimingByLevel],
  );

  async function handleDeleteOrphans() {
    if (orphanMatches.length === 0) return;
    const ok = window.confirm(
      `Slet ${orphanMatches.length} forældreløse kampe? De kan ikke bruges (manglende pulje eller hold) og vises som «Ukendt hold».`,
    );
    if (!ok) return;
    setDeletingOrphans(true);
    setOrphanActionMsg(null);
    try {
      const result = await deleteOrphanMatchesAction();
      setOrphanActionMsg(result.message);
      if (result.ok) router.refresh();
    } catch (e) {
      setOrphanActionMsg(e instanceof Error ? e.message : "Kunne ikke slette.");
    } finally {
      setDeletingOrphans(false);
    }
  }

  const sortByDisplayName = useCallback(
    (aId: string, bId: string) =>
      kontrolCenterTeamDisplayName(teamDetailOrFallback(aId, teamDetails)).localeCompare(
        kontrolCenterTeamDisplayName(teamDetailOrFallback(bId, teamDetails)),
        "da",
      ),
    [teamDetails],
  );

  const courtTypeByCourtId = useMemo(
    () => new Map(initial.courts.map((c) => [c.id, c.courtType])),
    [initial.courts],
  );

  const courtTypeOptions = useMemo(() => {
    const types = new Set(initial.courts.map((c) => c.courtType));
    return [...types].sort(compareCourtTypes);
  }, [initial.courts]);

  const matchPassesCourtTypeFilter = useCallback(
    (m: KampprogramMatch): boolean => {
      if (!courtTypeFilter) return true;
      if (m.isScheduled && m.courtId) {
        return courtTypeByCourtId.get(m.courtId) === courtTypeFilter;
      }
      return initial.levelCourtTypeByLevel[m.levelKey] === courtTypeFilter;
    },
    [courtTypeByCourtId, courtTypeFilter, initial.levelCourtTypeByLevel],
  );

  const filtered = useMemo(() => {
    return initial.matches.filter((m) => {
      if (m.isOrphan) return false;
      if (matchFilter === "unscheduled" && m.isScheduled) return false;
      if (matchFilter === "outside-period" && !m.scheduledOutsidePoolPeriod) return false;
      if (
        matchFilter === "missing-team-rest" &&
        !matchHasPauseIssue(m, initial.matches, initial.levelTimingByLevel, conflictHintsByMatchId)
      ) {
        return false;
      }
      if (levelFilter && m.levelKey !== levelFilter) return false;
      if (periodFilter && m.periodName !== periodFilter) return false;
      if (!matchPassesCourtTypeFilter(m)) return false;
      return true;
    });
  }, [
    initial.matches,
    matchFilter,
    levelFilter,
    periodFilter,
    matchPassesCourtTypeFilter,
    conflictHintsByMatchId,
  ]);

  const byCourt = useMemo(() => {
    const map = new Map<string, KampprogramMatch[]>();
    for (const court of initial.courts) map.set(court.id, []);

    for (const m of filtered) {
      if (!m.isScheduled || !m.courtId) continue;
      const list = map.get(m.courtId);
      if (list) list.push(m);
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = formatTimeForInput(a.startTime) ?? "";
        const tb = formatTimeForInput(b.startTime) ?? "";
        return ta.localeCompare(tb, "da") || sortByDisplayName(a.teamAId, b.teamAId);
      });
    }

    return map;
  }, [filtered, initial.courts, sortByDisplayName]);

  const courtsForView = useMemo(() => {
    if (!courtTypeFilter) return initial.courts;
    return initial.courts.filter((c) => c.courtType === courtTypeFilter);
  }, [initial.courts, courtTypeFilter]);

  const roundGroups = useMemo(
    () =>
      groupKampprogramByRound(
        filtered,
        initial.levelTimingByLevel,
        courtsForView,
        initial.courtAvailabilityByCourtId,
        sortByDisplayName,
      ),
    [
      filtered,
      initial.levelTimingByLevel,
      courtsForView,
      initial.courtAvailabilityByCourtId,
      sortByDisplayName,
    ],
  );

  const courtTimelines = useMemo(() => {
    return courtsForView.map((court) => {
      const matches = byCourt.get(court.id) ?? [];
      const rows = buildCourtTimelineRows(court, matches, initial.levelTimingByLevel);
      const idleCount = rows.filter((r) => r.type === "idle").length;
      return { court, matches, rows, idleCount };
    });
  }, [courtsForView, initial.levelTimingByLevel, byCourt]);

  const displayedCourtTimelines = useMemo(() => {
    if (courtTypeFilter || matchFilter === "missing-team-rest" || matchFilter === "outside-period") {
      return courtTimelines.filter((t) => t.matches.length > 0);
    }
    return courtTimelines;
  }, [courtTimelines, courtTypeFilter, matchFilter]);

  const unscheduledFiltered = useMemo(() => filtered.filter((m) => !m.isScheduled), [filtered]);

  const unscheduledNavCount = useMemo(() => {
    return initial.matches.filter((m) => {
      if (m.isOrphan || m.isScheduled) return false;
      if (levelFilter && m.levelKey !== levelFilter) return false;
      if (periodFilter && m.periodName !== periodFilter) return false;
      if (!matchPassesCourtTypeFilter(m)) return false;
      return true;
    }).length;
  }, [initial.matches, levelFilter, periodFilter, matchPassesCourtTypeFilter]);

  const scrollToUnplanned = useCallback(() => {
    if (matchFilter === "outside-period" || matchFilter === "missing-team-rest") {
      setMatchFilter("all");
    }
    window.setTimeout(() => {
      document.getElementById("ikke-planlagt")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [matchFilter]);

  const previewDetail = useMemo(() => {
    if (!previewTeamId) return null;
    const detail = teamDetails[previewTeamId];
    if (!detail) return null;
    return { ...detail, playerCount: detail.players.length };
  }, [previewTeamId, teamDetails]);

  const fieldClass =
    "rounded-md border border-lc-border bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100";

  const showUnscheduledSection =
    unscheduledFiltered.length > 0 &&
    matchFilter !== "outside-period" &&
    matchFilter !== "missing-team-rest";
  const showScheduledSections = matchFilter !== "unscheduled";

  const csvRows = useMemo((): KampprogramCsvRow[] => {
    const rows: KampprogramCsvRow[] = [];

    if (showScheduledSections && view === "court") {
      for (const timeline of displayedCourtTimelines) {
        for (const row of timeline.rows) {
          if (row.type === "idle") {
            rows.push({
              rowType: "idle",
              section: timeline.court.name,
              court: formatCourtWithVenue(row.courtName, row.venueName),
              time: fmtTimeRange(row.startTime, row.endTime),
              teamA: "",
              teamB: "",
              level: "",
              pool: "",
              period: "",
              status: "Ledig bane",
              segment: "",
            });
            continue;
          }
          const m = row.match;
          rows.push({
            rowType: "match",
            section: timeline.court.name,
            court: m.courtName ? formatCourtWithVenue(m.courtName, m.venueName) : "—",
            time: fmtTimeRange(row.slotStartTime, row.slotEndTime),
            teamA: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamAId, teamDetails)),
            teamB: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamBId, teamDetails)),
            level: m.levelKey,
            pool: m.poolName,
            period: m.periodName ?? "—",
            status: matchStatusLabels(m, initial.matches, initial.levelTimingByLevel, conflictHintsByMatchId),
            segment: row.segmentLabel ?? "",
          });
        }
      }
    }

    if (showScheduledSections && view === "rounds") {
      for (const round of roundGroups) {
        for (const row of round.rows) {
          if (row.type === "idle") {
            rows.push({
              rowType: "idle",
              section: round.label,
              court: formatCourtWithVenue(row.courtName, row.venueName),
              time: fmtTimeRange(row.startTime, row.endTime),
              teamA: "",
              teamB: "",
              level: "",
              pool: "",
              period: "",
              status: "Ledig bane",
              segment: "",
            });
            continue;
          }
          const m = row.match;
          rows.push({
            rowType: "match",
            section: round.label,
            court: m.courtName ? formatCourtWithVenue(m.courtName, m.venueName) : "—",
            time: fmtTimeRange(row.slotStartTime, row.slotEndTime),
            teamA: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamAId, teamDetails)),
            teamB: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamBId, teamDetails)),
            level: m.levelKey,
            pool: m.poolName,
            period: m.periodName ?? "—",
            status: matchStatusLabels(m, initial.matches, initial.levelTimingByLevel, conflictHintsByMatchId),
            segment: row.segmentLabel ?? "",
          });
        }
      }
    }

    if (showUnscheduledSection) {
      for (const m of unscheduledFiltered) {
        rows.push({
          rowType: "unscheduled",
          section: "Ikke planlagt",
          court: "—",
          time: fmtTimeRange(m.startTime, m.endTime),
          teamA: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamAId, teamDetails)),
          teamB: kontrolCenterTeamDisplayName(teamDetailOrFallback(m.teamBId, teamDetails)),
          level: m.levelKey,
          pool: m.poolName,
          period: m.periodName ?? "—",
          status: matchStatusLabels(m, initial.matches, initial.levelTimingByLevel, conflictHintsByMatchId),
          segment: "",
        });
      }
    }

    return rows;
  }, [
    showScheduledSections,
    view,
    displayedCourtTimelines,
    teamDetails,
    initial.matches,
    initial.levelTimingByLevel,
    conflictHintsByMatchId,
    roundGroups,
    showUnscheduledSection,
    unscheduledFiltered,
  ]);

  const downloadCsv = useCallback(() => {
    const { iso: downloadedAtIso, local: downloadedAtLocal } = formatKampprogramCsvTimestamps(new Date());
    const activeViewLabel = view === "court" ? "per-bane" : "kronologisk";
    const headers = [
      "downloaded_at_iso",
      "downloaded_at_local",
      "active_view",
      "row_type",
      "section",
      "court",
      "time",
      "team_a",
      "team_b",
      "level",
      "pool",
      "period",
      "status",
      "segment",
    ];
    const lines = [headers.join(",")];
    for (const row of csvRows) {
      const cells = [
        downloadedAtIso,
        downloadedAtLocal,
        activeViewLabel,
        row.rowType,
        row.section,
        row.court,
        row.time,
        row.teamA,
        row.teamB,
        row.level,
        row.pool,
        row.period,
        row.status,
        row.segment,
      ].map(csvEscape);
      lines.push(cells.join(","));
    }

    const stamp = downloadedAtIso.replaceAll(":", "-").replace(".", "-");
    const filename = `kampprogram-${activeViewLabel}-${stamp}.csv`;
    triggerCsvDownload(filename, lines.join("\n"));
  }, [csvRows, view]);

  return (
    <div className="space-y-8">
      <div
        className={`grid gap-4 ${
          initial.stats.orphanMatches > 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <Kpi label="Kampe i alt" value={initial.stats.total} />
        <Kpi label="Planlagt" value={initial.stats.scheduled} />
        <Kpi label="Mangler bane/tid" value={unscheduledValidCount} />
        {initial.stats.orphanMatches > 0 ? (
          <Kpi label="Forældreløse" value={initial.stats.orphanMatches} />
        ) : null}
      </div>

      {unscheduledNavCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={scrollToUnplanned}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/60"
          >
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            {unscheduledNavCount} kamp{unscheduledNavCount === 1 ? "" : "e"} mangler planlægning — gå til uplanlagte
            kampe
          </button>
        </div>
      ) : null}

      {initial.stats.orphanMatches > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/25">
          <h2 className="text-base font-semibold text-red-900 dark:text-red-100">Forældreløse kampe</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-red-900/90 dark:text-red-100/90">
            {initial.stats.orphanMatches} kampe peger på en pulje eller hold, der ikke findes længere — typisk fordi
            puljen blev slettet, hold blev flyttet, eller kampe blev genereret før puljen blev ryddet op. De vises som
            «Ukendt hold» og kan ikke planlægges. Du kan slette dem herunder; gyldige kampe påvirkes ikke.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDeleteOrphans()}
              disabled={deletingOrphans || planningLockdown}
              title={planningLockdown ? "Lockdown er aktiv — kampe kan ikke slettes" : undefined}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
            >
              {deletingOrphans ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Slet {initial.stats.orphanMatches} forældreløse kampe
            </button>
            {orphanActionMsg ? (
              <p className="text-sm text-red-800 dark:text-red-200">{orphanActionMsg}</p>
            ) : null}
          </div>
          <div className="mt-4 max-h-64 overflow-auto rounded-md border border-red-200/80 dark:border-red-900/40">
            <MatchTable
              rows={orphanMatches}
              showCourt={false}
              planningLockdown={planningLockdown}
              allMatches={initial.matches}
              teamDetails={teamDetails}
              levelTimingByLevel={initial.levelTimingByLevel}
              conflictHintsByMatchId={conflictHintsByMatchId}
              onOpenTeam={setPreviewTeamId}
            />
          </div>
        </section>
      ) : null}


      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="inline-flex rounded-lg border border-lc-border bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={() => setView("court")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              view === "court"
                ? "bg-white text-[#0f766e] shadow-sm dark:bg-gray-900 dark:text-teal-200"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Per bane
          </button>
          <button
            type="button"
            onClick={() => setView("rounds")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              view === "rounds"
                ? "bg-white text-[#0f766e] shadow-sm dark:bg-gray-900 dark:text-teal-200"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Kronologisk (runder)
          </button>
        </div>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Niveau
          <StyledSelect value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className={fieldClass}>
            <option value="">Alle niveauer</option>
            {initial.levels.map((l) => (
              <option key={l} value={l}>
                {formatLevelShortLabel(l)}
              </option>
            ))}
          </StyledSelect>
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Periode
          <StyledSelect value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className={fieldClass}>
            <option value="">Alle perioder</option>
            {initial.periods.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </StyledSelect>
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Banestørrelse
          <StyledSelect
            value={courtTypeFilter}
            onChange={(e) => setCourtTypeFilter(e.target.value)}
            className={fieldClass}
          >
            <option value="">Alle banestørrelser</option>
            {courtTypeOptions.map((ct) => (
              <option key={ct} value={ct}>
                {courtTypeLabel(ct)}
              </option>
            ))}
          </StyledSelect>
        </label>

        <label className="flex min-w-[12rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Vis kampe
          <StyledSelect
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value as KampprogramMatchFilter)}
            className={fieldClass}
          >
            <option value="all">Alle kampe</option>
            <option value="unscheduled">Kun mangler bane/tid</option>
            <option value="missing-team-rest">Mangler pause</option>
            <option value="outside-period">Udenfor periode</option>
          </StyledSelect>
        </label>

        <div className="flex min-w-[14rem] flex-col gap-1.5">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={csvRows.length === 0}
            className="inline-flex h-[42px] items-center justify-center gap-2 rounded-md border border-lc-border bg-white px-3.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download CSV ({csvRows.length})
          </button>
          <p className="max-w-xs text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            Hver række får{" "}
            <span className="font-mono text-[10px] text-gray-600 dark:text-gray-300">downloaded_at_iso</span> (UTC, fx{" "}
            {KAMPPROGRAM_CSV_TIMESTAMP_EXAMPLE.iso}) og{" "}
            <span className="font-mono text-[10px] text-gray-600 dark:text-gray-300">downloaded_at_local</span> (da-DK,
            fx {KAMPPROGRAM_CSV_TIMESTAMP_EXAMPLE.local}) — tidsstempel sættes ved download.
          </p>
        </div>
      </div>

      {initial.stats.total === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Ingen kampe endnu</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Generér kampe under Turneringsplan for hvert niveau. De vises her, når de er oprettet.
          </p>
        </div>
      ) : view === "court" ? (
        <div className="space-y-6">
          {showScheduledSections
            ? displayedCourtTimelines.map(({ court, matches, rows, idleCount }) => (
              <section
                key={court.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  <span>{court.name}</span>
                  {court.venueName ? (
                    <span className="font-normal text-gray-500 dark:text-gray-400"> · {court.venueName}</span>
                  ) : null}
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {courtTypeLabel(court.courtType)}
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {matches.length === 0
                    ? "Ingen kampe planlagt"
                    : `${matches.length} kamp${matches.length === 1 ? "" : "e"}${idleCount > 0 ? ` · ${idleCount} ledig${idleCount === 1 ? "" : "e"} interval${idleCount === 1 ? "" : "er"}` : ""}`}
                </p>
                <div className="mt-3">
                  <KampprogramTimelineTable
                    rows={rows}
                    showCourt={false}
                    showManualSchedule
                    planningLockdown={planningLockdown}
                    allMatches={initial.matches}
                    teamDetails={teamDetails}
                    levelTimingByLevel={initial.levelTimingByLevel}
                    conflictHintsByMatchId={conflictHintsByMatchId}
                    onOpenTeam={setPreviewTeamId}
                    onManualSchedule={setManualScheduleMatch}
                  />
                </div>
              </section>
            ))
            : null}
          {filtered.length === 0 && (matchFilter !== "all" || levelFilter || periodFilter || courtTypeFilter) ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ingen kampe matcher filtrene.</p>
          ) : null}
          {courtTypeFilter && showScheduledSections && displayedCourtTimelines.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingen baner med størrelsen {courtTypeLabel(courtTypeFilter as CourtType)}.
            </p>
          ) : null}
          {showUnscheduledSection ? (
            <UnscheduledSection
              id="ikke-planlagt"
              rows={unscheduledFiltered}
              planningLockdown={planningLockdown}
              allMatches={initial.matches}
              teamDetails={teamDetails}
              levelTimingByLevel={initial.levelTimingByLevel}
              conflictHintsByMatchId={conflictHintsByMatchId}
              onOpenTeam={setPreviewTeamId}
              onManualSchedule={setManualScheduleMatch}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {showScheduledSections && roundGroups.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {matchFilter === "outside-period"
                ? "Ingen kampe uden for pulje-perioden matcher filtrene."
                : matchFilter === "missing-team-rest"
                  ? "Ingen kampe med pause-problemer matcher filtrene."
                  : "Ingen planlagte kampe matcher filtrene."}
            </p>
          ) : showScheduledSections ? (
            roundGroups.map((round) => {
              const matchRows = round.rows.filter((r) => r.type === "match");
              const idleCourts = round.rows.filter((r) => r.type === "idle").length;
              return (
                <section
                  key={round.startTime}
                  className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
                >
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{round.label}</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {round.timeLabel} · {matchRows.length} kamp{matchRows.length === 1 ? "" : "e"} samtidig på tværs
                    af baner
                    {idleCourts > 0
                      ? ` · ${idleCourts} ledig${idleCourts === 1 ? "" : "e"} bane${idleCourts === 1 ? "" : "r"}`
                      : ""}
                  </p>
                  <div className="mt-3">
                    <KampprogramTimelineTable
                      rows={round.rows}
                      showCourt
                      showManualSchedule
                      planningLockdown={planningLockdown}
                      allMatches={initial.matches}
                      teamDetails={teamDetails}
                      levelTimingByLevel={initial.levelTimingByLevel}
                      conflictHintsByMatchId={conflictHintsByMatchId}
                      onOpenTeam={setPreviewTeamId}
                      onManualSchedule={setManualScheduleMatch}
                    />
                  </div>
                </section>
              );
            })
          ) : null}
          {showUnscheduledSection ? (
            <UnscheduledSection
              id="ikke-planlagt"
              rows={unscheduledFiltered}
              planningLockdown={planningLockdown}
              allMatches={initial.matches}
              teamDetails={teamDetails}
              levelTimingByLevel={initial.levelTimingByLevel}
              conflictHintsByMatchId={conflictHintsByMatchId}
              onOpenTeam={setPreviewTeamId}
              onManualSchedule={setManualScheduleMatch}
            />
          ) : null}
        </div>
      )}

      <TeamDetailModal
        open={Boolean(previewDetail)}
        onClose={() => setPreviewTeamId(null)}
        detail={previewDetail ?? { teamName: "", nickname: null, players: [], coaches: [] }}
        playerCount={previewDetail?.playerCount ?? 0}
      />

      {manualScheduleMatch && !planningLockdown ? (
        <ManualScheduleDialog
          key={manualScheduleMatch.id}
          open
          onClose={() => setManualScheduleMatch(null)}
          matchId={manualScheduleMatch.id}
          levelKey={manualScheduleMatch.levelKey}
          isScheduled={manualScheduleMatch.isScheduled}
          currentSchedule={
            manualScheduleMatch.isScheduled &&
            manualScheduleMatch.startTime &&
            manualScheduleMatch.endTime
              ? {
                  timeLabel: fmtTimeRange(
                    manualScheduleMatch.startTime,
                    manualScheduleMatch.endTime,
                  ),
                  courtLabel: formatCourtWithVenue(
                    manualScheduleMatch.courtName ?? "Bane",
                    manualScheduleMatch.venueName,
                  ),
                }
              : null
          }
          teamALabel={kontrolCenterTeamDisplayName(
            teamDetailOrFallback(manualScheduleMatch.teamAId, teamDetails),
          )}
          teamBLabel={kontrolCenterTeamDisplayName(
            teamDetailOrFallback(manualScheduleMatch.teamBId, teamDetails),
          )}
          onSuccess={(msg) => setScheduleActionMsg(msg)}
          onRescheduleMatch={(id) => {
            const next = initial.matches.find((m) => m.id === id && !m.isOrphan);
            if (next) setManualScheduleMatch(next);
          }}
        />
      ) : null}

      {scheduleActionMsg ? (
        <p className="fixed bottom-4 right-4 z-[110] rounded-lg border border-teal-200 bg-white px-4 py-2 text-sm text-teal-900 shadow-lg dark:border-teal-800 dark:bg-gray-900 dark:text-teal-200">
          {scheduleActionMsg}
        </p>
      ) : null}
    </div>
  );
}
