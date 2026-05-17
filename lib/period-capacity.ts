import type { BanerTiderBundle } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { courtTypeForLevel } from "@/lib/level-court-settings";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  computeCourtCapacities,
  conservativeRoundTimingFromSchedule,
  courtsRowsToRegnemaskineCourts,
  sumSlotsByCourtType,
  totalMatchesForLevel,
  type RegnemaskineAvailability,
} from "@/lib/lykkecup-regnemaskine";
import {
  isAllDayPeriod,
  periodWindowForScheduling,
  periodWindowMinutes,
  type PeriodsBundle,
  type PoolPeriodAssignmentRow,
  type TournamentPeriodRow,
} from "@/lib/tournament-periods";

export type PeriodCapacityHint = {
  periodId: string;
  /** Samlet bane-slots i perioden (alle banetyper). */
  totalSlots: number;
  /** Krævede runde-pladser fra tildelte puljer (estimat eller faktiske kampe). */
  requiredRounds: number;
  /** `totalSlots - requiredRounds` — negativ = sandsynlig mangel i perioden. */
  surplusRounds: number;
  assignedPoolCount: number;
  /** Kampe i periodens puljer uden bane/tid. */
  unscheduledMatches: number;
  byCourtType: Array<{ courtType: string; slots: number; requiredRounds: number; surplus: number }>;
};

function intersectWindow(
  a: { startMinutes: number; endMinutes: number },
  b: { startMinutes: number; endMinutes: number },
): { startMinutes: number; endMinutes: number } | null {
  const startMinutes = Math.max(a.startMinutes, b.startMinutes);
  const endMinutes = Math.min(a.endMinutes, b.endMinutes);
  if (endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

/** Begræns bane-tilgængelighed til et periodens tidsvindue. */
export function clipAvailabilityToPeriod(
  availability: readonly RegnemaskineAvailability[],
  courtIds: readonly string[],
  periodWin: { startMinutes: number; endMinutes: number },
): RegnemaskineAvailability[] {
  const out: RegnemaskineAvailability[] = [];
  for (const a of availability) {
    const clipped = intersectWindow(a, periodWin);
    if (clipped) out.push({ courtId: a.courtId, ...clipped });
  }
  const hasRow = new Set(out.map((a) => a.courtId));
  for (const id of courtIds) {
    if (!hasRow.has(id)) {
      out.push({
        courtId: id,
        startMinutes: periodWin.startMinutes,
        endMinutes: periodWin.endMinutes,
      });
    }
  }
  return out;
}

export function schedulingEpochStartMinutes(
  periods: readonly Pick<TournamentPeriodRow, "start_time" | "end_time" | "is_all_day" | "name">[],
): number {
  let min = 24 * 60;
  for (const p of periods) {
    const win = isAllDayPeriod(p)
      ? periodWindowForScheduling(p)
      : periodWindowMinutes(p);
    if (win) min = Math.min(min, win.startMinutes);
  }
  return min < 24 * 60 ? min : 0;
}

/** Puljens periode først, derefter andre perioder kun ved overflow (fx Eftermiddag fuld → Formiddag-huller). */
export function periodsToTryForScheduling(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
): TournamentPeriodRow[] {
  const sorted = [...periods].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      (periodWindowMinutes(a)?.startMinutes ?? 0) - (periodWindowMinutes(b)?.startMinutes ?? 0),
  );
  const primary = sorted.find((p) => p.id === primaryPeriodId);
  if (!primary) return sorted;
  /** Hele dagen: kun bane-tilgængelighed, ingen overflow til Formiddag/Eftermiddag. */
  if (isAllDayPeriod(primary)) return [primary];
  return [primary, ...sorted.filter((p) => p.id !== primaryPeriodId)];
}

/** @deprecated Brug {@link periodsToTryForScheduling} */
export function laterPeriodsForOverflow(
  periods: readonly TournamentPeriodRow[],
  primaryPeriodId: string,
): TournamentPeriodRow[] {
  return periodsToTryForScheduling(periods, primaryPeriodId);
}

type TeamRow = { pool_id: string | null; level: string | null };
type MatchRow = { pool_id: string; court_id: string | null };

function requiredRoundsForPool(
  pool: PoolPeriodAssignmentRow,
  teamCount: number,
  matchCount: number,
  levelSettings: BanerTiderBundle["levelSettings"],
): number {
  const levelKey = canonicalBanerLevelLabel(pool.level);
  const row = levelSettings.find((r) => canonicalBanerLevelLabel(r.level) === levelKey);
  const rpm = Math.max(1, Math.floor(row?.rounds_per_match ?? 1));
  const matchesPerTeam = row?.plan_matches_per_team;
  const fromPlan =
    matchesPerTeam != null && Number.isFinite(matchesPerTeam) && teamCount > 0
      ? totalMatchesForLevel(teamCount, Math.floor(matchesPerTeam)).totalMatches
      : 0;
  const totalMatches = matchCount > 0 ? matchCount : fromPlan;
  return totalMatches * rpm;
}

export function computePeriodCapacityHints(
  periodsBundle: PeriodsBundle,
  teams: readonly TeamRow[],
  matches: readonly MatchRow[],
  baner: Pick<
    BanerTiderBundle,
    "courts" | "availability" | "breaks" | "levelSettings" | "levelCourtSettings"
  >,
): PeriodCapacityHint[] {
  const { periods, pools } = periodsBundle;
  if (periods.length === 0) return [];

  const teamsByPool = new Map<string, number>();
  for (const t of teams) {
    if (!t.pool_id) continue;
    teamsByPool.set(t.pool_id, (teamsByPool.get(t.pool_id) ?? 0) + 1);
  }

  const matchesByPool = new Map<string, { total: number; unscheduled: number }>();
  for (const m of matches) {
    const cur = matchesByPool.get(m.pool_id) ?? { total: 0, unscheduled: 0 };
    cur.total += 1;
    if (!m.court_id) cur.unscheduled += 1;
    matchesByPool.set(m.pool_id, cur);
  }

  const courts = courtsRowsToRegnemaskineCourts(baner.courts);
  const activeCourtIds = courts.filter((c) => c.isActive).map((c) => c.id);
  const baseAvailability = availabilityRowsToRegnemaskineAvailability(
    baner.availability.map((a) => ({ ...a, event_id: "" })),
  );
  const breaks = breakRowsToRegnemaskineBreaks(baner.breaks.map((b) => ({ ...b, event_id: "" })));
  const timing = conservativeRoundTimingFromSchedule(baner.levelSettings);

  return periods.map((period) => {
    const periodWin = isAllDayPeriod(period)
      ? periodWindowForScheduling(period, baseAvailability, activeCourtIds)
      : periodWindowMinutes(period);
    if (!periodWin) {
      return {
        periodId: period.id,
        totalSlots: 0,
        requiredRounds: 0,
        surplusRounds: 0,
        assignedPoolCount: 0,
        unscheduledMatches: 0,
        byCourtType: [],
      };
    }

    let clippedAvail = isAllDayPeriod(period)
      ? baseAvailability.filter((a) => activeCourtIds.includes(a.courtId))
      : clipAvailabilityToPeriod(baseAvailability, activeCourtIds, periodWin);
    if (isAllDayPeriod(period) && clippedAvail.length === 0) {
      clippedAvail = activeCourtIds.map((courtId) => ({
        courtId,
        startMinutes: periodWin.startMinutes,
        endMinutes: periodWin.endMinutes,
      }));
    }
    const capRows = computeCourtCapacities(courts, clippedAvail, breaks, timing);
    const slotsByType = sumSlotsByCourtType(capRows);
    const totalSlots = slotsByType.reduce((s, r) => s + r.totalSlots, 0);

    const requiredByType = new Map<string, number>();
    let requiredRounds = 0;
    let unscheduledMatches = 0;
    const periodPools = pools.filter((p) => p.period_id === period.id);

    for (const pool of periodPools) {
      const teamCount = teamsByPool.get(pool.id) ?? 0;
      const mc = matchesByPool.get(pool.id);
      const matchCount = mc?.total ?? 0;
      unscheduledMatches += mc?.unscheduled ?? 0;
      const req = requiredRoundsForPool(pool, teamCount, matchCount, baner.levelSettings);
      requiredRounds += req;
      const courtType = courtTypeForLevel(
        canonicalBanerLevelLabel(pool.level),
        baner.levelCourtSettings,
      );
      requiredByType.set(courtType, (requiredByType.get(courtType) ?? 0) + req);
    }

    const typeSet = new Set<string>([...slotsByType.map((s) => s.courtType), ...requiredByType.keys()]);
    const byCourtType = [...typeSet].map((courtType) => {
      const slots = slotsByType.find((s) => s.courtType === courtType)?.totalSlots ?? 0;
      const req = requiredByType.get(courtType) ?? 0;
      return { courtType, slots, requiredRounds: req, surplus: slots - req };
    });

    return {
      periodId: period.id,
      totalSlots,
      requiredRounds,
      surplusRounds: totalSlots - requiredRounds,
      assignedPoolCount: periodPools.length,
      unscheduledMatches,
      byCourtType,
    };
  });
}
