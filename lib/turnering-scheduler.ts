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
import { laterPeriodsForOverflow, schedulingEpochStartMinutes } from "@/lib/period-capacity";
import { periodWindowMinutes, type TournamentPeriodRow } from "@/lib/tournament-periods";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

/**
 * Minimum full round-slots a team must sit out between two matches.
 * Example: played at 11:10 (round 0) → earliest next match at round 3 (not 11:20 or 11:30).
 */
export const MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES = 2;

export function minRoundSlotsBetweenTeamMatches(): number {
  return MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES + 1;
}

export type TeamRoundTracker = Map<string, number>;

export function createTeamRoundTracker(): TeamRoundTracker {
  return new Map();
}

export function roundSlotFromStartMinutes(
  periodStartMinutes: number,
  roundLengthMinutes: number,
  startMinutes: number,
): number {
  if (roundLengthMinutes <= 0) return 0;
  return Math.round((startMinutes - periodStartMinutes) / roundLengthMinutes);
}

export function teamsCanPlayAtRoundSlot(
  tracker: TeamRoundTracker,
  teamAId: string,
  teamBId: string,
  roundSlot: number,
  minGapSlots: number = minRoundSlotsBetweenTeamMatches(),
): boolean {
  for (const teamId of [teamAId, teamBId]) {
    const last = tracker.get(teamId);
    if (last === undefined) continue;
    if (roundSlot < last + minGapSlots) return false;
  }
  return true;
}

export function recordTeamsAtRoundSlot(
  tracker: TeamRoundTracker,
  teamAId: string,
  teamBId: string,
  roundSlot: number,
): void {
  for (const teamId of [teamAId, teamBId]) {
    const prev = tracker.get(teamId);
    tracker.set(teamId, prev === undefined ? roundSlot : Math.max(prev, roundSlot));
  }
}

export function seedTeamRoundTrackerFromScheduledMatches(
  tracker: TeamRoundTracker,
  matches: readonly { team_a_id: string; team_b_id: string; startMinutes: number }[],
  periodStartMinutes: number,
  roundLengthMinutes: number,
): void {
  for (const m of matches) {
    const slot = roundSlotFromStartMinutes(periodStartMinutes, roundLengthMinutes, m.startMinutes);
    recordTeamsAtRoundSlot(tracker, m.team_a_id, m.team_b_id, slot);
  }
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
): RegnemaskineAvailability[] {
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
  period: Pick<TournamentPeriodRow, "start_time" | "end_time">;
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
  /** Standard 3 (= 2 runders pause). Sænk ved sidste forsøg for restkampe. */
  minGapSlots?: number;
};

type SlotCandidate = {
  courtId: string;
  startMinutes: number;
  endMinutes: number;
  roundSlot: number;
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
  minGapSlots: number = minRoundSlotsBetweenTeamMatches(),
): SlotCandidate | null {
  const periodStart = periodWin.startMinutes;
  const periodEnd = periodWin.endMinutes;

  for (let t = periodStart; t + blockMinutes <= periodEnd; t += roundLen) {
    const startMinutes = t;
    const endMinutes = t + blockMinutes;
    const roundSlot = roundSlotFromStartMinutes(input.roundSlotEpochStartMinutes, roundLen, startMinutes);
    if (!teamsCanPlayAtRoundSlot(teamRounds, match.teamAId, match.teamBId, roundSlot, minGapSlots)) continue;

    const freeCourts: string[] = [];
    for (const courtId of courtOrder) {
      const avail = availabilityWindowsForCourt(courtId, input.availability);
      const courtBreaks = breaksForCourt(courtId, input.breaks);
      const playableWindows = avail
        .map((w) => intersectWindow(w, periodWin))
        .filter((w): w is { startMinutes: number; endMinutes: number } => w != null);
      if (playableWindows.length === 0) continue;
      if (isIntervalFree(courtId, startMinutes, endMinutes, occupancy, courtBreaks, playableWindows)) {
        freeCourts.push(courtId);
      }
    }

    if (freeCourts.length > 0) {
      const courtId = pickLeastBusyCourt(freeCourts, occupancy);
      return { courtId, startMinutes, endMinutes, roundSlot };
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
  const periodWin = periodWindowMinutes(input.period);
  if (!periodWin) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const roundLen = roundLengthMinutes(input.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const rpm = Math.max(1, Math.floor(input.roundsPerMatch));
  const blockMinutes = rpm * roundLen;
  const minGapSlots = input.minGapSlots ?? minRoundSlotsBetweenTeamMatches();
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
      minGapSlots,
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
    recordTeamsAtRoundSlot(teamRounds, match.teamAId, match.teamBId, slot.roundSlot);
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
  const periodWin = periodWindowMinutes(input.period);
  if (!periodWin) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const roundLen = roundLengthMinutes(input.timing);
  if (roundLen <= 0) {
    return { assignments: [], unscheduled: matches.map((m) => m.id) };
  }

  const rpm = Math.max(1, Math.floor(input.roundsPerMatch));
  const blockMinutes = rpm * roundLen;
  const minGapSlots = input.minGapSlots ?? minRoundSlotsBetweenTeamMatches();
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
      minGapSlots,
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
    recordTeamsAtRoundSlot(teamRounds, match.teamAId, match.teamBId, slot.roundSlot);
  }

  return { assignments, unscheduled };
}

/** Prefer one court for the whole pool when all matches fit; otherwise fall back to multi-court placement. */
export function scheduleMatchesInPeriod(input: SchedulePeriodContext & {
  matches: readonly ScheduleMatchInput[];
  teamRounds?: TeamRoundTracker;
}): { assignments: ScheduleAssignment[]; unscheduled: string[] } {
  const teamRounds = input.teamRounds ?? createTeamRoundTracker();
  const periodWin = periodWindowMinutes(input.period);
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

/** Planlæg i puljens periode først; flyt resterende kampe til senere perioder ved behov. */
export function scheduleMatchesWithPeriodOverflow(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
  base: Omit<SchedulePeriodContext, "period" | "availability"> & {
    baseAvailability: readonly RegnemaskineAvailability[];
    teamRounds?: TeamRoundTracker;
    minGapSlots?: number;
  },
  matches: readonly ScheduleMatchInput[],
): { assignments: ScheduleAssignment[]; unscheduled: string[]; overflowPeriodNames: string[] } {
  const tryPeriods = laterPeriodsForOverflow(periods, primaryPeriodId);
  const overflowPeriodNames: string[] = [];
  let remaining = [...matches];
  const assignments: ScheduleAssignment[] = [];
  let occupancy: OccupiedSlot[] = [...base.existingOccupancy];
  const teamRounds = base.teamRounds ?? createTeamRoundTracker();

  for (let i = 0; i < tryPeriods.length && remaining.length > 0; i += 1) {
    const period = tryPeriods[i]!;
    const periodWin = periodWindowMinutes(period);
    if (!periodWin) continue;

    const availability = availabilityForPeriodScheduling(base.courtIds, base.baseAvailability, periodWin);
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
      minGapSlots: base.minGapSlots,
      matches: remaining,
    });

    if (i > 0 && result.assignments.length > 0) {
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

  return { assignments, unscheduled: remaining.map((m) => m.id), overflowPeriodNames };
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
        .select("id, start_time, end_time")
        .eq("id", pool.period_id)
        .maybeSingle(),
      supabase
        .from("tournament_periods")
        .select("id, event_id, name, start_time, end_time, sort_order")
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

  const periodWin = periodWindowMinutes(periodRes.data as TournamentPeriodRow);
  if (!periodWin) {
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: "Puljens periode har ugyldige start-/sluttider.",
      overflowPeriodNames: [],
    };
  }

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

  const poolTeamIds = new Set(poolMatches.flatMap((m) => [m.team_a_id, m.team_b_id]));
  const roundSlotEpochStart = schedulingEpochStartMinutes(allPeriods);

  const teamRounds = createTeamRoundTracker();
  const teamHistoryRes = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, start_time")
    .eq("event_id", eventId)
    .not("start_time", "is", null);

  if (!teamHistoryRes.error) {
    const scheduledForTracker: Array<{
      team_a_id: string;
      team_b_id: string;
      startMinutes: number;
    }> = [];
    for (const row of (teamHistoryRes.data ?? []) as Array<{
      id: string;
      team_a_id: string;
      team_b_id: string;
      start_time: string;
    }>) {
      if (matchIds.has(row.id)) continue;
      if (!poolTeamIds.has(row.team_a_id) && !poolTeamIds.has(row.team_b_id)) continue;
      const startMinutes = timeToMinutes(row.start_time);
      if (startMinutes == null) continue;
      scheduledForTracker.push({
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        startMinutes,
      });
    }
    seedTeamRoundTrackerFromScheduledMatches(
      teamRounds,
      scheduledForTracker,
      roundSlotEpochStart,
      roundLen,
    );
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

  const matchesToSchedule = [...poolMatches].sort((a, b) => {
    const pressure = (m: (typeof poolMatches)[0]) =>
      Math.max(teamRounds.get(m.team_a_id) ?? -Infinity, teamRounds.get(m.team_b_id) ?? -Infinity);
    return pressure(b) - pressure(a);
  });

  const toScheduleInputs = (rows: typeof poolMatches) =>
    rows.map((m) => ({
      id: m.id,
      levelKey,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
    }));

  let { assignments, unscheduled, overflowPeriodNames } = scheduleMatchesWithPeriodOverflow(
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
        minGapSlots: 1,
      },
      toScheduleInputs(relaxedRows),
    );
    assignments = [...assignments, ...relaxed.assignments];
    unscheduled = relaxed.unscheduled;
    overflowPeriodNames = [...new Set([...overflowPeriodNames, ...relaxed.overflowPeriodNames])];
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
        ? `${unscheduled.length} kamp(e) kunne ikke få bane/tid (inkl. krav om mindst ${MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES} runders pause mellem kampe for samme hold).`
        : saved < assignments.length
          ? "Nogle kampe blev planlagt men kunne ikke gemmes."
          : null,
    overflowPeriodNames,
  };
}
