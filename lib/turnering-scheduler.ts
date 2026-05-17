/**
 * Kamp → bane + start/sluttid inden for puljens turneringsperiode.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourtAvailabilityRow, CourtBreakRow, CourtRow, CourtType, LevelCourtSettingLike } from "@/lib/baner-tider";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  courtsRowsToRegnemaskineCourts,
  roundLengthMinutes,
  type RegnemaskineAvailability,
  type RegnemaskineBreak,
  type RoundTiming,
} from "@/lib/lykkecup-regnemaskine";
import { courtTypeForLevel } from "@/lib/level-court-settings";
import { timeInputToTimestamptz, timeToMinutes } from "@/lib/baner-tider";
import { periodsToTryForScheduling, schedulingEpochStartMinutes } from "@/lib/period-capacity";
import {
  isAllDayPeriod,
  periodWindowForScheduling,
  periodWindowMinutes,
  type TournamentPeriodRow,
} from "@/lib/tournament-periods";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

/**
 * Minimum wall-clock minutes between the end of one match and the start of the next for the same team.
 * (Not the 1 min omskiftning on court — that is already in round length.)
 */
export const DEFAULT_TEAM_REST_MINUTES = 10;

/** @deprecated Bruges kun i fejltekster; hold-pause er nu minutter fra kamp-slut. */
export const MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES = 1;

export function minRoundSlotsBetweenTeamMatches(): number {
  return MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES + 1;
}

/** Sidste kamp-sluttid pr. hold (minutter fra midnat). */
export type TeamRoundTracker = Map<string, number>;

export function createTeamRoundTracker(): TeamRoundTracker {
  return new Map();
}

export function teamRestMinutesBetweenMatches(roundLen: number): number {
  if (!Number.isFinite(roundLen) || roundLen <= 0) return DEFAULT_TEAM_REST_MINUTES;
  return roundLen;
}

export function teamsCanPlayAt(
  tracker: TeamRoundTracker,
  teamAId: string,
  teamBId: string,
  startMinutes: number,
  restMinutes: number,
): boolean {
  for (const teamId of [teamAId, teamBId]) {
    const lastEnd = tracker.get(teamId);
    if (lastEnd === undefined) continue;
    if (startMinutes < lastEnd + restMinutes) return false;
  }
  return true;
}

export function recordTeamsAfterMatch(
  tracker: TeamRoundTracker,
  teamAId: string,
  teamBId: string,
  endMinutes: number,
): void {
  for (const teamId of [teamAId, teamBId]) {
    const prev = tracker.get(teamId);
    tracker.set(teamId, prev === undefined ? endMinutes : Math.max(prev, endMinutes));
  }
}

export function roundSlotFromStartMinutes(
  periodStartMinutes: number,
  roundLengthMinutes: number,
  startMinutes: number,
): number {
  if (roundLengthMinutes <= 0) return 0;
  return Math.round((startMinutes - periodStartMinutes) / roundLengthMinutes);
}

export function seedTeamRoundTrackerFromScheduledMatches(
  tracker: TeamRoundTracker,
  matches: readonly { team_a_id: string; team_b_id: string; startMinutes: number; endMinutes: number }[],
): void {
  for (const m of matches) {
    if (m.endMinutes <= m.startMinutes) continue;
    recordTeamsAfterMatch(tracker, m.team_a_id, m.team_b_id, m.endMinutes);
  }
}

/** Sidste runde-slot en kamp optager (ved 2 halvlege: start + 1). */
export function lastRoundSlotForMatch(startSlot: number, roundsPerMatch: number): number {
  const rpm = Math.max(1, Math.floor(roundsPerMatch));
  return startSlot + rpm - 1;
}

export function requiredCourtTypeForLevel(levelKey: string, levelCourtRows: readonly LevelCourtSettingLike[]): CourtType {
  return courtTypeForLevel(levelKey, levelCourtRows);
}

export function courtMatchesLevel(
  courtType: CourtType,
  levelKey: string,
  levelCourtRows: readonly LevelCourtSettingLike[],
): boolean {
  return courtType === requiredCourtTypeForLevel(levelKey, levelCourtRows);
}

export type OccupiedSlot = {
  courtId: string;
  startMinutes: number;
  endMinutes: number;
};

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

function breaksForCourt(courtId: string, breaks: readonly RegnemaskineBreak[]): RegnemaskineBreak[] {
  return breaks.filter((b) => b.courtId === courtId);
}

function availabilityWindowsForCourt(
  courtId: string,
  availability: readonly RegnemaskineAvailability[],
): Array<{ startMinutes: number; endMinutes: number }> {
  return availability
    .filter((a) => a.courtId === courtId)
    .map((a) => ({ startMinutes: a.startMinutes, endMinutes: a.endMinutes }))
    .filter((w) => w.endMinutes > w.startMinutes);
}

function intersectWindow(
  a: { startMinutes: number; endMinutes: number },
  b: { startMinutes: number; endMinutes: number },
): { startMinutes: number; endMinutes: number } | null {
  const startMinutes = Math.max(a.startMinutes, b.startMinutes);
  const endMinutes = Math.min(a.endMinutes, b.endMinutes);
  if (endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

/** Courts without explicit availability use the pool period as playable time. */
export function withPeriodFallbackAvailability(
  courtIds: readonly string[],
  availability: readonly RegnemaskineAvailability[],
  periodWin: { startMinutes: number; endMinutes: number },
): RegnemaskineAvailability[] {
  return availabilityForPeriodScheduling(courtIds, availability, periodWin);
}

/**
 * Per-bane tilgængelighed inden for en periode: klip eksplicitte vinduer til perioden;
 * hvis intet overlap (fx bane kun 08–12 ved Eftermiddag-planlægning), brug hele perioden.
 */
export function availabilityForPeriodScheduling(
  courtIds: readonly string[],
  availability: readonly RegnemaskineAvailability[],
  periodWin: { startMinutes: number; endMinutes: number },
  period?: Pick<TournamentPeriodRow, "is_all_day" | "name">,
): RegnemaskineAvailability[] {
  if (period && isAllDayPeriod(period)) {
    const result: RegnemaskineAvailability[] = [];
    for (const courtId of courtIds) {
      const rows = availability.filter(
        (a) => a.courtId === courtId && a.endMinutes > a.startMinutes,
      );
      if (rows.length === 0) {
        result.push({
          courtId,
          startMinutes: periodWin.startMinutes,
          endMinutes: periodWin.endMinutes,
        });
      } else {
        result.push(...rows);
      }
    }
    return result;
  }

  const result: RegnemaskineAvailability[] = [];
  for (const courtId of courtIds) {
    const clipped: RegnemaskineAvailability[] = [];
    for (const a of availability) {
      if (a.courtId !== courtId) continue;
      const win = intersectWindow(a, periodWin);
      if (win) {
        clipped.push({ courtId, startMinutes: win.startMinutes, endMinutes: win.endMinutes });
      }
    }
    if (clipped.length === 0) {
      result.push({
        courtId,
        startMinutes: periodWin.startMinutes,
        endMinutes: periodWin.endMinutes,
      });
    } else {
      result.push(...clipped);
    }
  }
  return result;
}

function isIntervalFree(
  courtId: string,
  startMinutes: number,
  endMinutes: number,
  occupancy: readonly OccupiedSlot[],
  breaks: readonly RegnemaskineBreak[],
  playableWindows: readonly { startMinutes: number; endMinutes: number }[],
): boolean {
  const inPlayable = playableWindows.some(
    (w) => startMinutes >= w.startMinutes && endMinutes <= w.endMinutes,
  );
  if (!inPlayable) return false;

  for (const b of breaks) {
    if (overlaps(startMinutes, endMinutes, b.startMinutes, b.endMinutes)) return false;
  }
  for (const o of occupancy) {
    if (o.courtId !== courtId) continue;
    if (overlaps(startMinutes, endMinutes, o.startMinutes, o.endMinutes)) return false;
  }
  return true;
}

export type ScheduleMatchInput = {
  id: string;
  levelKey: string;
  teamAId: string;
  teamBId: string;
};

export type ScheduleAssignment = {
  matchId: string;
  courtId: string;
  startMinutes: number;
  endMinutes: number;
  roundIndex: number;
};

type SchedulePeriodContext = {
  period: Pick<TournamentPeriodRow, "id" | "start_time" | "end_time" | "is_all_day" | "name">;
  /** Fælles tidslinje for runde-pauser på tværs af perioder (typisk dagens første start). */
  roundSlotEpochStartMinutes: number;
  courtIds: readonly string[];
  courtTypes: ReadonlyMap<string, CourtType>;
  levelKey: string;
  levelCourtRows: readonly LevelCourtSettingLike[];
  availability: readonly RegnemaskineAvailability[];
  breaks: readonly RegnemaskineBreak[];
  timing: RoundTiming;
  roundsPerMatch: number;
  existingOccupancy: readonly OccupiedSlot[];
  /** Minutter mellem kamp-slut og næste kamp-start for samme hold. Sænk ved sidste forsøg. */
  teamRestMinutes?: number;
};

type SlotCandidate = {
  courtId: string;
  startMinutes: number;
  endMinutes: number;
  roundSlot: number;
  periodId: string;
};

function pickLeastBusyCourt(courtIds: readonly string[], occupancy: readonly OccupiedSlot[]): string {
  return [...courtIds].sort((a, b) => {
    const occA = occupancy.filter((o) => o.courtId === a).length;
    const occB = occupancy.filter((o) => o.courtId === b).length;
    return occA - occB || a.localeCompare(b);
  })[0]!;
}

function findEarliestSlotForMatch(
  match: ScheduleMatchInput,
  courtOrder: readonly string[],
  input: SchedulePeriodContext,
  periodWin: { startMinutes: number; endMinutes: number },
  roundLen: number,
  blockMinutes: number,
  occupancy: readonly OccupiedSlot[],
  teamRounds: TeamRoundTracker,
  teamRestMinutes: number,
): SlotCandidate | null {
  const periodStart = periodWin.startMinutes;
  const periodEnd = periodWin.endMinutes;

  // Step by én runde (fx 10 min) så hold kan starte lige efter pause (fx 13:50 efter 13:40-slut).
  for (let t = periodStart; t + blockMinutes <= periodEnd; t += roundLen) {
    const startMinutes = t;
    const endMinutes = t + blockMinutes;
    const roundSlot = roundSlotFromStartMinutes(input.roundSlotEpochStartMinutes, roundLen, startMinutes);
    if (!teamsCanPlayAt(teamRounds, match.teamAId, match.teamBId, startMinutes, teamRestMinutes)) continue;

    const freeCourts: string[] = [];
    for (const courtId of courtOrder) {
      const avail = availabilityWindowsForCourt(courtId, input.availability);
      const courtBreaks = breaksForCourt(courtId, input.breaks);
      const playableWindows = isAllDayPeriod(input.period)
        ? avail.filter((w) => w.endMinutes > w.startMinutes)
        : avail
            .map((w) => intersectWindow(w, periodWin))
            .filter((w): w is { startMinutes: number; endMinutes: number } => w != null);
      if (playableWindows.length === 0) continue;
      if (isIntervalFree(courtId, startMinutes, endMinutes, occupancy, courtBreaks, playableWindows)) {
        freeCourts.push(courtId);
      }
    }

    if (freeCourts.length > 0) {
      const courtId = pickLeastBusyCourt(freeCourts, occupancy);
      return { courtId, startMinutes, endMinutes, roundSlot, periodId: input.period.id };
    }
  }

  return null;
}

function sortSlotCandidates(slots: SlotCandidate[]): SlotCandidate[] {
  return [...slots].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      a.courtId.localeCompare(b.courtId) ||
      a.periodId.localeCompare(b.periodId),
  );
}

/**
 * Ledige (bane, tid) for en kamp.
 * Bruger puljens periode først; andre perioder kun hvis der ingen ledige tider er i primær.
 */
function findAllSlotsForMatch(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  match: ScheduleMatchInput,
  courtOrder: readonly string[],
  base: SchedulePoolBase,
  occupancy: readonly OccupiedSlot[],
  teamRounds: TeamRoundTracker,
  teamRestMinutes: number,
): SlotCandidate[] {
  const roundLen = roundLengthMinutes(base.timing);
  if (roundLen <= 0) return [];

  const blockMinutes = Math.max(1, Math.floor(base.roundsPerMatch)) * roundLen;
  const tryPeriods = periodsToTryForScheduling(periods, primaryPeriodId);
  const slots: SlotCandidate[] = [];

  for (const period of tryPeriods) {
    const periodWin = periodWindowForScheduling(period, base.baseAvailability, base.courtIds);
    if (!periodWin) continue;

    const availability = availabilityForPeriodScheduling(
      base.courtIds,
      base.baseAvailability,
      periodWin,
      period,
    );
    const ctx: SchedulePeriodContext = {
      period,
      roundSlotEpochStartMinutes: base.roundSlotEpochStartMinutes,
      courtIds: base.courtIds,
      courtTypes: base.courtTypes,
      levelKey: base.levelKey,
      levelCourtRows: base.levelCourtRows,
      availability,
      breaks: base.breaks,
      timing: base.timing,
      roundsPerMatch: base.roundsPerMatch,
      existingOccupancy: occupancy,
      teamRestMinutes,
    };

    for (let t = periodWin.startMinutes; t + blockMinutes <= periodWin.endMinutes; t += roundLen) {
      if (!teamsCanPlayAt(teamRounds, match.teamAId, match.teamBId, t, teamRestMinutes)) continue;

      const endMinutes = t + blockMinutes;
      const roundSlot = roundSlotFromStartMinutes(base.roundSlotEpochStartMinutes, roundLen, t);

      for (const courtId of courtOrder) {
        const avail = availabilityWindowsForCourt(courtId, availability);
        const courtBreaks = breaksForCourt(courtId, base.breaks);
        const playableWindows = isAllDayPeriod(period)
          ? avail.filter((w) => w.endMinutes > w.startMinutes)
          : avail
              .map((w) => intersectWindow(w, periodWin))
              .filter((w): w is { startMinutes: number; endMinutes: number } => w != null);
        if (playableWindows.length === 0) continue;
        if (isIntervalFree(courtId, t, endMinutes, occupancy, courtBreaks, playableWindows)) {
          slots.push({
            courtId,
            startMinutes: t,
            endMinutes,
            roundSlot,
            periodId: period.id,
          });
        }
      }
    }
  }

  const primarySlots = slots.filter((s) => s.periodId === primaryPeriodId);
  if (primarySlots.length > 0) return sortSlotCandidates(primarySlots);
  return sortSlotCandidates(slots);
}

function deterministicShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = (seed + 1) | 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function overflowNamesFromAssignments(
  assignments: readonly ScheduleAssignment[],
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  base: SchedulePoolBase,
): string[] {
  const overflowPeriodNames: string[] = [];
  for (const a of assignments) {
    for (const period of periods) {
      if (period.id === primaryPeriodId) continue;
      const win = periodWindowForScheduling(period, base.baseAvailability, base.courtIds);
      if (!win) continue;
      if (a.startMinutes >= win.startMinutes && a.endMinutes <= win.endMinutes) {
        if (!overflowPeriodNames.includes(period.name)) overflowPeriodNames.push(period.name);
        break;
      }
    }
  }
  return overflowPeriodNames;
}

/** Hurtig planlægning med flere kamp-rækkefølger (undgår eksponentiel backtracking). */
function schedulePoolFast(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  base: SchedulePoolBase,
  matches: readonly ScheduleMatchInput[],
  externalTeamSeed: TeamRoundTracker,
  teamRestMinutes: number,
): { assignments: ScheduleAssignment[]; overflowPeriodNames: string[] } | null {
  const courtOrder = [...base.courtIds].sort((a, b) => a.localeCompare(b));

  const tryOrder = (ordered: readonly ScheduleMatchInput[]): ScheduleAssignment[] | null => {
    const occupancy: OccupiedSlot[] = [...base.existingOccupancy];
    const tracker = createTeamRoundTracker();
    for (const [teamId, endMin] of externalTeamSeed) tracker.set(teamId, endMin);
    const assignments: ScheduleAssignment[] = [];

    for (const match of ordered) {
      const slots = findAllSlotsForMatch(
        periods,
        primaryPeriodId,
        match,
        courtOrder,
        base,
        occupancy,
        tracker,
        teamRestMinutes,
      );
      if (slots.length === 0) return null;
      const slot = slots[0]!;
      assignments.push({
        matchId: match.id,
        courtId: slot.courtId,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        roundIndex: slot.roundSlot,
      });
      occupancy.push({
        courtId: slot.courtId,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      });
      recordTeamsAfterMatch(tracker, match.teamAId, match.teamBId, slot.endMinutes);
    }
    return assignments;
  };

  const emptyOcc = [...base.existingOccupancy];
  const emptyTracker = createTeamRoundTracker();
  for (const [teamId, endMin] of externalTeamSeed) emptyTracker.set(teamId, endMin);

  const byFewestSlots = [...matches].sort((a, b) => {
    const ca = findAllSlotsForMatch(
      periods,
      primaryPeriodId,
      a,
      courtOrder,
      base,
      emptyOcc,
      emptyTracker,
      teamRestMinutes,
    ).length;
    const cb = findAllSlotsForMatch(
      periods,
      primaryPeriodId,
      b,
      courtOrder,
      base,
      emptyOcc,
      emptyTracker,
      teamRestMinutes,
    ).length;
    return ca - cb || a.id.localeCompare(b.id);
  });

  const orders: ScheduleMatchInput[][] = [
    byFewestSlots,
    [...byFewestSlots].reverse(),
    [...matches],
    ...Array.from({ length: 24 }, (_, seed) => deterministicShuffle(matches, seed)),
  ];

  for (const order of orders) {
    const assignments = tryOrder(order);
    if (assignments) {
      return {
        assignments,
        overflowPeriodNames: overflowNamesFromAssignments(assignments, periods, primaryPeriodId, base),
      };
    }
  }

  return null;
}

function scheduleMatchesOnCourt(
  courtId: string,
  matches: readonly ScheduleMatchInput[],
  input: SchedulePeriodContext,
  occupancySeed: readonly OccupiedSlot[],
  _roundIndexStart: number,
  teamRounds: TeamRoundTracker,
): { assignments: ScheduleAssignment[]; unscheduled: string[] } {
  const periodWin = periodWindowForScheduling(
    input.period,
    input.availability,
    input.courtIds,
  );
  if (!periodWin) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const roundLen = roundLengthMinutes(input.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const blockMinutes = Math.max(1, Math.floor(input.roundsPerMatch)) * roundLen;
  const teamRestMinutes =
    input.teamRestMinutes ?? teamRestMinutesBetweenMatches(roundLen);
  const occupancy: OccupiedSlot[] = [...occupancySeed];
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: string[] = [];

  for (const match of matches) {
    const slot = findEarliestSlotForMatch(
      match,
      [courtId],
      input,
      periodWin,
      roundLen,
      blockMinutes,
      occupancy,
      teamRounds,
      teamRestMinutes,
    );
    if (!slot) {
      unscheduled.push(match.id);
      continue;
    }
    occupancy.push({ courtId: slot.courtId, startMinutes: slot.startMinutes, endMinutes: slot.endMinutes });
    assignments.push({
      matchId: match.id,
      courtId: slot.courtId,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      roundIndex: slot.roundSlot,
    });
    recordTeamsAfterMatch(teamRounds, match.teamAId, match.teamBId, slot.endMinutes);
  }

  return { assignments, unscheduled };
}

function scheduleMatchesAcrossCourts(
  matches: readonly ScheduleMatchInput[],
  input: SchedulePeriodContext,
  courtOrder: readonly string[],
  occupancySeed: readonly OccupiedSlot[],
  teamRounds: TeamRoundTracker,
): { assignments: ScheduleAssignment[]; unscheduled: string[] } {
  const periodWin = periodWindowForScheduling(input.period, input.availability, input.courtIds);
  if (!periodWin) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const roundLen = roundLengthMinutes(input.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const blockMinutes = Math.max(1, Math.floor(input.roundsPerMatch)) * roundLen;
  const teamRestMinutes =
    input.teamRestMinutes ?? teamRestMinutesBetweenMatches(roundLen);
  const occupancy: OccupiedSlot[] = [...occupancySeed];
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: string[] = [];

  for (const match of matches) {
    const slot = findEarliestSlotForMatch(
      match,
      courtOrder,
      input,
      periodWin,
      roundLen,
      blockMinutes,
      occupancy,
      teamRounds,
      teamRestMinutes,
    );
    if (!slot) {
      unscheduled.push(match.id);
      continue;
    }
    occupancy.push({ courtId: slot.courtId, startMinutes: slot.startMinutes, endMinutes: slot.endMinutes });
    assignments.push({
      matchId: match.id,
      courtId: slot.courtId,
      startMinutes: slot.startMinutes,
      endMinutes: slot.endMinutes,
      roundIndex: slot.roundSlot,
    });
    recordTeamsAfterMatch(teamRounds, match.teamAId, match.teamBId, slot.endMinutes);
  }

  return { assignments, unscheduled };
}

/** Prefer one court for the whole pool when all matches fit; otherwise fall back to multi-court placement. */
export function scheduleMatchesInPeriod(input: SchedulePeriodContext & {
  matches: readonly ScheduleMatchInput[];
  teamRounds?: TeamRoundTracker;
}): { assignments: ScheduleAssignment[]; unscheduled: string[] } {
  const teamRounds = input.teamRounds ?? createTeamRoundTracker();
  const periodWin = periodWindowForScheduling(input.period, input.availability, input.courtIds);
  if (!periodWin) {
    return { assignments: [], unscheduled: input.matches.map((m) => m.id) };
  }

  const roundLen = roundLengthMinutes(input.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: input.matches.map((m) => m.id) };
  }

  const requiredType = requiredCourtTypeForLevel(input.levelKey, input.levelCourtRows);

  const eligibleCourts = input.courtIds.filter((id) => {
    const ct = input.courtTypes.get(id);
    return ct != null && ct === requiredType;
  });

  const ctx: SchedulePeriodContext = {
    period: input.period,
    roundSlotEpochStartMinutes: input.roundSlotEpochStartMinutes,
    courtIds: input.courtIds,
    courtTypes: input.courtTypes,
    levelKey: input.levelKey,
    levelCourtRows: input.levelCourtRows,
    availability: input.availability,
    breaks: input.breaks,
    timing: input.timing,
    roundsPerMatch: input.roundsPerMatch,
    existingOccupancy: input.existingOccupancy,
  };

  const courtOrder = [...eligibleCourts].sort((a, b) => {
    const occA = input.existingOccupancy.filter((o) => o.courtId === a).length;
    const occB = input.existingOccupancy.filter((o) => o.courtId === b).length;
    return occA - occB || a.localeCompare(b);
  });

  for (const courtId of courtOrder) {
    const trialRounds = createTeamRoundTracker();
    for (const [teamId, slot] of teamRounds) trialRounds.set(teamId, slot);
    const single = scheduleMatchesOnCourt(
      courtId,
      input.matches,
      ctx,
      input.existingOccupancy,
      0,
      trialRounds,
    );
    if (single.unscheduled.length === 0) {
      for (const [teamId, slot] of trialRounds) teamRounds.set(teamId, slot);
      return { assignments: single.assignments, unscheduled: [] };
    }
  }

  return scheduleMatchesAcrossCourts(input.matches, ctx, courtOrder, input.existingOccupancy, teamRounds);
}

type SchedulePoolBase = Omit<SchedulePeriodContext, "period" | "availability"> & {
  baseAvailability: readonly RegnemaskineAvailability[];
  teamRestMinutes?: number;
};

/** Planlæg i puljens periode først; flyt resterende kampe til andre perioder ved behov. */
export function scheduleMatchesWithPeriodOverflow(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  base: SchedulePoolBase & {
    teamRounds?: TeamRoundTracker;
  },
  matches: readonly ScheduleMatchInput[],
): { assignments: ScheduleAssignment[]; unscheduled: string[]; overflowPeriodNames: string[] } {
  const tryPeriods = periodsToTryForScheduling(periods, primaryPeriodId);
  const overflowPeriodNames: string[] = [];
  let remaining = [...matches];
  const assignments: ScheduleAssignment[] = [];
  let occupancy: OccupiedSlot[] = [...base.existingOccupancy];
  const teamRounds = base.teamRounds ?? createTeamRoundTracker();

  for (const period of tryPeriods) {
    if (remaining.length === 0) break;
    const periodWin = periodWindowForScheduling(period, base.baseAvailability, base.courtIds);
    if (!periodWin) continue;

    const availability = availabilityForPeriodScheduling(
      base.courtIds,
      base.baseAvailability,
      periodWin,
      period,
    );
    const result = scheduleMatchesInPeriod({
      period,
      roundSlotEpochStartMinutes: base.roundSlotEpochStartMinutes,
      courtIds: base.courtIds,
      courtTypes: base.courtTypes,
      levelKey: base.levelKey,
      levelCourtRows: base.levelCourtRows,
      availability,
      breaks: base.breaks,
      timing: base.timing,
      roundsPerMatch: base.roundsPerMatch,
      existingOccupancy: occupancy,
      teamRounds,
      teamRestMinutes: base.teamRestMinutes,
      matches: remaining,
    });

    if (period.id !== primaryPeriodId && result.assignments.length > 0) {
      overflowPeriodNames.push(period.name);
    }

    assignments.push(...result.assignments);
    for (const a of result.assignments) {
      occupancy.push({
        courtId: a.courtId,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
      });
    }
    remaining = remaining.filter((m) => result.unscheduled.includes(m.id));
  }

  if (remaining.length > 0) {
    const individual = scheduleMatchesIndividually(
      periods,
      primaryPeriodId,
      base,
      remaining,
      occupancy,
      teamRounds,
    );
    if (individual.overflowPeriodNames.length > 0) {
      overflowPeriodNames.push(...individual.overflowPeriodNames);
    }
    assignments.push(...individual.assignments);
    for (const a of individual.assignments) {
      occupancy.push({
        courtId: a.courtId,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
      });
    }
    remaining = remaining.filter((m) => individual.unscheduled.includes(m.id));
  }

  return {
    assignments,
    unscheduled: remaining.map((m) => m.id),
    overflowPeriodNames: [...new Set(overflowPeriodNames)],
  };
}

/** En kamp ad gangen: første ledige bane/tid i enhver periode (fylder huller på tværs af perioder). */
function scheduleMatchesIndividually(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  base: SchedulePoolBase,
  matches: readonly ScheduleMatchInput[],
  occupancy: OccupiedSlot[],
  teamRounds: TeamRoundTracker,
): { assignments: ScheduleAssignment[]; unscheduled: string[]; overflowPeriodNames: string[] } {
  const roundLen = roundLengthMinutes(base.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: matches.map((m) => m.id), overflowPeriodNames: [] };
  }

  const blockMinutes = Math.max(1, Math.floor(base.roundsPerMatch)) * roundLen;
  const teamRestMinutes =
    base.teamRestMinutes ?? teamRestMinutesBetweenMatches(roundLen);
  const courtOrder = [...base.courtIds].sort((a, b) => a.localeCompare(b));
  const tryPeriods = periodsToTryForScheduling(periods, primaryPeriodId);
  const overflowPeriodNames: string[] = [];
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: string[] = [];

  const sorted = [...matches].sort((a, b) => {
    const pressure = (m: ScheduleMatchInput) =>
      Math.max(teamRounds.get(m.teamAId) ?? -Infinity, teamRounds.get(m.teamBId) ?? -Infinity);
    return pressure(b) - pressure(a);
  });

  for (const match of sorted) {
    let placed: ScheduleAssignment | null = null;
    let overflowPeriod: string | null = null;

    for (const period of tryPeriods) {
      const periodWin = periodWindowForScheduling(period, base.baseAvailability, base.courtIds);
      if (!periodWin) continue;

      const availability = availabilityForPeriodScheduling(
        base.courtIds,
        base.baseAvailability,
        periodWin,
        period,
      );
      const slot = findEarliestSlotForMatch(
        match,
        courtOrder,
        {
          period,
          roundSlotEpochStartMinutes: base.roundSlotEpochStartMinutes,
          courtIds: base.courtIds,
          courtTypes: base.courtTypes,
          levelKey: base.levelKey,
          levelCourtRows: base.levelCourtRows,
          availability,
          breaks: base.breaks,
          timing: base.timing,
          roundsPerMatch: base.roundsPerMatch,
          existingOccupancy: occupancy,
          teamRestMinutes,
        },
        periodWin,
        roundLen,
        blockMinutes,
        occupancy,
        teamRounds,
        teamRestMinutes,
      );

      if (!slot) continue;

      placed = {
        matchId: match.id,
        courtId: slot.courtId,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        roundIndex: slot.roundSlot,
      };
      if (period.id !== primaryPeriodId) {
        overflowPeriod = period.name;
      }
      break;
    }

    if (!placed) {
      unscheduled.push(match.id);
      continue;
    }

    assignments.push(placed);
    occupancy.push({
      courtId: placed.courtId,
      startMinutes: placed.startMinutes,
      endMinutes: placed.endMinutes,
    });
    recordTeamsAfterMatch(teamRounds, match.teamAId, match.teamBId, placed.endMinutes);
    if (overflowPeriod && !overflowPeriodNames.includes(overflowPeriod)) {
      overflowPeriodNames.push(overflowPeriod);
    }
  }

  return { assignments, unscheduled, overflowPeriodNames };
}

export function minutesToTimestamptz(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return timeInputToTimestamptz(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)!;
}

export type AssignPoolScheduleResult = {
  scheduled: number;
  unscheduled: number;
  error: string | null;
  /** Senere perioder end puljens tildelte periode (fx Eftermiddag ved fuld Formiddag). */
  overflowPeriodNames: string[];
};

/** Planlæg alle puljer på samme niveau med «Hele dagen» i én optimering (deler Stor-baner). */
export async function assignMatchScheduleForLevelAllDay(
  supabase: SupabaseClient,
  levelKey: string,
  triggerPoolId: string,
  primaryPeriodId: string,
): Promise<AssignPoolScheduleResult> {
  const eventId = TURNERING_EVENT_ID;

  const [poolsRes, periodsRes] = await Promise.all([
    supabase.from("pools").select("id, level, period_id").eq("event_id", eventId),
    supabase
      .from("tournament_periods")
      .select("id, event_id, name, start_time, end_time, sort_order, is_all_day")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true }),
  ]);

  if (poolsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: poolsRes.error.message, overflowPeriodNames: [] };
  }
  if (periodsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: periodsRes.error.message, overflowPeriodNames: [] };
  }

  const allPeriods = (periodsRes.data ?? []) as TournamentPeriodRow[];
  const allDayPeriodIds = new Set(
    allPeriods.filter((p) => isAllDayPeriod(p)).map((p) => p.id),
  );

  const levelPoolIds = ((poolsRes.data ?? []) as Array<{ id: string; level: string | null; period_id: string | null }>)
    .filter(
      (p) =>
        canonicalBanerLevelLabel(p.level) === levelKey &&
        p.period_id != null &&
        allDayPeriodIds.has(p.period_id),
    )
    .map((p) => p.id);

  if (levelPoolIds.length === 0) {
    return assignMatchScheduleForPool(supabase, triggerPoolId);
  }

  const result = await assignMatchScheduleForPoolIds(
    supabase,
    levelPoolIds,
    primaryPeriodId,
    levelKey,
    triggerPoolId,
  );
  return result;
}

async function assignMatchScheduleForPoolIds(
  supabase: SupabaseClient,
  poolIds: readonly string[],
  primaryPeriodId: string,
  levelKey: string,
  reportPoolId: string,
): Promise<AssignPoolScheduleResult> {
  const eventId = TURNERING_EVENT_ID;
  const poolIdSet = new Set(poolIds);

  const venuesRes = await supabase.from("venues").select("id").eq("event_id", eventId);
  const venueIds = ((venuesRes.data ?? []) as { id: string }[]).map((v) => v.id);

  const courtsQuery =
    venueIds.length > 0
      ? supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .in("venue_id", venueIds)
      : supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .eq("event_id", eventId);

  const [allPeriodsRes, matchesRes, courtsRes, availRes, breaksRes, levelRes, levelCourtRes, allMatchesRes] =
    await Promise.all([
      supabase
        .from("tournament_periods")
        .select("id, event_id, name, start_time, end_time, sort_order, is_all_day")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("matches")
        .select("id, pool_id, team_a_id, team_b_id, court_id, start_time")
        .eq("event_id", eventId)
        .in("pool_id", [...poolIds])
        .order("created_at", { ascending: true }),
      courtsQuery,
      supabase.from("court_availability").select("court_id, start_time, end_time").eq("event_id", eventId),
      supabase.from("court_breaks").select("court_id, start_time, end_time").eq("event_id", eventId),
      supabase
        .from("level_schedule_settings")
        .select("level, match_duration_minutes, break_between_matches_minutes, rounds_per_match")
        .eq("event_id", eventId),
      supabase.from("level_court_settings").select("level, court_type").eq("event_id", eventId),
      supabase
        .from("matches")
        .select("id, pool_id, court_id, start_time, end_time")
        .eq("event_id", eventId)
        .not("court_id", "is", null)
        .not("start_time", "is", null)
        .not("end_time", "is", null),
    ]);

  if (allPeriodsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: allPeriodsRes.error.message, overflowPeriodNames: [] };
  }
  const allPeriods = (allPeriodsRes.data ?? []) as TournamentPeriodRow[];
  if (matchesRes.error) {
    return { scheduled: 0, unscheduled: 0, error: matchesRes.error.message, overflowPeriodNames: [] };
  }
  if (courtsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: courtsRes.error.message, overflowPeriodNames: [] };
  }

  const poolMatchesAll = (matchesRes.data ?? []) as Array<{
    id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
  }>;
  const poolMatches = poolMatchesAll.filter((m) => !m.court_id || !m.start_time);
  const reportPoolMatches = poolMatchesAll.filter((m) => m.pool_id === reportPoolId);
  const reportUnscheduledBefore = reportPoolMatches.filter((m) => !m.court_id || !m.start_time).length;

  if (poolMatches.length === 0) {
    return { scheduled: 0, unscheduled: 0, error: null, overflowPeriodNames: [] };
  }

  let courtRows = (courtsRes.data ?? []) as CourtRow[];
  courtRows = courtRows.filter((c) => !c.event_id || c.event_id === eventId);

  const activeCourtRows = courtRows.filter((c) => c.is_active);
  if (activeCourtRows.length === 0) {
    return {
      scheduled: 0,
      unscheduled: reportUnscheduledBefore,
      error: "Ingen aktive baner — opret baner under Opsætning → Haller & baner.",
      overflowPeriodNames: [],
    };
  }

  const courts = courtsRowsToRegnemaskineCourts(courtRows);
  const levelCourtRows = (levelCourtRes.data ?? []) as LevelCourtSettingLike[];
  const requiredType = requiredCourtTypeForLevel(levelKey, levelCourtRows);
  const activeCourtIds = courts.filter((c) => c.isActive).map((c) => c.id);
  const eligibleCourtIds = activeCourtIds.filter((id) => {
    const ct = courtRows.find((c) => c.id === id)?.court_type;
    return ct === requiredType;
  });

  if (eligibleCourtIds.length === 0) {
    const types = [...new Set(activeCourtRows.map((c) => c.court_type))].join(", ");
    return {
      scheduled: 0,
      unscheduled: reportUnscheduledBefore,
      error: `Ingen aktive baner med type «${requiredType}» for ${levelKey}. Baner har: ${types || "—"}.`,
      overflowPeriodNames: [],
    };
  }

  const baseAvailability = availabilityRowsToRegnemaskineAvailability(
    ((availRes.data ?? []) as CourtAvailabilityRow[]).map((a) => ({
      ...a,
      event_id: eventId,
    })),
  );

  const poolPeriod = allPeriods.find((p) => p.id === primaryPeriodId);
  if (!poolPeriod) {
    return { scheduled: 0, unscheduled: reportUnscheduledBefore, error: "Periode ikke fundet.", overflowPeriodNames: [] };
  }

  const periodWin = periodWindowForScheduling(poolPeriod, baseAvailability, eligibleCourtIds);
  if (!periodWin) {
    return {
      scheduled: 0,
      unscheduled: reportUnscheduledBefore,
      error: "Kunne ikke aflede planlægningsvindue fra bane-tider.",
      overflowPeriodNames: [],
    };
  }

  const breaks = breakRowsToRegnemaskineBreaks(
    ((breaksRes.data ?? []) as CourtBreakRow[]).map((b) => ({
      ...b,
      event_id: eventId,
    })),
  );

  const levelRows = (levelRes.data ?? []) as Array<{
    level: string;
    match_duration_minutes: number;
    break_between_matches_minutes: number;
    rounds_per_match: number;
  }>;
  const levelRow = levelRows.find((r) => canonicalBanerLevelLabel(r.level) === levelKey);
  const timing: RoundTiming = {
    matchDurationMinutes: levelRow?.match_duration_minutes ?? 9,
    breakBetweenMatchesMinutes: levelRow?.break_between_matches_minutes ?? 1,
  };
  const roundsPerMatch = levelRow?.rounds_per_match ?? 1;
  const roundLen = roundLengthMinutes(timing);
  const roundSlotEpochStart = schedulingEpochStartMinutes(allPeriods);

  const allLevelMatchIds = new Set(poolMatchesAll.map((m) => m.id));
  const poolTeamIds = new Set(poolMatchesAll.flatMap((m) => [m.team_a_id, m.team_b_id]));

  const externalOccupancy: OccupiedSlot[] = [];
  for (const m of (allMatchesRes.data ?? []) as Array<{
    id: string;
    pool_id: string | null;
    court_id: string;
    start_time: string;
    end_time: string;
  }>) {
    if (allLevelMatchIds.has(m.id)) continue;
    if (m.pool_id && poolIdSet.has(m.pool_id)) continue;
    const s = timeToMinutes(m.start_time);
    const e = timeToMinutes(m.end_time);
    if (s == null || e == null || e <= s) continue;
    externalOccupancy.push({ courtId: m.court_id, startMinutes: s, endMinutes: e });
  }

  const externalTeamSeed = createTeamRoundTracker();
  const teamHistoryRes = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, start_time, end_time")
    .eq("event_id", eventId)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  if (!teamHistoryRes.error) {
    for (const row of (teamHistoryRes.data ?? []) as Array<{
      id: string;
      team_a_id: string;
      team_b_id: string;
      start_time: string;
      end_time: string;
    }>) {
      if (allLevelMatchIds.has(row.id)) continue;
      if (!poolTeamIds.has(row.team_a_id) && !poolTeamIds.has(row.team_b_id)) continue;
      const startMinutes = timeToMinutes(row.start_time);
      const endMinutes = timeToMinutes(row.end_time);
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) continue;
      recordTeamsAfterMatch(externalTeamSeed, row.team_a_id, row.team_b_id, endMinutes);
    }
  }

  const courtTypes = new Map<string, CourtType>();
  for (const c of courtRows) {
    courtTypes.set(c.id, c.court_type);
  }

  const poolBase: SchedulePoolBase = {
    roundSlotEpochStartMinutes: roundSlotEpochStart,
    courtIds: eligibleCourtIds,
    courtTypes,
    levelKey,
    levelCourtRows,
    baseAvailability,
    breaks,
    timing,
    roundsPerMatch,
    existingOccupancy: externalOccupancy,
  };

  const poolInputsAll = poolMatchesAll.map((m) => ({
    id: m.id,
    levelKey,
    teamAId: m.team_a_id,
    teamBId: m.team_b_id,
  }));

  const restAttempts = [
    teamRestMinutesBetweenMatches(roundLen),
    Math.max(0, Math.floor(roundLen / 2)),
    0,
  ];

  let assignments: ScheduleAssignment[] = [];
  let unscheduled: string[] = poolMatches.map((m) => m.id);
  let overflowPeriodNames: string[] = [];

  const maxMatches = 30;
  if (process.env.NODE_ENV === "development") {
    console.info(
      `[scheduler] Hele dagen ${levelKey}: ${poolIds.length} puljer, ${poolMatchesAll.length} kampe, ${eligibleCourtIds.length} baner`,
    );
  }
  if (poolMatchesAll.length <= maxMatches) {
    for (const rest of restAttempts) {
      const solved = schedulePoolFast(
        allPeriods,
        primaryPeriodId,
        poolBase,
        poolInputsAll,
        externalTeamSeed,
        rest,
      );
      if (solved && solved.assignments.length === poolMatchesAll.length) {
        assignments = solved.assignments;
        unscheduled = [];
        overflowPeriodNames = solved.overflowPeriodNames;
        break;
      }
    }
  }

  if (assignments.length === 0) {
    return {
      scheduled: 0,
      unscheduled: reportUnscheduledBefore,
      error:
        poolMatchesAll.length > maxMatches
          ? `For mange kampe (${poolMatchesAll.length}) til automatisk planlægning på niveauet.`
          : "Ingen komplet plan fundet for niveauets puljer — tjek bane-tider og kapacitet under Opsætning → Haller & baner.",
      overflowPeriodNames: [],
    };
  }

  let saved = 0;
  for (const a of assignments) {
    const start_time = minutesToTimestamptz(a.startMinutes);
    const end_time = minutesToTimestamptz(a.endMinutes);
    if (!start_time || !end_time) continue;

    const { data, error } = await supabase
      .from("matches")
      .update({
        court_id: a.courtId,
        start_time,
        end_time,
        status: "scheduled",
      })
      .eq("id", a.matchId)
      .select("id");

    if (error) {
      return {
        scheduled: saved,
        unscheduled: reportUnscheduledBefore,
        error: `Kunne ikke gemme bane/tid: ${error.message}`,
        overflowPeriodNames,
      };
    }
    if (!data || data.length === 0) {
      return {
        scheduled: saved,
        unscheduled: reportUnscheduledBefore,
        error: "Kunne ikke opdatere kampe i databasen (manglende rettigheder?).",
        overflowPeriodNames,
      };
    }

    saved += 1;
    await supabase.from("matches").update({ round_index: a.roundIndex }).eq("id", a.matchId);
  }

  const assignedIds = new Set(assignments.map((a) => a.matchId));
  const reportStillUnscheduled = poolMatchesAll.filter(
    (m) => m.pool_id === reportPoolId && !assignedIds.has(m.id),
  ).length;
  const reportSaved = reportPoolMatches.length - reportStillUnscheduled;

  return {
    scheduled: reportSaved,
    unscheduled: reportStillUnscheduled,
    error:
      reportStillUnscheduled > 0
        ? `${reportStillUnscheduled} kamp(e) i puljen kunne ikke placeres — tjek bane-kapacitet for ${levelKey}.`
        : saved < assignments.length
          ? "Nogle kampe blev planlagt men kunne ikke gemmes."
          : null,
    overflowPeriodNames,
  };
}

export async function assignMatchScheduleForPool(
  supabase: SupabaseClient,
  poolId: string,
): Promise<AssignPoolScheduleResult> {
  const eventId = TURNERING_EVENT_ID;

  const poolRes = await supabase
    .from("pools")
    .select("id, level, period_id")
    .eq("id", poolId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (poolRes.error) {
    return { scheduled: 0, unscheduled: 0, error: poolRes.error.message, overflowPeriodNames: [] };
  }
  if (!poolRes.data) {
    return { scheduled: 0, unscheduled: 0, error: "Pulje ikke fundet.", overflowPeriodNames: [] };
  }

  const pool = poolRes.data as { id: string; level: string | null; period_id: string | null };
  if (!pool.period_id) {
    return {
      scheduled: 0,
      unscheduled: 0,
      error: "Tildel en periode til puljen under Opsætning → Perioder.",
      overflowPeriodNames: [],
    };
  }

  const levelKey = canonicalBanerLevelLabel(pool.level);

  const periodCheckRes = await supabase
    .from("tournament_periods")
    .select("id, start_time, end_time, is_all_day, name")
    .eq("id", pool.period_id)
    .maybeSingle();

  if (periodCheckRes.data && isAllDayPeriod(periodCheckRes.data as TournamentPeriodRow)) {
    return assignMatchScheduleForLevelAllDay(supabase, levelKey, poolId, pool.period_id);
  }

  const venuesRes = await supabase.from("venues").select("id").eq("event_id", eventId);
  const venueIds = ((venuesRes.data ?? []) as { id: string }[]).map((v) => v.id);

  const courtsQuery =
    venueIds.length > 0
      ? supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .in("venue_id", venueIds)
      : supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .eq("event_id", eventId);

  const [periodRes, allPeriodsRes, matchesRes, courtsRes, availRes, breaksRes, levelRes, levelCourtRes, allMatchesRes] =
    await Promise.all([
      supabase
        .from("tournament_periods")
        .select("id, start_time, end_time, is_all_day, name")
        .eq("id", pool.period_id)
        .maybeSingle(),
      supabase
        .from("tournament_periods")
        .select("id, event_id, name, start_time, end_time, sort_order, is_all_day")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("matches")
        .select("id, team_a_id, team_b_id, court_id, start_time")
        .eq("pool_id", poolId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      courtsQuery,
      supabase.from("court_availability").select("court_id, start_time, end_time").eq("event_id", eventId),
      supabase.from("court_breaks").select("court_id, start_time, end_time").eq("event_id", eventId),
      supabase
        .from("level_schedule_settings")
        .select("level, match_duration_minutes, break_between_matches_minutes, rounds_per_match")
        .eq("event_id", eventId),
      supabase.from("level_court_settings").select("level, court_type").eq("event_id", eventId),
      supabase
        .from("matches")
        .select("id, court_id, start_time, end_time")
        .eq("event_id", eventId)
        .not("court_id", "is", null)
        .not("start_time", "is", null)
        .not("end_time", "is", null),
    ]);

  if (periodRes.error) {
    return { scheduled: 0, unscheduled: 0, error: periodRes.error.message, overflowPeriodNames: [] };
  }
  if (allPeriodsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: allPeriodsRes.error.message, overflowPeriodNames: [] };
  }
  if (!periodRes.data) {
    return { scheduled: 0, unscheduled: 0, error: "Periode ikke fundet.", overflowPeriodNames: [] };
  }
  const allPeriods = (allPeriodsRes.data ?? []) as TournamentPeriodRow[];
  if (allPeriods.length === 0) {
    return {
      scheduled: 0,
      unscheduled: 0,
      error: "Ingen turneringsperioder — opret under Opsætning → Perioder.",
      overflowPeriodNames: [],
    };
  }
  if (matchesRes.error) {
    return { scheduled: 0, unscheduled: 0, error: matchesRes.error.message, overflowPeriodNames: [] };
  }
  if (courtsRes.error) {
    return { scheduled: 0, unscheduled: 0, error: courtsRes.error.message, overflowPeriodNames: [] };
  }

  const poolMatchesAll = (matchesRes.data ?? []) as Array<{
    id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
  }>;
  const poolMatches = poolMatchesAll.filter((m) => !m.court_id || !m.start_time);
  if (poolMatches.length === 0) {
    return { scheduled: 0, unscheduled: 0, error: null, overflowPeriodNames: [] };
  }

  const matchIds = new Set(poolMatches.map((m) => m.id));

  let courtRows = (courtsRes.data ?? []) as CourtRow[];
  courtRows = courtRows.filter((c) => !c.event_id || c.event_id === eventId);

  const activeCourtRows = courtRows.filter((c) => c.is_active);
  if (activeCourtRows.length === 0) {
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: "Ingen aktive baner — opret baner under Opsætning → Haller & baner.",
      overflowPeriodNames: [],
    };
  }

  const courts = courtsRowsToRegnemaskineCourts(courtRows);
  const levelCourtRows = (levelCourtRes.data ?? []) as LevelCourtSettingLike[];
  const requiredType = requiredCourtTypeForLevel(levelKey, levelCourtRows);
  const activeCourtIds = courts.filter((c) => c.isActive).map((c) => c.id);

  const eligibleCourtIds = activeCourtIds.filter((id) => {
    const ct = courtRows.find((c) => c.id === id)?.court_type;
    return ct === requiredType;
  });

  if (eligibleCourtIds.length === 0) {
    const types = [...new Set(activeCourtRows.map((c) => c.court_type))].join(", ");
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: `Ingen aktive baner med type «${requiredType}» for ${levelKey}. Baner har: ${types || "—"}. Tjek Opsætning → Niveau indstillinger.`,
      overflowPeriodNames: [],
    };
  }

  const baseAvailability = availabilityRowsToRegnemaskineAvailability(
    ((availRes.data ?? []) as CourtAvailabilityRow[]).map((a) => ({
      ...a,
      event_id: eventId,
    })),
  );

  const poolPeriod = periodRes.data as TournamentPeriodRow;
  const periodWin = periodWindowForScheduling(poolPeriod, baseAvailability, eligibleCourtIds);
  if (!periodWin) {
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: isAllDayPeriod(poolPeriod)
        ? "Kunne ikke aflede planlægningsvindue fra bane-tider — tjek Opsætning → Haller & baner."
        : "Puljens periode har ugyldige start-/sluttider.",
      overflowPeriodNames: [],
    };
  }

  const breaks = breakRowsToRegnemaskineBreaks(
    ((breaksRes.data ?? []) as CourtBreakRow[]).map((b) => ({
      ...b,
      event_id: eventId,
    })),
  );

  const levelRows = (levelRes.data ?? []) as Array<{
    level: string;
    match_duration_minutes: number;
    break_between_matches_minutes: number;
    rounds_per_match: number;
  }>;
  const levelRow = levelRows.find((r) => canonicalBanerLevelLabel(r.level) === levelKey);
  const timing: RoundTiming = {
    matchDurationMinutes: levelRow?.match_duration_minutes ?? 9,
    breakBetweenMatchesMinutes: levelRow?.break_between_matches_minutes ?? 1,
  };
  const roundsPerMatch = levelRow?.rounds_per_match ?? 1;
  const roundLen = roundLengthMinutes(timing);

  const poolTeamIds = new Set(poolMatchesAll.flatMap((m) => [m.team_a_id, m.team_b_id]));
  const allPoolMatchIds = new Set(poolMatchesAll.map((m) => m.id));
  const roundSlotEpochStart = schedulingEpochStartMinutes(allPeriods);

  const teamRounds = createTeamRoundTracker();
  const teamHistoryRes = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, start_time, end_time")
    .eq("event_id", eventId)
    .not("start_time", "is", null)
    .not("end_time", "is", null);

  if (!teamHistoryRes.error) {
    const scheduledForTracker: Array<{
      team_a_id: string;
      team_b_id: string;
      startMinutes: number;
      endMinutes: number;
    }> = [];
    for (const row of (teamHistoryRes.data ?? []) as Array<{
      id: string;
      team_a_id: string;
      team_b_id: string;
      start_time: string;
      end_time: string;
    }>) {
      if (matchIds.has(row.id)) continue;
      if (!poolTeamIds.has(row.team_a_id) && !poolTeamIds.has(row.team_b_id)) continue;
      const startMinutes = timeToMinutes(row.start_time);
      const endMinutes = timeToMinutes(row.end_time);
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) continue;
      scheduledForTracker.push({
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        startMinutes,
        endMinutes,
      });
    }
    seedTeamRoundTrackerFromScheduledMatches(teamRounds, scheduledForTracker);
  }

  const courtTypes = new Map<string, CourtType>();
  for (const c of courtRows) {
    courtTypes.set(c.id, c.court_type);
  }

  const existingOccupancy: OccupiedSlot[] = [];
  for (const m of (allMatchesRes.data ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string;
    end_time: string;
  }>) {
    if (matchIds.has(m.id)) continue;
    const s = timeToMinutes(m.start_time);
    const e = timeToMinutes(m.end_time);
    if (s == null || e == null || e <= s) continue;
    existingOccupancy.push({ courtId: m.court_id, startMinutes: s, endMinutes: e });
  }

  const toScheduleInputs = (rows: typeof poolMatchesAll) =>
    rows.map((m) => ({
      id: m.id,
      levelKey,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
    }));

  const externalOccupancy: OccupiedSlot[] = [];
  for (const m of (allMatchesRes.data ?? []) as Array<{
    id: string;
    court_id: string;
    start_time: string;
    end_time: string;
  }>) {
    if (allPoolMatchIds.has(m.id)) continue;
    const s = timeToMinutes(m.start_time);
    const e = timeToMinutes(m.end_time);
    if (s == null || e == null || e <= s) continue;
    externalOccupancy.push({ courtId: m.court_id, startMinutes: s, endMinutes: e });
  }

  const externalTeamSeed = createTeamRoundTracker();
  if (!teamHistoryRes.error) {
    const externalHistory: Array<{
      team_a_id: string;
      team_b_id: string;
      startMinutes: number;
      endMinutes: number;
    }> = [];
    for (const row of (teamHistoryRes.data ?? []) as Array<{
      id: string;
      team_a_id: string;
      team_b_id: string;
      start_time: string;
      end_time: string;
    }>) {
      if (allPoolMatchIds.has(row.id)) continue;
      if (!poolTeamIds.has(row.team_a_id) && !poolTeamIds.has(row.team_b_id)) continue;
      const startMinutes = timeToMinutes(row.start_time);
      const endMinutes = timeToMinutes(row.end_time);
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) continue;
      externalHistory.push({
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        startMinutes,
        endMinutes,
      });
    }
    seedTeamRoundTrackerFromScheduledMatches(externalTeamSeed, externalHistory);
  }

  const poolBase: SchedulePoolBase = {
    roundSlotEpochStartMinutes: roundSlotEpochStart,
    courtIds: eligibleCourtIds,
    courtTypes,
    levelKey,
    levelCourtRows,
    baseAvailability,
    breaks,
    timing,
    roundsPerMatch,
    existingOccupancy: externalOccupancy,
  };

  const poolInputsAll = toScheduleInputs(poolMatchesAll);
  const restAttempts = [
    teamRestMinutesBetweenMatches(roundLen),
    Math.max(0, Math.floor(roundLen / 2)),
    0,
  ];

  let assignments: ScheduleAssignment[] = [];
  let unscheduled = poolMatches.map((m) => m.id);
  let overflowPeriodNames: string[] = [];

  /** Hurtig planlægning af hele puljen (flere rækkefølger). */
  if (poolMatchesAll.length <= 30) {
    for (const rest of restAttempts) {
      const solved = schedulePoolFast(
        allPeriods,
        pool.period_id,
        poolBase,
        poolInputsAll,
        externalTeamSeed,
        rest,
      );
      if (solved && solved.assignments.length === poolMatchesAll.length) {
        assignments = solved.assignments;
        unscheduled = [];
        overflowPeriodNames = solved.overflowPeriodNames;
        break;
      }
    }
  }

  const matchesToSchedule =
    unscheduled.length > 0
      ? [...poolMatches].sort((a, b) => {
          const pressure = (m: (typeof poolMatches)[0]) =>
            Math.max(teamRounds.get(m.team_a_id) ?? -Infinity, teamRounds.get(m.team_b_id) ?? -Infinity);
          return pressure(b) - pressure(a);
        })
      : [];

  if (unscheduled.length > 0 && poolMatches.length > 0) {
    let greedyResult = scheduleMatchesWithPeriodOverflow(
      allPeriods,
      pool.period_id,
      {
        roundSlotEpochStartMinutes: roundSlotEpochStart,
        courtIds: eligibleCourtIds,
        courtTypes,
        levelKey,
        levelCourtRows,
        baseAvailability,
        breaks,
        timing,
        roundsPerMatch,
        existingOccupancy,
        teamRounds,
      },
      toScheduleInputs(matchesToSchedule),
    );
    assignments = greedyResult.assignments;
    unscheduled = greedyResult.unscheduled;
    overflowPeriodNames = greedyResult.overflowPeriodNames;

  if (unscheduled.length > 0) {
    const retryOccupancy: OccupiedSlot[] = [...existingOccupancy];
    for (const a of assignments) {
      retryOccupancy.push({
        courtId: a.courtId,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
      });
    }
    const unscheduledSet = new Set(unscheduled);
    const retryRows = matchesToSchedule.filter((m) => unscheduledSet.has(m.id));
    const retry = scheduleMatchesWithPeriodOverflow(
      allPeriods,
      pool.period_id,
      {
        roundSlotEpochStartMinutes: roundSlotEpochStart,
        courtIds: eligibleCourtIds,
        courtTypes,
        levelKey,
        levelCourtRows,
        baseAvailability,
        breaks,
        timing,
        roundsPerMatch,
        existingOccupancy: retryOccupancy,
        teamRounds,
      },
      toScheduleInputs(retryRows),
    );
    assignments = [...assignments, ...retry.assignments];
    unscheduled = retry.unscheduled;
    overflowPeriodNames = [...new Set([...overflowPeriodNames, ...retry.overflowPeriodNames])];
  }

  if (unscheduled.length > 0) {
    const relaxedOccupancy: OccupiedSlot[] = [...existingOccupancy];
    for (const a of assignments) {
      relaxedOccupancy.push({
        courtId: a.courtId,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
      });
    }
    const unscheduledSet = new Set(unscheduled);
    const relaxedRows = matchesToSchedule.filter((m) => unscheduledSet.has(m.id));
    const relaxed = scheduleMatchesWithPeriodOverflow(
      allPeriods,
      pool.period_id,
      {
        roundSlotEpochStartMinutes: roundSlotEpochStart,
        courtIds: eligibleCourtIds,
        courtTypes,
        levelKey,
        levelCourtRows,
        baseAvailability,
        breaks,
        timing,
        roundsPerMatch,
        existingOccupancy: relaxedOccupancy,
        teamRounds,
        teamRestMinutes: Math.max(0, Math.floor(roundLen / 2)),
      },
      toScheduleInputs(relaxedRows),
    );
    assignments = [...assignments, ...relaxed.assignments];
    unscheduled = relaxed.unscheduled;
    overflowPeriodNames = [...new Set([...overflowPeriodNames, ...relaxed.overflowPeriodNames])];
  }

  if (unscheduled.length > 0) {
    const lastOccupancy: OccupiedSlot[] = [...existingOccupancy];
    for (const a of assignments) {
      lastOccupancy.push({
        courtId: a.courtId,
        startMinutes: a.startMinutes,
        endMinutes: a.endMinutes,
      });
    }
    const unscheduledSet = new Set(unscheduled);
    const lastRows = matchesToSchedule.filter((m) => unscheduledSet.has(m.id));
    const lastChance = scheduleMatchesIndividually(
      allPeriods,
      pool.period_id,
      {
        roundSlotEpochStartMinutes: roundSlotEpochStart,
        courtIds: eligibleCourtIds,
        courtTypes,
        levelKey,
        levelCourtRows,
        baseAvailability,
        breaks,
        timing,
        roundsPerMatch,
        existingOccupancy: lastOccupancy,
        teamRestMinutes: 0,
      },
      toScheduleInputs(lastRows),
      lastOccupancy,
      teamRounds,
    );
    assignments = [...assignments, ...lastChance.assignments];
    unscheduled = lastChance.unscheduled;
    overflowPeriodNames = [
      ...new Set([...overflowPeriodNames, ...lastChance.overflowPeriodNames]),
    ];
  }
  }

  if (assignments.length === 0) {
    return {
      scheduled: 0,
      unscheduled: unscheduled.length || poolMatches.length,
      error:
        "Ingen kampe kunne placeres i perioden eller senere perioder. Tjek bane-kapacitet, perioder og kampvarighed under Opsætning.",
      overflowPeriodNames: [],
    };
  }

  let saved = 0;
  for (const a of assignments) {
    const start_time = minutesToTimestamptz(a.startMinutes);
    const end_time = minutesToTimestamptz(a.endMinutes);
    if (!start_time || !end_time) continue;

    const { data, error } = await supabase
      .from("matches")
      .update({
        court_id: a.courtId,
        start_time,
        end_time,
        status: "scheduled",
      })
      .eq("id", a.matchId)
      .select("id");

    if (error) {
      return {
        scheduled: saved,
        unscheduled: poolMatches.length - saved,
        error: `Kunne ikke gemme bane/tid: ${error.message}`,
        overflowPeriodNames,
      };
    }
    if (!data || data.length === 0) {
      return {
        scheduled: saved,
        unscheduled: poolMatches.length - saved,
        error:
          "Kunne ikke opdatere kampe i databasen (manglende rettigheder?). Kør migration «matches_rls» i Supabase.",
        overflowPeriodNames,
      };
    }

    saved += 1;
    await supabase.from("matches").update({ round_index: a.roundIndex }).eq("id", a.matchId);
  }

  return {
    scheduled: saved,
    unscheduled: unscheduled.length + (assignments.length - saved),
    error:
      unscheduled.length > 0
        ? `${unscheduled.length} kamp(e) kunne ikke få bane/tid (bane optaget, periode fuld eller hold skal hvile mellem egne kampe).`
        : saved < assignments.length
          ? "Nogle kampe blev planlagt men kunne ikke gemmes."
          : null,
    overflowPeriodNames,
  };
}
