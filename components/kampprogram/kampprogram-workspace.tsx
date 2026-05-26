"use client";

import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TeamDetailModal, TeamNameWithHover } from "@/components/teams/team-detail-ui";
import { StyledSelect } from "@/components/ui/styled-select";
import { deleteOrphanMatchesAction } from "@/lib/kampprogram-actions";
import { compareCourtNamesForSchedule, formatTimeForInput, timeToMinutes } from "@/lib/baner-tider";
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
import { kontrolCenterTeamDisplayName, type TeamDetailView } from "@/lib/team-detail";
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
    if (!courtOverlap && !teamRestViolation && !m.scheduledOutsidePoolPeriod && !m.scheduleRelaxedTeamRest) {
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
    <span className="inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
      Uden for pulje-periode
    </span>
  );
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

  const hasBadges =
    match.scheduledOutsidePoolPeriod ||
    match.scheduleRelaxedTeamRest ||
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
      {match.scheduleRelaxedTeamRest ? (
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
}: {
  match: KampprogramMatch;
  onManualSchedule?: (match: KampprogramMatch) => void;
}) {
  if (match.isOrphan || !onManualSchedule) return null;

  const label = match.isScheduled ? "Rediger" : "Planlæg manuelt";
  const buttonClass = match.isScheduled
    ? "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800"
    : "inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/80 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/70";

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
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return "—";
}

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
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/90 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
            {showCourt ? <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Bane</th> : null}
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Tid</th>
            <th className="min-w-[14rem] px-3 py-2.5 font-semibold uppercase tracking-wide">Kamp</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Niveau</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Pulje</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide" title="Puljens tildelte periode — ikke klokkeslæt">
              Periode
            </th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Status</th>
            {showManualSchedule ? (
              <th className="w-40 px-3 py-2.5 font-semibold uppercase tracking-wide" />
            ) : null}
          </tr>
        </thead>
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
                  <td className="px-3 py-3 text-gray-900 dark:text-white">
                    {m.courtName ? (
                      <span className="font-medium">{formatCourtWithVenue(m.courtName, m.venueName)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-3 tabular-nums font-medium text-gray-700 dark:text-gray-200">
                  {fmtTimeRange(m.startTime, m.endTime)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 max-w-[22rem] flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:flex-nowrap">
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
                <td className="px-3 py-3">
                  <span className={lv.badge} title={m.levelKey}>
                    {formatLevelShortLabel(m.levelKey)}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.poolName}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.periodName ?? "—"}</td>
                <td className="px-3 py-3">
                  <MatchStatusBadges
                    match={m}
                    allMatches={allMatches}
                    teamDetails={teamDetails}
                    levelTimingByLevel={levelTimingByLevel}
                    conflictHints={conflictHintsByMatchId.get(m.id)}
                  />
                </td>
                {showManualSchedule ? (
                  <td className="px-3 py-3">
                    <MatchActionButtons match={m} onManualSchedule={onManualSchedule} />
                  </td>
                ) : null}
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
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/90 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
            {showCourt ? <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Bane</th> : null}
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Tid</th>
            <th className="min-w-[14rem] px-3 py-2.5 font-semibold uppercase tracking-wide">Kamp</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Niveau</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Pulje</th>
            <th
              className="px-3 py-2.5 font-semibold uppercase tracking-wide"
              title="Puljens tildelte periode — ikke klokkeslæt"
            >
              Periode
            </th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Status</th>
            {showManualSchedule ? (
              <th className="w-40 px-3 py-2.5 font-semibold uppercase tracking-wide" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const zebra =
              index % 2 === 0
                ? "bg-white dark:bg-gray-900/25"
                : "bg-gray-50/95 dark:bg-gray-800/40";
            const actionColSpan = (showCourt ? 1 : 0) + (showManualSchedule ? 1 : 0) + 5;

            if (row.type === "idle") {
              return (
                <tr
                  key={`idle-${row.courtId}-${row.startTime}`}
                  className={`border-b border-gray-100 last:border-0 dark:border-gray-800/80 ${zebra}`}
                >
                  {showCourt ? (
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                      {formatCourtWithVenue(row.courtName, row.venueName)}
                    </td>
                  ) : null}
                  <td className="px-3 py-3 tabular-nums text-gray-500 dark:text-gray-400">
                    {fmtTimeRange(row.startTime, row.endTime)}
                  </td>
                  <td colSpan={actionColSpan} className="px-3 py-3 italic text-gray-500 dark:text-gray-400">
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
                  <td className="px-3 py-3 text-gray-900 dark:text-white">
                    {m.courtName ? (
                      <span className="font-medium">{formatCourtWithVenue(m.courtName, m.venueName)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-3 tabular-nums font-medium text-gray-700 dark:text-gray-200">
                  <span>{fmtTimeRange(row.slotStartTime, row.slotEndTime)}</span>
                  {row.segmentLabel ? (
                    <span className="mt-0.5 block text-xs font-medium text-teal-800 dark:text-teal-300">
                      {row.segmentLabel}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 max-w-[22rem] flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:flex-nowrap">
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
                <td className="px-3 py-3">
                  <span className={lv.badge} title={m.levelKey}>
                    {formatLevelShortLabel(m.levelKey)}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.poolName}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.periodName ?? "—"}</td>
                <td className="px-3 py-3">
                  <MatchStatusBadges
                    match={m}
                    allMatches={allMatches}
                    teamDetails={teamDetails}
                    levelTimingByLevel={levelTimingByLevel}
                    conflictHints={conflictHintsByMatchId.get(m.id)}
                  />
                </td>
                {showManualSchedule ? (
                  <td className="px-3 py-3">
                    {showActions ? <MatchActionButtons match={m} onManualSchedule={onManualSchedule} /> : null}
                  </td>
                ) : null}
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
  id,
}: {
  rows: KampprogramMatch[];
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
  conflictHintsByMatchId: ReadonlyMap<string, KampprogramMatchConflictHints>;
  onOpenTeam: (teamId: string) => void;
  onManualSchedule: (match: KampprogramMatch) => void;
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
  const [view, setView] = useState<ViewMode>("court");
  const [levelFilter, setLevelFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
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

  const filtered = useMemo(() => {
    return initial.matches.filter((m) => {
      if (m.isOrphan) return false;
      if (matchFilter === "unscheduled" && m.isScheduled) return false;
      if (matchFilter === "outside-period" && !m.scheduledOutsidePoolPeriod) return false;
      if (levelFilter && m.levelKey !== levelFilter) return false;
      if (periodFilter && m.periodName !== periodFilter) return false;
      return true;
    });
  }, [initial.matches, matchFilter, levelFilter, periodFilter]);

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

  const roundGroups = useMemo(
    () =>
      groupKampprogramByRound(
        filtered,
        initial.levelTimingByLevel,
        initial.courts,
        initial.courtAvailabilityByCourtId,
        sortByDisplayName,
      ),
    [
      filtered,
      initial.levelTimingByLevel,
      initial.courts,
      initial.courtAvailabilityByCourtId,
      sortByDisplayName,
    ],
  );

  const courtTimelines = useMemo(() => {
    return initial.courts.map((court) => {
      const matches = byCourt.get(court.id) ?? [];
      const rows = buildCourtTimelineRows(court, matches, initial.levelTimingByLevel);
      const idleCount = rows.filter((r) => r.type === "idle").length;
      return { court, matches, rows, idleCount };
    });
  }, [initial.courts, initial.levelTimingByLevel, byCourt]);

  const unscheduledFiltered = useMemo(() => filtered.filter((m) => !m.isScheduled), [filtered]);

  const previewDetail = useMemo(() => {
    if (!previewTeamId) return null;
    const detail = teamDetails[previewTeamId];
    if (!detail) return null;
    return { ...detail, playerCount: detail.players.length };
  }, [previewTeamId, teamDetails]);

  const fieldClass =
    "rounded-md border border-lc-border bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100";

  const showUnscheduledSection =
    unscheduledFiltered.length > 0 && matchFilter !== "outside-period";
  const showScheduledSections = matchFilter !== "unscheduled";

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
              disabled={deletingOrphans}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
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

        <label className="flex min-w-[12rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Vis kampe
          <StyledSelect
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value as KampprogramMatchFilter)}
            className={fieldClass}
          >
            <option value="all">Alle kampe</option>
            <option value="unscheduled">Kun mangler bane/tid</option>
            <option value="outside-period">Uden for pulje-periode</option>
          </StyledSelect>
        </label>
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
            ? courtTimelines.map(({ court, matches, rows, idleCount }) => (
              <section
                key={court.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  <span>{court.name}</span>
                  {court.venueName ? (
                    <span className="font-normal text-gray-500 dark:text-gray-400"> · {court.venueName}</span>
                  ) : null}
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
          {matchFilter === "outside-period" && filtered.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingen kampe uden for pulje-perioden matcher filtrene.
            </p>
          ) : null}
          {showUnscheduledSection ? (
            <UnscheduledSection
              id="ikke-planlagt"
              rows={unscheduledFiltered}
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

      {manualScheduleMatch ? (
        <ManualScheduleDialog
          key={manualScheduleMatch.id}
          open
          onClose={() => setManualScheduleMatch(null)}
          matchId={manualScheduleMatch.id}
          levelKey={manualScheduleMatch.levelKey}
          isScheduled={manualScheduleMatch.isScheduled}
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
