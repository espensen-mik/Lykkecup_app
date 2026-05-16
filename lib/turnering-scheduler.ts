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
): boolean {
  const minGap = minRoundSlotsBetweenTeamMatches();
  for (const teamId of [teamAId, teamBId]) {
    const last = tracker.get(teamId);
    if (last === undefined) continue;
    if (roundSlot < last + minGap) return false;
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
  const counts = new Map<string, number>();
  for (const a of availability) {
    counts.set(a.courtId, (counts.get(a.courtId) ?? 0) + 1);
  }
  const extra: RegnemaskineAvailability[] = [];
  for (const id of courtIds) {
    if ((counts.get(id) ?? 0) === 0) {
      extra.push({
        courtId: id,
        startMinutes: periodWin.startMinutes,
        endMinutes: periodWin.endMinutes,
      });
    }
  }
  return extra.length > 0 ? ([...availability, ...extra] as RegnemaskineAvailability[]) : [...availability];
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
  courtIds: readonly string[];
  courtTypes: ReadonlyMap<string, CourtType>;
  levelKey: string;
  levelCourtRows: readonly LevelCourtSettingLike[];
  availability: readonly RegnemaskineAvailability[];
  breaks: readonly RegnemaskineBreak[];
  timing: RoundTiming;
  roundsPerMatch: number;
  existingOccupancy: readonly OccupiedSlot[];
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
): SlotCandidate | null {
  const periodStart = periodWin.startMinutes;
  const periodEnd = periodWin.endMinutes;

  for (let t = periodStart; t + blockMinutes <= periodEnd; t += roundLen) {
    const startMinutes = t;
    const endMinutes = t + blockMinutes;
    const roundSlot = roundSlotFromStartMinutes(periodStart, roundLen, startMinutes);
    if (!teamsCanPlayAtRoundSlot(teamRounds, match.teamAId, match.teamBId, roundSlot)) continue;

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
  roundIndexStart: number,
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
  const occupancy: OccupiedSlot[] = [...occupancySeed];
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: string[] = [];
  let roundIndex = roundIndexStart;

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
      roundIndex,
    });
    recordTeamsAtRoundSlot(teamRounds, match.teamAId, match.teamBId, slot.roundSlot);
    roundIndex += 1;
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
  const occupancy: OccupiedSlot[] = [...occupancySeed];
  const assignments: ScheduleAssignment[] = [];
  const unscheduled: string[] = [];
  let roundIndex = 0;

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
      roundIndex,
    });
    recordTeamsAtRoundSlot(teamRounds, match.teamAId, match.teamBId, slot.roundSlot);
    roundIndex += 1;
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

export function minutesToTimestamptz(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return timeInputToTimestamptz(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)!;
}

export type AssignPoolScheduleResult = {
  scheduled: number;
  unscheduled: number;
  error: string | null;
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

  if (poolRes.error) return { scheduled: 0, unscheduled: 0, error: poolRes.error.message };
  if (!poolRes.data) return { scheduled: 0, unscheduled: 0, error: "Pulje ikke fundet." };

  const pool = poolRes.data as { id: string; level: string | null; period_id: string | null };
  if (!pool.period_id) {
    return {
      scheduled: 0,
      unscheduled: 0,
      error: "Tildel en periode til puljen under Opsætning → Perioder.",
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

  const [periodRes, matchesRes, periodPoolsRes, courtsRes, availRes, breaksRes, levelRes, levelCourtRes, allMatchesRes] =
    await Promise.all([
      supabase
        .from("tournament_periods")
        .select("id, start_time, end_time")
        .eq("id", pool.period_id)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id, team_a_id, team_b_id")
        .eq("pool_id", poolId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase.from("pools").select("id").eq("event_id", eventId).eq("period_id", pool.period_id),
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

  if (periodRes.error) return { scheduled: 0, unscheduled: 0, error: periodRes.error.message };
  if (!periodRes.data) return { scheduled: 0, unscheduled: 0, error: "Periode ikke fundet." };
  if (matchesRes.error) return { scheduled: 0, unscheduled: 0, error: matchesRes.error.message };
  if (courtsRes.error) return { scheduled: 0, unscheduled: 0, error: courtsRes.error.message };

  const poolMatches = (matchesRes.data ?? []) as Array<{
    id: string;
    team_a_id: string;
    team_b_id: string;
  }>;
  if (poolMatches.length === 0) return { scheduled: 0, unscheduled: 0, error: null };

  const matchIds = new Set(poolMatches.map((m) => m.id));

  let courtRows = (courtsRes.data ?? []) as CourtRow[];
  courtRows = courtRows.filter((c) => !c.event_id || c.event_id === eventId);

  const periodWin = periodWindowMinutes(periodRes.data as TournamentPeriodRow);
  if (!periodWin) {
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: "Puljens periode har ugyldige start-/sluttider.",
    };
  }

  const activeCourtRows = courtRows.filter((c) => c.is_active);
  if (activeCourtRows.length === 0) {
    return {
      scheduled: 0,
      unscheduled: poolMatches.length,
      error: "Ingen aktive baner — opret baner under Opsætning → Haller & baner.",
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
    };
  }

  let availability = availabilityRowsToRegnemaskineAvailability(
    ((availRes.data ?? []) as CourtAvailabilityRow[]).map((a) => ({
      ...a,
      event_id: eventId,
    })),
  );
  availability = withPeriodFallbackAvailability(eligibleCourtIds, availability, periodWin);

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

  const teamRounds = createTeamRoundTracker();
  const periodPoolIds = ((periodPoolsRes.data ?? []) as { id: string }[]).map((p) => p.id);
  if (periodPoolIds.length > 0) {
    const periodMatchesRes = await supabase
      .from("matches")
      .select("id, team_a_id, team_b_id, start_time")
      .eq("event_id", eventId)
      .in("pool_id", periodPoolIds)
      .not("start_time", "is", null);

    if (!periodMatchesRes.error) {
      const scheduledForTracker: Array<{
        team_a_id: string;
        team_b_id: string;
        startMinutes: number;
      }> = [];
      for (const row of (periodMatchesRes.data ?? []) as Array<{
        id: string;
        team_a_id: string;
        team_b_id: string;
        start_time: string;
      }>) {
        if (matchIds.has(row.id)) continue;
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
        periodWin.startMinutes,
        roundLen,
      );
    }
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

  const scheduleInput = {
    period: periodRes.data as TournamentPeriodRow,
    courtIds: eligibleCourtIds,
    courtTypes,
    levelKey,
    levelCourtRows,
    availability,
    breaks,
    timing,
    roundsPerMatch,
    existingOccupancy,
    teamRounds,
  };

  const toScheduleInputs = (rows: typeof poolMatches) =>
    rows.map((m) => ({
      id: m.id,
      levelKey,
      teamAId: m.team_a_id,
      teamBId: m.team_b_id,
    }));

  let { assignments, unscheduled } = scheduleMatchesInPeriod({
    ...scheduleInput,
    matches: toScheduleInputs(matchesToSchedule),
  });

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
    const retry = scheduleMatchesInPeriod({
      ...scheduleInput,
      matches: toScheduleInputs(retryRows),
      existingOccupancy: retryOccupancy,
    });
    assignments = [...assignments, ...retry.assignments];
    unscheduled = retry.unscheduled;
  }

  if (assignments.length === 0) {
    return {
      scheduled: 0,
      unscheduled: unscheduled.length || poolMatches.length,
      error:
        "Ingen kampe kunne placeres i perioden. Tjek periode-varighed, bane-pauser og kampvarighed under Opsætning.",
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
      };
    }
    if (!data || data.length === 0) {
      return {
        scheduled: saved,
        unscheduled: poolMatches.length - saved,
        error:
          "Kunne ikke opdatere kampe i databasen (manglende rettigheder?). Kør migration «matches_rls» i Supabase.",
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
        ? `${unscheduled.length} kamp(e) kunne ikke få bane/tid i perioden (inkl. krav om mindst ${MIN_IDLE_ROUNDS_BETWEEN_TEAM_MATCHES} runders pause mellem kampe for samme hold).`
        : saved < assignments.length
          ? "Nogle kampe blev planlagt men kunne ikke gemmes."
          : null,
  };
}
