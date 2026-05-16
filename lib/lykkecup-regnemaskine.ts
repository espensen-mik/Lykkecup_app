import type { CourtAvailabilityRow, CourtBreakRow, CourtRow, LevelCourtSettingLike } from "@/lib/baner-tider";
import { compareCourtTypes, timeToMinutes } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { courtTypeForLevel, defaultRoundsPerMatchForLevel } from "@/lib/level-court-settings";

/** Standard kampe pr. hold når DB-felt er null. */
export const DEFAULT_PLAN_MATCHES_PER_TEAM = 5;

export type LevelPlanPersisted = {
  level: string;
  plan_matches_per_team: number | null;
  rounds_per_match?: number | null;
};

/** Gemte kampe/hold pr. niveau (kun rækker med værdi i DB — ingen standard-5). */
export function planMatchesByLevelFromScheduleRows(
  rows: readonly { level: string; plan_matches_per_team: number | null }[],
): Record<string, number> {
  const merged = new Map<string, number | null>();
  for (const row of rows) {
    const key = canonicalBanerLevelLabel(row.level);
    const prev = merged.get(key);
    const next = row.plan_matches_per_team;
    merged.set(key, prev ?? next ?? null);
  }
  const out: Record<string, number> = {};
  for (const [key, value] of merged) {
    if (value != null && Number.isFinite(value) && value >= 0) {
      out[key] = Math.floor(value);
    }
  }
  return out;
}

/** Forventet kampe/hold for et niveau — null hvis ikke gemt under Opsætning → Kampe. */
export function resolvePlanMatchesPerTeam(
  level: string | null | undefined,
  planMatchesByLevel: Record<string, number>,
): number | null {
  if (level == null || String(level).trim() === "") return null;
  return planMatchesByLevel[canonicalBanerLevelLabel(String(level))] ?? null;
}

/**
 * LykkeCup Regnemaskine — pure planning math (no I/O).
 *
 * ## Spreadsheet alignment (demand vs supply)
 *
 * Typical tournament planning sheets compare:
 * - **Demand:** how many matches (or “runde-pladser”) each age level needs, derived from
 *   player counts and assumed roster size and “kampe pr. hold”.
 * - **Supply:** how many discrete **slots** you can run on courts of each size, derived from
 *   hall opening hours, pauses, and the length of one “runde” (kamp + omskiftning).
 *
 * This module implements the same structure so UI/tests can stay deterministic.
 *
 * ### Demand (per niveau)
 *
 * 1. **Planlagte hold** `T = ceil(P / S)`
 *    - `P` = registered players at the level (your sheet’s “spillere”).
 *    - `S` = **target players per team** (planning average; not a hard roster cap).
 *    - Spreadsheet equivalent: divide player total by desired average squad size and round up.
 *
 * 2. **Kampe i alt for niveauet** `M = (T × K) / 2`
 *    - `K` = **matches per team** (your “Antal kampe” per hold / pulje-fase).
 *    - Each undirected match contributes **one** to each of two teams’ match counts, so total
 *      edges in a simple graph is `T×K / 2`.
 *    - **Feasibility:** `T×K` should be even for a perfect balanced schedule. If odd, we still
 *      show `ceil(T×K / 2)` as a planning estimate and flag `parityOk: false` (soft warning).
 *
 * ### Supply (per bane / banetype)
 *
 * 3. **Rundelængde** `R = D + B`
 *    - `D` = match duration (minutes).
 *    - `B` = break/transition between matches (minutes).
 *    - One **slot** is one court occupied for one round of length `R`.
 *
 * 4. **Spilletid pr. bane** = sum of availability window lengths **minus** breaks that fall
 *    inside those windows (same idea as “træk pauser fra åbningstid” in a sheet).
 *
 * 5. **Kapacitet i slots** `C = floor(spilletid_minutter / R)`
 *    - Conservative: partial trailing time that cannot fit another full round does not count.
 *    - Aggregate **per `court_type`** by summing `C` over active courts of that type.
 *
 * ### Balance (surplus / deficit)
 *
 * 6. Map each level to a **court type bucket** (same string as `courts.court_type`: `mini` /
 *    `kort` / `stor`). Sum **required matches** `M` for all
 *    levels mapped to bucket `b`. Then:
 *    - `surplus_b = C_b − Σ M_level→b`
 *    - Positive ⇒ idle capacity; negative ⇒ not enough court-slots at that size for the plan.
 *
 * Note: this compares **match count** to **slot count** under the assumption **one match uses
 * exactly one court for one round** (standard league slot). Formats that need consecutive
 * rounds (e.g. halves) should multiply demand upstream or extend the model later.
 */

/** Minutes from midnight; reuse semantics from `timeToMinutes` in `lib/baner-tider.ts`. */
export type MinutesFromMidnight = number;

export type TimeWindow = {
  startMinutes: MinutesFromMidnight;
  endMinutes: MinutesFromMidnight;
};

export type CourtBreakWindow = TimeWindow;

export type RegnemaskineCourt = {
  id: string;
  /** Matches DB `courts.court_type` (`mini` | `kort` | `stor`). */
  courtType: string;
  isActive: boolean;
};

export type RegnemaskineAvailability = {
  courtId: string;
  startMinutes: MinutesFromMidnight;
  endMinutes: MinutesFromMidnight;
};

export type RegnemaskineBreak = {
  courtId: string;
  startMinutes: MinutesFromMidnight;
  endMinutes: MinutesFromMidnight;
};

export type RegnemaskineLevelPlan = {
  /** Normalized level key, e.g. from `normalizeLevelKey`. */
  level: string;
  playerCount: number;
  /** Faktiske hold fra Holddannelse. */
  teamCount: number;
  matchesPerTeam: number;
  /** På hinanden følgende runder (kampvarighed + pause) én kamp bruger — typisk 2 for ROCK halvlege. */
  roundsPerMatch: number;
  /** Court-size bucket this level’s matches should occupy (same as court rows). */
  courtType: string;
};

export type RoundTiming = {
  matchDurationMinutes: number;
  breakBetweenMatchesMinutes: number;
};

export type LevelDemandRow = RegnemaskineLevelPlan & {
  totalMatches: number;
  /** `totalMatches * roundsPerMatch` — runder der skal bookes på baner. */
  requiredRounds: number;
  /** `true` when `teamCount * matchesPerTeam` is even (required for equal integer degrees). */
  parityOk: boolean;
};

export type CourtCapacityRow = {
  courtId: string;
  courtType: string;
  playableMinutes: number;
  roundLengthMinutes: number;
  slots: number;
};

export type CourtTypeCapacityRow = {
  courtType: string;
  totalSlots: number;
};

export type CourtTypeBalanceRow = {
  courtType: string;
  /** Samlet antal runde-pladser (baner × runder) for denne banetype. */
  capacityRounds: number;
  /** Kampe allerede tildelt en bane af denne type (én kamp = én runde). */
  usedRounds: number;
  /** `capacityRounds - usedRounds` */
  remainingRounds: number;
  requiredMatches: number;
  /** Runder behov (kampe × runder pr. kamp). */
  requiredRounds: number;
  /** `capacityRounds - requiredRounds` — negativ = mangler kapacitet til planen. */
  surplus: number;
};

export type RegnemaskineSnapshot = {
  roundLengthMinutes: number;
  levels: LevelDemandRow[];
  courts: CourtCapacityRow[];
  byCourtType: CourtTypeBalanceRow[];
};

const EPS = 1e-9;

function clampOverlap(start: number, end: number, segStart: number, segEnd: number): number {
  const s = Math.max(start, segStart);
  const e = Math.min(end, segEnd);
  const len = e - s;
  return len > EPS ? len : 0;
}

/** Length of `[start,end)` minus intersections with half-open break intervals `[bs,be)`. */
export function playableMinutesInWindow(
  window: TimeWindow,
  breaksSorted: readonly CourtBreakWindow[],
): number {
  const { startMinutes: w0, endMinutes: w1 } = window;
  if (!(w1 > w0)) return 0;
  let play = w1 - w0;
  for (const b of breaksSorted) {
    play -= clampOverlap(w0, w1, b.startMinutes, b.endMinutes);
  }
  return Math.max(0, play);
}

export function roundLengthMinutes(timing: RoundTiming): number {
  const d = timing.matchDurationMinutes;
  const b = timing.breakBetweenMatchesMinutes;
  if (!Number.isFinite(d) || !Number.isFinite(b)) return 0;
  const sum = d + b;
  return sum > 0 ? sum : 0;
}

export function plannedTeams(playerCount: number, targetPlayersPerTeam: number): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) return 0;
  if (!Number.isFinite(targetPlayersPerTeam) || targetPlayersPerTeam <= 0) return 0;
  return Math.ceil(playerCount / targetPlayersPerTeam);
}

/**
 * Total matches for a level given planning teams and per-team match target.
 * Returns `{ totalMatches: 0, parityOk: true }` when inputs are invalid or teams = 0.
 */
export function totalMatchesForLevel(
  plannedTeamCount: number,
  matchesPerTeam: number,
): { totalMatches: number; parityOk: boolean } {
  if (!Number.isFinite(plannedTeamCount) || plannedTeamCount <= 0) {
    return { totalMatches: 0, parityOk: true };
  }
  if (!Number.isFinite(matchesPerTeam) || matchesPerTeam < 0) {
    return { totalMatches: 0, parityOk: true };
  }
  const product = plannedTeamCount * matchesPerTeam;
  const parityOk = product % 2 === 0;
  /** Planning estimate: each kamp bruger to hold → ceil(T×K/2) også når T×K er ulige. */
  const totalMatches = Math.ceil(product / 2);
  return { totalMatches, parityOk };
}

export function slotsFromPlayableMinutes(playableMinutes: number, roundLengthMinutes: number): number {
  if (!Number.isFinite(playableMinutes) || playableMinutes <= 0) return 0;
  if (!Number.isFinite(roundLengthMinutes) || roundLengthMinutes <= 0) return 0;
  return Math.floor(playableMinutes / roundLengthMinutes);
}

function breaksForCourtSorted(courtId: string, breaks: readonly RegnemaskineBreak[]): CourtBreakWindow[] {
  return breaks
    .filter((b) => b.courtId === courtId)
    .map((b) => ({ startMinutes: b.startMinutes, endMinutes: b.endMinutes }))
    .filter((b) => b.endMinutes > b.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

function availabilityForCourt(courtId: string, availability: readonly RegnemaskineAvailability[]): TimeWindow[] {
  return availability
    .filter((a) => a.courtId === courtId)
    .map((a) => ({ startMinutes: a.startMinutes, endMinutes: a.endMinutes }))
    .filter((w) => w.endMinutes > w.startMinutes);
}

/**
 * Sum playable minutes for one court across all availability rows, subtracting breaks per window.
 */
export function playableMinutesForCourt(
  courtId: string,
  availability: readonly RegnemaskineAvailability[],
  breaks: readonly RegnemaskineBreak[],
): number {
  const windows = availabilityForCourt(courtId, availability);
  if (windows.length === 0) return 0;
  const br = breaksForCourtSorted(courtId, breaks);
  let total = 0;
  for (const w of windows) {
    total += playableMinutesInWindow(w, br);
  }
  return total;
}

export function computeCourtCapacities(
  courts: readonly RegnemaskineCourt[],
  availability: readonly RegnemaskineAvailability[],
  breaks: readonly RegnemaskineBreak[],
  timing: RoundTiming,
): CourtCapacityRow[] {
  const R = roundLengthMinutes(timing);
  const rows: CourtCapacityRow[] = [];
  for (const c of courts) {
    if (!c.isActive) {
      rows.push({ courtId: c.id, courtType: c.courtType, playableMinutes: 0, roundLengthMinutes: R, slots: 0 });
      continue;
    }
    const playable = playableMinutesForCourt(c.id, availability, breaks);
    const slots = slotsFromPlayableMinutes(playable, R);
    rows.push({
      courtId: c.id,
      courtType: c.courtType,
      playableMinutes: playable,
      roundLengthMinutes: R,
      slots,
    });
  }
  return rows;
}

export function sumSlotsByCourtType(rows: readonly CourtCapacityRow[]): CourtTypeCapacityRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.courtType, (map.get(r.courtType) ?? 0) + r.slots);
  }
  return [...map.entries()]
    .map(([courtType, totalSlots]) => ({ courtType, totalSlots }))
    .sort((a, b) => compareCourtTypes(a.courtType, b.courtType));
}

export function computeLevelDemands(levels: readonly RegnemaskineLevelPlan[]): LevelDemandRow[] {
  return levels.map((lvl) => {
    const teams = Math.max(0, Math.floor(lvl.teamCount));
    const rpm = Math.max(1, Math.floor(lvl.roundsPerMatch));
    const { totalMatches, parityOk } = totalMatchesForLevel(teams, lvl.matchesPerTeam);
    return {
      ...lvl,
      teamCount: teams,
      roundsPerMatch: rpm,
      totalMatches,
      requiredRounds: totalMatches * rpm,
      parityOk,
    };
  });
}

/** Summer brugte runder pr. banetype ud fra planlagte kampe på baner. */
export function sumRoundsUsedByCourtType(
  courtRows: readonly CourtCapacityRow[],
  scheduledByCourtId: Readonly<Record<string, number>>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of courtRows) {
    const used = scheduledByCourtId[row.courtId] ?? 0;
    if (used <= 0) continue;
    map.set(row.courtType, (map.get(row.courtType) ?? 0) + used);
  }
  return map;
}

export function sumRequiredMatchesByCourtType(rows: readonly LevelDemandRow[]): CourtTypeCapacityRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.courtType, (map.get(r.courtType) ?? 0) + r.totalMatches);
  }
  return [...map.entries()]
    .map(([courtType, totalSlots]) => ({ courtType, totalSlots }))
    .sort((a, b) => compareCourtTypes(a.courtType, b.courtType));
}

export function sumRequiredRoundsByCourtType(rows: readonly LevelDemandRow[]): CourtTypeCapacityRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.courtType, (map.get(r.courtType) ?? 0) + r.requiredRounds);
  }
  return [...map.entries()]
    .map(([courtType, totalSlots]) => ({ courtType, totalSlots }))
    .sort((a, b) => compareCourtTypes(a.courtType, b.courtType));
}

/**
 * Full snapshot: per-court slots, per-level demand, and surplus/deficit per court type.
 */
export function computeRegnemaskineSnapshot(
  courts: readonly RegnemaskineCourt[],
  availability: readonly RegnemaskineAvailability[],
  breaks: readonly RegnemaskineBreak[],
  timing: RoundTiming,
  levels: readonly RegnemaskineLevelPlan[],
  scheduledByCourtId: Readonly<Record<string, number>> = {},
): RegnemaskineSnapshot {
  const courtRows = computeCourtCapacities(courts, availability, breaks, timing);
  const levelRows = computeLevelDemands(levels);
  const capByType = sumSlotsByCourtType(courtRows);
  const demandByType = sumRequiredMatchesByCourtType(levelRows);
  const demandRoundsByType = sumRequiredRoundsByCourtType(levelRows);
  const usedByType = sumRoundsUsedByCourtType(courtRows, scheduledByCourtId);
  const typeSet = new Set<string>();
  for (const c of capByType) typeSet.add(c.courtType);
  for (const d of demandByType) typeSet.add(d.courtType);
  for (const t of usedByType.keys()) typeSet.add(t);
  const byCourtType: CourtTypeBalanceRow[] = [...typeSet].sort(compareCourtTypes).map((courtType) => {
    const capacityRounds = capByType.find((x) => x.courtType === courtType)?.totalSlots ?? 0;
    const usedRounds = usedByType.get(courtType) ?? 0;
    const requiredMatches = demandByType.find((x) => x.courtType === courtType)?.totalSlots ?? 0;
    const requiredRounds = demandRoundsByType.find((x) => x.courtType === courtType)?.totalSlots ?? 0;
    return {
      courtType,
      capacityRounds,
      usedRounds,
      remainingRounds: capacityRounds - usedRounds,
      requiredMatches,
      requiredRounds,
      surplus: capacityRounds - requiredRounds,
    };
  });
  return {
    roundLengthMinutes: roundLengthMinutes(timing),
    levels: levelRows,
    courts: courtRows,
    byCourtType,
  };
}

/** Kombiner hold/spillertal fra Holddannelse, gemte kampe/hold og niveau→banetype. */
export function buildRegnemaskineLevelPlans(
  levels: readonly { levelKey: string; playerCount: number; teamCount: number }[],
  levelScheduleRows: readonly (LevelPlanPersisted & { rounds_per_match?: number | null })[],
  defaultMatchesPerTeam: number,
  levelCourtRows: readonly LevelCourtSettingLike[],
): RegnemaskineLevelPlan[] {
  const byLevel = new Map<string, LevelPlanPersisted & { rounds_per_match?: number | null }>();
  for (const r of levelScheduleRows) {
    byLevel.set(canonicalBanerLevelLabel(r.level), r);
  }
  return levels.map((l) => {
    const row = byLevel.get(canonicalBanerLevelLabel(l.levelKey));
    const matchesPerTeam =
      row != null &&
      row.plan_matches_per_team != null &&
      Number.isFinite(row.plan_matches_per_team) &&
      row.plan_matches_per_team >= 0
        ? Math.floor(row.plan_matches_per_team)
        : defaultMatchesPerTeam;
    const roundsPerMatch =
      row != null &&
      row.rounds_per_match != null &&
      Number.isFinite(row.rounds_per_match) &&
      row.rounds_per_match >= 1
        ? Math.min(4, Math.floor(row.rounds_per_match))
        : defaultRoundsPerMatchForLevel(l.levelKey);
    return {
      level: l.levelKey,
      playerCount: l.playerCount,
      teamCount: l.teamCount,
      matchesPerTeam,
      roundsPerMatch,
      courtType: courtTypeForLevel(l.levelKey, levelCourtRows),
    };
  });
}

export function courtsRowsToRegnemaskineCourts(courts: readonly CourtRow[]): RegnemaskineCourt[] {
  return courts.map((c) => ({
    id: c.id,
    courtType: c.court_type,
    isActive: c.is_active,
  }));
}

export function availabilityRowsToRegnemaskineAvailability(
  rows: readonly CourtAvailabilityRow[],
): RegnemaskineAvailability[] {
  const out: RegnemaskineAvailability[] = [];
  for (const a of rows) {
    const s = timeToMinutes(a.start_time);
    const e = timeToMinutes(a.end_time);
    if (s == null || e == null || e <= s) continue;
    out.push({ courtId: a.court_id, startMinutes: s, endMinutes: e });
  }
  return out;
}

export function breakRowsToRegnemaskineBreaks(rows: readonly CourtBreakRow[]): RegnemaskineBreak[] {
  const out: RegnemaskineBreak[] = [];
  for (const b of rows) {
    const s = timeToMinutes(b.start_time);
    const e = timeToMinutes(b.end_time);
    if (s == null || e == null || e <= s) continue;
    out.push({ courtId: b.court_id, startMinutes: s, endMinutes: e });
  }
  return out;
}

/**
 * Længste rundelængde blandt niveauer — konservativ kapacitet (færre slots end med kortere runder).
 */
export function conservativeRoundTimingFromSchedule(
  rows: readonly { match_duration_minutes: number; break_between_matches_minutes: number }[],
): RoundTiming {
  const fallback: RoundTiming = { matchDurationMinutes: 45, breakBetweenMatchesMinutes: 5 };
  if (rows.length === 0) return fallback;
  let best = fallback;
  let maxLen = 0;
  for (const r of rows) {
    const d = r.match_duration_minutes;
    const b = r.break_between_matches_minutes;
    if (!(Number.isFinite(d) && d >= 1 && Number.isFinite(b) && b >= 0)) continue;
    const len = d + b;
    if (len > maxLen) {
      maxLen = len;
      best = { matchDurationMinutes: d, breakBetweenMatchesMinutes: b };
    }
  }
  return best;
}
