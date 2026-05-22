import { canonicalBanerLevelLabel, formatLevelShortLabel } from "@/lib/holddannelse";
import { DEFAULT_PLAN_MATCHES_PER_TEAM } from "@/lib/lykkecup-regnemaskine";

/** Absolut loft for hold pr. pulje (sikkerhed mod utilsigtede mega-puljer). */
export const ABSOLUTE_POOL_HARD_CAP = 64;

/** @deprecated Brug `ABSOLUTE_POOL_HARD_CAP` eller `effectivePoolMaxTeams(hint)`. */
export const POOL_MAX_TEAMS = ABSOLUTE_POOL_HARD_CAP;

const POOL_NAME_NUMBER_RE = /^Pulje\s+(\d+)\s*$/i;

export type LevelSchedulePlanningRow = {
  level: string;
  plan_matches_per_team: number | null;
  plan_target_teams_per_pool?: number | null;
  plan_max_teams_per_pool?: number | null;
};

/** Næste ledige puljenavn (undgår dublet når fx Pulje 1 er slettet men Pulje 2 findes). */
export function suggestNextPoolName(existingNames: readonly string[]): string {
  let maxNum = 0;
  for (const raw of existingNames) {
    const m = POOL_NAME_NUMBER_RE.exec(raw.trim());
    if (m) maxNum = Math.max(maxNum, Number.parseInt(m[1], 10));
  }
  return `Pulje ${maxNum + 1}`;
}

export type PoolPlanningHint = {
  matchesPerTeam: number;
  /** Mål hold pr. pulje (AutoPulje og «anbefalet» i UI). */
  recommendedTeamCount: number;
  /** Valgfri hård grænse fra Opsætning; null = kun `ABSOLUTE_POOL_HARD_CAP`. */
  maxTeamsPerPool: number | null;
};

export function effectivePoolMaxTeams(hint: PoolPlanningHint): number {
  return hint.maxTeamsPerPool ?? ABSOLUTE_POOL_HARD_CAP;
}

function planMatchesPerTeamFromRow(
  row: { plan_matches_per_team: number | null } | undefined,
): number | null {
  if (
    row?.plan_matches_per_team != null &&
    Number.isFinite(row.plan_matches_per_team) &&
    row.plan_matches_per_team >= 0
  ) {
    return Math.floor(row.plan_matches_per_team);
  }
  return null;
}

function planTargetTeamsFromRow(
  row: LevelSchedulePlanningRow | undefined,
  matchesPerTeam: number,
): number {
  const t = row?.plan_target_teams_per_pool;
  if (t != null && Number.isFinite(t) && t >= 2) return Math.floor(t);
  return Math.max(2, matchesPerTeam + 1);
}

function planMaxTeamsFromRow(row: LevelSchedulePlanningRow | undefined): number | null {
  const m = row?.plan_max_teams_per_pool;
  if (m != null && Number.isFinite(m) && m >= 2) return Math.floor(m);
  return null;
}

function pickMoreSpecificScheduleRow<T extends LevelSchedulePlanningRow>(a: T, b: T): T {
  const moreSpecific =
    canonicalBanerLevelLabel(a.level).length >= canonicalBanerLevelLabel(b.level).length ? a : b;
  const other = moreSpecific === a ? b : a;
  return {
    ...moreSpecific,
    plan_matches_per_team:
      planMatchesPerTeamFromRow(moreSpecific) ?? planMatchesPerTeamFromRow(other),
    plan_target_teams_per_pool:
      moreSpecific.plan_target_teams_per_pool ?? other.plan_target_teams_per_pool,
    plan_max_teams_per_pool: moreSpecific.plan_max_teams_per_pool ?? other.plan_max_teams_per_pool,
  };
}

/**
 * Slår «TurboStars» og «TurboStars (4-17 år)» sammen til én række.
 * Ved flere gemte værdier vinder det mest specifikke niveau-navn (længste).
 */
export function normalizeScheduleRowsForPlanning<T extends LevelSchedulePlanningRow>(
  rows: readonly T[],
): T[] {
  const byShort = new Map<string, T>();
  for (const row of rows) {
    const short = formatLevelShortLabel(row.level).toLowerCase();
    if (!short || short === "ukendt niveau") continue;
    const prev = byShort.get(short);
    byShort.set(short, prev ? pickMoreSpecificScheduleRow(prev, row) : row);
  }
  return [...byShort.values()];
}

/** Find Opsætning → Kampe row even when pool/team level strings differ slightly (fx «TurboStars» vs «TurboStars (4-17 år)»). */
export function findLevelScheduleRow<T extends LevelSchedulePlanningRow>(
  levelKey: string,
  levelScheduleRows: readonly T[],
): T | undefined {
  const short = formatLevelShortLabel(levelKey).toLowerCase();
  if (!short || short === "ukendt niveau") {
    const canon = canonicalBanerLevelLabel(levelKey);
    return levelScheduleRows.find((r) => canonicalBanerLevelLabel(r.level) === canon);
  }

  const matches = levelScheduleRows.filter(
    (r) => formatLevelShortLabel(r.level).toLowerCase() === short,
  );
  if (matches.length === 0) {
    const canon = canonicalBanerLevelLabel(levelKey);
    return levelScheduleRows.find((r) => canonicalBanerLevelLabel(r.level) === canon);
  }
  return matches.reduce((acc, row) => pickMoreSpecificScheduleRow(acc, row));
}

/** Kort visning af plan fra Opsætning → Kampe (kampe/hold + puljestørrelse). */
export function formatPoolSizePlanLabel(hint: PoolPlanningHint): string {
  const target = hint.recommendedTeamCount;
  const matches = `${hint.matchesPerTeam} kampe/hold`;
  if (hint.maxTeamsPerPool != null) {
    return `${matches} · mål ${target} · maks ${hint.maxTeamsPerPool} hold/pulje`;
  }
  return `${matches} · mål ${target} hold/pulje (ingen maks sat)`;
}

export function poolPlanningHint(
  levelKey: string,
  levelScheduleRows: readonly LevelSchedulePlanningRow[],
): PoolPlanningHint {
  const row = findLevelScheduleRow(levelKey, levelScheduleRows);
  const matchesPerTeam = planMatchesPerTeamFromRow(row) ?? DEFAULT_PLAN_MATCHES_PER_TEAM;
  const recommendedTeamCount = planTargetTeamsFromRow(row, matchesPerTeam);
  const maxTeamsPerPool = planMaxTeamsFromRow(row);
  return { matchesPerTeam, recommendedTeamCount, maxTeamsPerPool };
}

/** Kampe pr. hold i en pulje med n hold (alle-mod-alle). */
export function roundRobinMatchesPerTeam(teamCount: number): number {
  if (teamCount < 2) return 0;
  return teamCount - 1;
}

export function poolTeamCountStatus(
  teamCount: number,
  hint: PoolPlanningHint,
): "empty" | "too_few" | "good" | "high" | "full" {
  const cap = effectivePoolMaxTeams(hint);
  if (teamCount === 0) return "empty";
  if (teamCount < 2) return "too_few";
  if (teamCount >= cap) return "full";
  if (teamCount > hint.recommendedTeamCount) return "high";
  if (teamCount >= hint.recommendedTeamCount - 1 && teamCount <= hint.recommendedTeamCount) return "good";
  return teamCount < hint.recommendedTeamCount ? "too_few" : "good";
}
