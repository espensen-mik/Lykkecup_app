import { formatTimeForInput, timeToMinutes } from "@/lib/baner-tider";
import {
  formatCourtWithVenue,
  resolveKampprogramLevelTiming,
  type KampprogramLevelTiming,
  type KampprogramMatch,
} from "@/lib/kampprogram";
import { kontrolCenterTeamDisplayName, type TeamDetailView } from "@/lib/team-detail";
import { teamRestMinutesBetweenMatches } from "@/lib/turnering-scheduler";

export type TeamScheduleLine = {
  matchId: string;
  timeLabel: string;
  opponentLabel: string;
  courtLabel: string;
  isCurrentMatch: boolean;
  gapBeforeMinutes: number | null;
  gapTooShort: boolean;
  minRestMinutes: number;
};

export type TeamScheduleBlock = {
  teamId: string;
  teamLabel: string;
  lines: TeamScheduleLine[];
};

function fmtTimeRange(start: string | null, end: string | null): string {
  const s = formatTimeForInput(start);
  const e = formatTimeForInput(end);
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return "—";
}

function teamLabel(teamId: string, teamDetails: Record<string, TeamDetailView>): string {
  const detail = teamDetails[teamId];
  return detail ? kontrolCenterTeamDisplayName(detail) : "Ukendt hold";
}

export function buildTeamScheduleLines(
  allMatches: readonly KampprogramMatch[],
  teamId: string,
  focusMatchId: string,
  teamDetails: Record<string, TeamDetailView>,
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): TeamScheduleLine[] {
  const scheduled = allMatches
    .filter(
      (m) =>
        !m.isOrphan &&
        m.isScheduled &&
        m.startTime &&
        m.endTime &&
        (m.teamAId === teamId || m.teamBId === teamId),
    )
    .sort((a, b) => {
      const ta = timeToMinutes(a.startTime) ?? 0;
      const tb = timeToMinutes(b.startTime) ?? 0;
      return ta - tb || a.id.localeCompare(b.id);
    });

  const lines: TeamScheduleLine[] = [];
  let prevEnd: number | null = null;

  for (const m of scheduled) {
    const start = timeToMinutes(m.startTime);
    const end = timeToMinutes(m.endTime);
    const opponentId = m.teamAId === teamId ? m.teamBId : m.teamAId;
    const timing = resolveKampprogramLevelTiming(m.levelKey, levelTimingByLevel);
    const minRestMinutes = teamRestMinutesBetweenMatches(timing.roundLengthMinutes);

    let gapBeforeMinutes: number | null = null;
    let gapTooShort = false;
    if (prevEnd != null && start != null) {
      gapBeforeMinutes = start - prevEnd;
      gapTooShort = gapBeforeMinutes < minRestMinutes;
    }
    if (end != null) prevEnd = end;

    const courtLabel = m.courtName
      ? formatCourtWithVenue(m.courtName, m.venueName)
      : "—";

    lines.push({
      matchId: m.id,
      timeLabel: fmtTimeRange(m.startTime, m.endTime),
      opponentLabel: teamLabel(opponentId, teamDetails),
      courtLabel,
      isCurrentMatch: m.id === focusMatchId,
      gapBeforeMinutes,
      gapTooShort,
      minRestMinutes,
    });
  }

  return lines;
}

/** True when at least one hold on kampen har for kort pause før denne kamp lige nu. */
export function matchHasCurrentPauseIssue(
  match: KampprogramMatch,
  allMatches: readonly KampprogramMatch[],
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): boolean {
  if (match.isOrphan || !match.isScheduled) return false;

  for (const teamId of [match.teamAId, match.teamBId]) {
    const lines = buildTeamScheduleLines(allMatches, teamId, match.id, {}, levelTimingByLevel);
    const line = lines.find((l) => l.matchId === match.id);
    if (line?.gapTooShort) return true;
  }
  return false;
}

export function buildRelaxedRestScheduleBlocks(
  match: KampprogramMatch,
  allMatches: readonly KampprogramMatch[],
  teamDetails: Record<string, TeamDetailView>,
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): TeamScheduleBlock[] {
  return [
    {
      teamId: match.teamAId,
      teamLabel: teamLabel(match.teamAId, teamDetails),
      lines: buildTeamScheduleLines(
        allMatches,
        match.teamAId,
        match.id,
        teamDetails,
        levelTimingByLevel,
      ),
    },
    {
      teamId: match.teamBId,
      teamLabel: teamLabel(match.teamBId, teamDetails),
      lines: buildTeamScheduleLines(
        allMatches,
        match.teamBId,
        match.id,
        teamDetails,
        levelTimingByLevel,
      ),
    },
  ];
}
