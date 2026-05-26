import type { TeamDetailView } from "@/lib/team-detail";
import type { KampprogramSchedulingSummary } from "@/lib/scheduling-summary";
import {
  compareCourtNamesForSchedule,
  formatTimeForInput,
  minutesToTimeInput,
  timeInputToTimestamptz,
  timeToMinutes,
} from "@/lib/baner-tider";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { defaultRoundsPerMatchForLevel } from "@/lib/level-court-settings";
import {
  availabilityRowsToRegnemaskineAvailability,
  roundLengthMinutes,
  type RoundTiming,
} from "@/lib/lykkecup-regnemaskine";
import type { CourtAvailabilityRow } from "@/lib/baner-tider";

/** Client-safe types for kampprogram (ingen server-imports). */

export type KampprogramMatch = {
  id: string;
  poolId: string;
  teamAId: string;
  teamBId: string;
  /** Pulje eller hold findes ikke længere — typisk efter sletning i Puljer. */
  isOrphan: boolean;
  levelKey: string;
  poolName: string;
  /** Puljens tildelte turneringsperiode (ikke afledt af kampens starttid). */
  periodName: string | null;
  /** Kampens starttid ligger uden for pulje-periodens klokke-vindue. */
  scheduledOutsidePoolPeriod: boolean;
  courtId: string | null;
  courtName: string | null;
  venueName: string | null;
  startTime: string | null;
  endTime: string | null;
  roundIndex: number | null;
  isScheduled: boolean;
  /** Planlagt med lempet hold-pause (auto-scheduler). */
  scheduleRelaxedTeamRest: boolean;
};

export type KampprogramCourt = {
  id: string;
  name: string;
  venueName: string | null;
  sortOrder: number;
};

export type KampprogramCourtAvailabilityWindow = {
  startMinutes: number;
  endMinutes: number;
};

/** Spilletid pr. bane fra Haller & baner (tom = antages tilgængelig hele dagen). */
export type KampprogramCourtAvailabilityByCourtId = Record<
  string,
  readonly KampprogramCourtAvailabilityWindow[]
>;

export function buildKampprogramCourtAvailabilityByCourtId(
  rows: readonly Pick<CourtAvailabilityRow, "court_id" | "start_time" | "end_time">[],
): KampprogramCourtAvailabilityByCourtId {
  const out: Record<string, KampprogramCourtAvailabilityWindow[]> = {};
  const asRows = rows.map(
    (r) =>
      ({
        id: "",
        event_id: "",
        court_id: r.court_id,
        start_time: r.start_time,
        end_time: r.end_time,
      }) satisfies CourtAvailabilityRow,
  );
  for (const a of availabilityRowsToRegnemaskineAvailability(asRows)) {
    const list = out[a.courtId] ?? [];
    list.push({ startMinutes: a.startMinutes, endMinutes: a.endMinutes });
    out[a.courtId] = list;
  }
  return out;
}

/** Bane kan bruges i hele tidsrummet (som scheduleren kræver for en kamp). */
export function isCourtPlayableAtSlot(
  courtId: string,
  slotStartMinutes: number,
  slotEndMinutes: number,
  availabilityByCourtId: KampprogramCourtAvailabilityByCourtId,
): boolean {
  const windows = availabilityByCourtId[courtId];
  if (!windows || windows.length === 0) return true;
  return windows.some(
    (w) => w.startMinutes <= slotStartMinutes && w.endMinutes >= slotEndMinutes,
  );
}

function compareKampprogramRowByCourt(a: KampprogramTableRow, b: KampprogramTableRow): number {
  const pack = (row: KampprogramTableRow) =>
    row.type === "match"
      ? { name: row.match.courtName, venue: row.match.venueName }
      : { name: row.courtName, venue: row.venueName };
  const pa = pack(a);
  const pb = pack(b);
  const byVenue = (pa.venue ?? "").localeCompare(pb.venue ?? "", "da", { sensitivity: "base" });
  if (byVenue !== 0) return byVenue;
  return compareCourtNamesForSchedule(pa.name, pb.name);
}

function compareKampprogramCourts(a: KampprogramCourt, b: KampprogramCourt): number {
  const byVenue = (a.venueName ?? "").localeCompare(b.venueName ?? "", "da", { sensitivity: "base" });
  if (byVenue !== 0) return byVenue;
  return compareCourtNamesForSchedule(a.name, b.name) || a.sortOrder - b.sortOrder;
}

/** Kampe hvis pulje eller hold ikke findes længere (typisk efter sletning i Puljer). */
export function isOrphanKampprogramMatch(
  match: { teamAId: string; teamBId: string; poolId: string },
  teamIds: ReadonlySet<string>,
  poolIds: ReadonlySet<string>,
): boolean {
  return !poolIds.has(match.poolId) || !teamIds.has(match.teamAId) || !teamIds.has(match.teamBId);
}

/** Vis bane med hal/navn, fx «Bane 1 · Boxen». */
export function formatCourtWithVenue(courtName: string, venueName: string | null | undefined): string {
  const venue = venueName?.trim();
  if (venue) return `${courtName} · ${venue}`;
  return courtName;
}

export type KampprogramPeriod = {
  id: string;
  name: string;
};

export type KampprogramLevelTiming = {
  roundLengthMinutes: number;
  roundsPerMatch: number;
};

export type KampprogramTableRow =
  | {
      type: "match";
      match: KampprogramMatch;
      slotStartTime: string;
      slotEndTime: string;
      segmentLabel: string | null;
    }
  | {
      type: "idle";
      courtId: string;
      courtName: string;
      venueName: string | null;
      startTime: string;
      endTime: string;
    };

export type KampprogramRoundGroup = {
  roundNumber: number;
  /** Fx «Runde 1» — samme nummer på tværs af baner ved samme starttid. */
  label: string;
  startTime: string;
  timeLabel: string;
  rows: KampprogramTableRow[];
};

const DEFAULT_TIMING: KampprogramLevelTiming = {
  roundLengthMinutes: 10,
  roundsPerMatch: 1,
};

export function resolveKampprogramLevelTiming(
  levelKey: string,
  timingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): KampprogramLevelTiming {
  const canon = canonicalBanerLevelLabel(levelKey);
  const hit = timingByLevel[canon];
  if (hit && hit.roundLengthMinutes > 0) {
    return {
      roundLengthMinutes: hit.roundLengthMinutes,
      roundsPerMatch: Math.max(1, Math.min(4, Math.floor(hit.roundsPerMatch))),
    };
  }
  return {
    roundLengthMinutes: DEFAULT_TIMING.roundLengthMinutes,
    roundsPerMatch: defaultRoundsPerMatchForLevel(levelKey),
  };
}

export function buildLevelTimingByLevel(
  rows: readonly {
    level: string;
    match_duration_minutes: number | null;
    break_between_matches_minutes: number | null;
    rounds_per_match: number | null;
  }[],
): Record<string, KampprogramLevelTiming> {
  const out: Record<string, KampprogramLevelTiming> = {};
  for (const row of rows) {
    const canon = canonicalBanerLevelLabel(row.level);
    const timing: RoundTiming = {
      matchDurationMinutes: row.match_duration_minutes ?? 9,
      breakBetweenMatchesMinutes: row.break_between_matches_minutes ?? 1,
    };
    const roundLen = roundLengthMinutes(timing);
    const rpm = row.rounds_per_match;
    out[canon] = {
      roundLengthMinutes: roundLen > 0 ? roundLen : DEFAULT_TIMING.roundLengthMinutes,
      roundsPerMatch:
        rpm != null && Number.isFinite(rpm) && rpm >= 1
          ? Math.min(4, Math.floor(rpm))
          : defaultRoundsPerMatchForLevel(canon),
    };
  }
  return out;
}

function minutesToSlotIso(minutes: number): string | null {
  return timeInputToTimestamptz(minutesToTimeInput(minutes));
}

/** Én række pr. halvleg/runde når kampen bruger flere runder (fx ROCK). */
export function expandMatchToTableRows(
  match: KampprogramMatch,
  timing: KampprogramLevelTiming,
): KampprogramTableRow[] {
  if (!match.isScheduled || !match.startTime || !match.endTime) return [];

  const startMin = timeToMinutes(match.startTime);
  const endMin = timeToMinutes(match.endTime);
  if (startMin == null || endMin == null) {
    return [
      {
        type: "match",
        match,
        slotStartTime: match.startTime,
        slotEndTime: match.endTime,
        segmentLabel: null,
      },
    ];
  }

  const rpm = Math.max(1, Math.floor(timing.roundsPerMatch));
  const roundLen = timing.roundLengthMinutes;
  if (rpm <= 1 || roundLen <= 0) {
    return [
      {
        type: "match",
        match,
        slotStartTime: match.startTime,
        slotEndTime: match.endTime,
        segmentLabel: null,
      },
    ];
  }

  const rows: KampprogramTableRow[] = [];
  for (let i = 0; i < rpm; i++) {
    const segStart = startMin + i * roundLen;
    const segEnd = segStart + roundLen;
    if (segStart >= endMin) break;
    const slotStart = minutesToSlotIso(segStart) ?? match.startTime;
    const slotEnd = minutesToSlotIso(Math.min(segEnd, endMin)) ?? match.endTime;
    rows.push({
      type: "match",
      match,
      slotStartTime: slotStart,
      slotEndTime: slotEnd,
      segmentLabel: `${i + 1}. halvleg`,
    });
  }

  if (rows.length === 0) {
    return [
      {
        type: "match",
        match,
        slotStartTime: match.startTime,
        slotEndTime: match.endTime,
        segmentLabel: null,
      },
    ];
  }
  return rows;
}

/** Klokkeslæt-nøgle til runde-gruppering (undgår split pga. forskellige ISO-strenge for samme tid). */
function kampprogramSlotStartMinutes(t: string): number | null {
  return timeToMinutes(t);
}

function sortKampprogramRowsByCourt(rows: KampprogramTableRow[]): KampprogramTableRow[] {
  return [...rows].sort(compareKampprogramRowByCourt);
}

function roundSlotEndMinutes(
  matchRows: readonly KampprogramTableRow[],
  startMinutes: number,
): number {
  let maxEnd = startMinutes;
  for (const row of matchRows) {
    if (row.type !== "match") continue;
    const e = kampprogramSlotStartMinutes(row.slotEndTime);
    if (e != null) maxEnd = Math.max(maxEnd, e);
  }
  return maxEnd > startMinutes ? maxEnd : startMinutes + DEFAULT_TIMING.roundLengthMinutes;
}

function injectEmptyCourtsIntoRound(
  matchRows: KampprogramTableRow[],
  courts: readonly KampprogramCourt[],
  startMinutes: number,
  availabilityByCourtId: KampprogramCourtAvailabilityByCourtId,
): KampprogramTableRow[] {
  if (courts.length === 0) return matchRows;

  const busyCourtIds = new Set(
    matchRows
      .filter((r): r is Extract<KampprogramTableRow, { type: "match" }> => r.type === "match")
      .map((r) => r.match.courtId)
      .filter((id): id is string => Boolean(id)),
  );

  const slotEndMinutes = roundSlotEndMinutes(matchRows, startMinutes);
  const slotStart = minutesToSlotIso(startMinutes);
  const slotEnd = minutesToSlotIso(slotEndMinutes);
  if (!slotStart || !slotEnd) return matchRows;

  const idleRows: KampprogramTableRow[] = courts
    .filter((court) => !busyCourtIds.has(court.id))
    .filter((court) =>
      isCourtPlayableAtSlot(court.id, startMinutes, slotEndMinutes, availabilityByCourtId),
    )
    .map((court) => ({
      type: "idle" as const,
      courtId: court.id,
      courtName: court.name,
      venueName: court.venueName,
      startTime: slotStart,
      endTime: slotEnd,
    }));

  return sortKampprogramRowsByCourt([...matchRows, ...idleRows]);
}

function roundTimeLabelFromRows(rows: readonly KampprogramTableRow[]): string {
  let minStart: number | null = null;
  let maxEnd: number | null = null;
  for (const row of rows) {
    if (row.type !== "match") continue;
    const s = kampprogramSlotStartMinutes(row.slotStartTime);
    const e = kampprogramSlotStartMinutes(row.slotEndTime);
    if (s != null) minStart = minStart == null ? s : Math.min(minStart, s);
    if (e != null) maxEnd = maxEnd == null ? e : Math.max(maxEnd, e);
  }
  if (minStart == null) return "—";
  const start = formatTimeForInput(minutesToTimeInput(minStart));
  if (maxEnd == null || maxEnd <= minStart) return start;
  const end = formatTimeForInput(minutesToTimeInput(maxEnd));
  return start && end ? `${start}–${end}` : start;
}

/** Gruppér planlagte kampe i kronologiske runder (samme starttid = samme runde på tværs af baner). */
export function groupKampprogramByRound(
  matches: readonly KampprogramMatch[],
  timingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
  courts: readonly KampprogramCourt[],
  availabilityByCourtId: KampprogramCourtAvailabilityByCourtId,
  sortByTeamDisplayName?: (teamAId: string, teamBId: string) => number,
): KampprogramRoundGroup[] {
  const groups = new Map<number, KampprogramTableRow[]>();

  for (const m of matches) {
    if (!m.isScheduled || !m.startTime) continue;
    const timing = resolveKampprogramLevelTiming(m.levelKey, timingByLevel);
    for (const row of expandMatchToTableRows(m, timing)) {
      if (row.type !== "match") continue;
      const slotMin = kampprogramSlotStartMinutes(row.slotStartTime);
      if (slotMin == null) continue;
      const list = groups.get(slotMin) ?? [];
      list.push(row);
      groups.set(slotMin, list);
    }
  }

  const keys = [...groups.keys()].sort((a, b) => a - b);
  const teamSort =
    sortByTeamDisplayName ??
    ((a, b) => a.localeCompare(b, "da"));

  const courtsSorted = [...courts].sort(compareKampprogramCourts);

  return keys.map((startMinutes, index) => {
    const matchRows = [...(groups.get(startMinutes) ?? [])];
    matchRows.sort((a, b) => {
      if (a.type !== "match" || b.type !== "match") return 0;
      return compareKampprogramRowByCourt(a, b) || teamSort(a.match.teamAId, b.match.teamAId);
    });
    const roundRows = injectEmptyCourtsIntoRound(
      matchRows,
      courtsSorted,
      startMinutes,
      availabilityByCourtId,
    );
    const startTime = minutesToSlotIso(startMinutes) ?? minutesToTimeInput(startMinutes);
    return {
      roundNumber: index + 1,
      label: `Runde ${index + 1}`,
      startTime,
      timeLabel: roundTimeLabelFromRows(matchRows),
      rows: roundRows,
    };
  });
}

/** Kampe + ledige tidsrum på én bane (mellem kampe/halvlege). */
export function buildCourtTimelineRows(
  court: KampprogramCourt,
  matches: readonly KampprogramMatch[],
  timingByLevel: Readonly<Record<string, KampprogramLevelTiming>>,
): KampprogramTableRow[] {
  const scheduled = matches
    .filter((m) => m.isScheduled && m.startTime && m.endTime)
    .sort((a, b) => {
      const ta = timeToMinutes(a.startTime) ?? 0;
      const tb = timeToMinutes(b.startTime) ?? 0;
      return ta - tb || a.id.localeCompare(b.id);
    });

  const slots: KampprogramTableRow[] = [];
  for (const m of scheduled) {
    const timing = resolveKampprogramLevelTiming(m.levelKey, timingByLevel);
    slots.push(...expandMatchToTableRows(m, timing));
  }

  slots.sort((a, b) => {
    const ta = a.type === "match" ? timeToMinutes(a.slotStartTime) : timeToMinutes(a.startTime);
    const tb = b.type === "match" ? timeToMinutes(b.slotStartTime) : timeToMinutes(b.startTime);
    return (ta ?? 0) - (tb ?? 0);
  });

  const withGaps: KampprogramTableRow[] = [];
  for (const row of slots) {
    if (row.type !== "match") continue;
    const rowStart = timeToMinutes(row.slotStartTime);
    if (rowStart == null) {
      withGaps.push(row);
      continue;
    }
    const prev = withGaps[withGaps.length - 1];
    if (prev) {
      const prevEnd =
        prev.type === "match"
          ? timeToMinutes(prev.slotEndTime)
          : timeToMinutes(prev.endTime);
      if (prevEnd != null && rowStart > prevEnd) {
        const gapStart = minutesToSlotIso(prevEnd);
        const gapEnd = minutesToSlotIso(rowStart);
        if (gapStart && gapEnd) {
          withGaps.push({
            type: "idle",
            courtId: court.id,
            courtName: court.name,
            venueName: court.venueName,
            startTime: gapStart,
            endTime: gapEnd,
          });
        }
      }
    }
    withGaps.push(row);
  }

  return withGaps;
}

export type KampprogramBundle = {
  matches: KampprogramMatch[];
  courts: KampprogramCourt[];
  levels: string[];
  periods: KampprogramPeriod[];
  levelTimingByLevel: Record<string, KampprogramLevelTiming>;
  courtAvailabilityByCourtId: KampprogramCourtAvailabilityByCourtId;
  teamDetails: Record<string, TeamDetailView>;
  stats: {
    total: number;
    scheduled: number;
    unscheduled: number;
    /** Kampe uden gyldig pulje/hold (vises som Ukendt hold). */
    orphanMatches: number;
    outsidePoolPeriod: number;
  };
  schedulingSummary: KampprogramSchedulingSummary;
  error: string | null;
};

export type KampprogramMatchFilter = "all" | "unscheduled" | "outside-period";

export function parseKampprogramMatchFilter(raw?: string | null): KampprogramMatchFilter {
  if (raw === "unscheduled" || raw === "outside-period") return raw;
  return "all";
}
