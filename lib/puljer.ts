import { canonicalBanerLevelLabel, formatLevelShortLabel } from "@/lib/holddannelse";
import { DEFAULT_PLAN_MATCHES_PER_TEAM } from "@/lib/lykkecup-regnemaskine";

/** Maks. hold pr. pulje (kapacitet i AutoPulje). */
export const POOL_MAX_TEAMS = 6;

const POOL_NAME_NUMBER_RE = /^Pulje\s+(\d+)\s*$/i;

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
  /** Hold i pulje så hvert hold ca. får `matchesPerTeam` kampe ved alle-mod-alle (n−1 = K → n = K+1). */
  recommendedTeamCount: number;
};

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

function pickMoreSpecificScheduleRow<T extends { level: string; plan_matches_per_team: number | null }>(
  a: T,
  b: T,
): T {
  const aVal = planMatchesPerTeamFromRow(a);
  const bVal = planMatchesPerTeamFromRow(b);
  if (aVal != null && bVal != null) {
    return canonicalBanerLevelLabel(a.level).length >= canonicalBanerLevelLabel(b.level).length ? a : b;
  }
  if (bVal != null) return b;
  if (aVal != null) return a;
  return canonicalBanerLevelLabel(a.level).length >= canonicalBanerLevelLabel(b.level).length ? a : b;
}

/**
 * Slår «TurboStars» og «TurboStars (4-17 år)» sammen til én række.
 * Ved flere gemte værdier vinder det mest specifikke niveau-navn (længste).
 */
export function normalizeScheduleRowsForPlanning<T extends { level: string; plan_matches_per_team: number | null }>(
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
export function findLevelScheduleRow<T extends { level: string; plan_matches_per_team: number | null }>(
  levelKey: string,
  levelScheduleRows: readonly T[],
): T | undefined {
  const canon = canonicalBanerLevelLabel(levelKey);
  const exact = levelScheduleRows.find((r) => canonicalBanerLevelLabel(r.level) === canon);
  if (planMatchesPerTeamFromRow(exact) != null) return exact;

  const short = formatLevelShortLabel(levelKey).toLowerCase();
  if (!short || short === "ukendt niveau") return exact;

  const normalized = normalizeScheduleRowsForPlanning(levelScheduleRows);
  const merged = normalized.find((r) => formatLevelShortLabel(r.level).toLowerCase() === short);
  if (merged) return merged;

  return exact;
}

export function poolPlanningHint(
  levelKey: string,
  levelScheduleRows: readonly { level: string; plan_matches_per_team: number | null }[],
): PoolPlanningHint {
  const row = findLevelScheduleRow(levelKey, levelScheduleRows);
  const matchesPerTeam = planMatchesPerTeamFromRow(row) ?? DEFAULT_PLAN_MATCHES_PER_TEAM;
  const recommendedTeamCount = Math.min(
    POOL_MAX_TEAMS,
    Math.max(2, matchesPerTeam + 1),
  );
  return { matchesPerTeam, recommendedTeamCount };
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
  if (teamCount === 0) return "empty";
  if (teamCount < 2) return "too_few";
  if (teamCount >= POOL_MAX_TEAMS) return "full";
  if (teamCount > hint.recommendedTeamCount) return "high";
  if (teamCount >= hint.recommendedTeamCount - 1 && teamCount <= hint.recommendedTeamCount) return "good";
  return teamCount < hint.recommendedTeamCount ? "too_few" : "good";
}
