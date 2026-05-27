import type { PoolPlanningHint } from "@/lib/puljer";
import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

export const TURNERING_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

export type PuljerOverviewLevel = {
  levelKey: string;
  totalTeams: number;
  poolCount: number;
  assignedTeams: number;
  unassignedTeams: number;
  poolHint: PoolPlanningHint;
};

export type TurneringsplanOverviewLevel = {
  levelKey: string;
  teamCount: number;
  poolCount: number;
};

export type TurneringLevelBundle = {
  teams: TeamRow[];
  pools: {
    id: string;
    event_id: string;
    level: string | null;
    name: string;
    sort_order: number;
    is_closed: boolean;
    period_id: string | null;
  }[];
  members: TeamMemberRow[];
  players: {
    id: string;
    name: string;
    home_club: string | null;
    age: number | null;
  }[];
  /** Fra Opsætning → Kampe (`plan_matches_per_team` pr. niveau). */
  planMatchesPerTeam: number;
  poolHint: PoolPlanningHint;
  /** False når `plan_target_teams_per_pool` / `plan_max_teams_per_pool` mangler i DB. */
  poolColumnsAvailable: boolean;
  coaches: HoldCoachRow[];
  teamCoaches: TeamCoachRow[];
  error: string | null;
};

export type MatchRow = {
  id: string;
  event_id: string;
  pool_id: string;
  team_a_id: string;
  team_b_id: string;
  court_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  created_at: string | null;
  /** Planlagt uden min. 1 rundes pause mellem holdets kampe. */
  schedule_relaxed_team_rest?: boolean;
};

export const MATCH_RELAXED_TEAM_REST_NOTICE =
  "Hold-pause ikke overholdt (min. 1 runde)";

export const MATCH_UNSCHEDULED_NOTICE = "Mangler bane og tid";

export type TurneringPlanLevelBundle = {
  /** Fra Opsætning → Kampe (`plan_matches_per_team`). */
  planMatchesPerTeam: number;
  poolHint: PoolPlanningHint;
  /** Minutter mellem kampe for samme hold (typisk = én rundes længde). */
  teamRestMinutes: number;
  pools: {
    id: string;
    event_id: string;
    level: string | null;
    name: string;
    sort_order: number;
    period_id: string | null;
  }[];
  teams: TeamRow[];
  members: TeamMemberRow[];
  players: { id: string; name: string; home_club: string | null; age: number | null }[];
  coaches: HoldCoachRow[];
  teamCoaches: TeamCoachRow[];
  matches: MatchRow[];
  courts: { id: string; name: string }[];
  periods: { id: string; name: string }[];
  error: string | null;
};

const ROUND_ROBIN_BYE = "__BYE__";

export function matchPairKey(teamAId: string, teamBId: string): string {
  return teamAId < teamBId ? `${teamAId}|${teamBId}` : `${teamBId}|${teamAId}`;
}

export type PoolMatchSyncAnalysis = {
  isSynced: boolean;
  missingCount: number;
  unexpectedCount: number;
  duplicateCount: number;
  invalidCount: number;
  /** Hold i puljen som ikke optræder i nogen genereret kamp. */
  teamsWithoutMatch: string[];
  message: string | null;
};

type TeamForPairing = { id: string; sort_order?: number; name?: string };

function sortTeamsForPairing<T extends TeamForPairing>(teams: readonly T[]): T[] {
  return [...teams].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.name ?? "").localeCompare(b.name ?? "", "da", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
}

export function analyzePoolMatchSync<T extends TeamForPairing>(
  teams: readonly T[],
  matches: readonly { team_a_id: string; team_b_id: string }[],
  maxMatchesPerTeam?: number,
): PoolMatchSyncAnalysis {
  const teamIds = new Set(teams.map((t) => t.id));
  const nameById = new Map(teams.map((t) => [t.id, t.name ?? t.id]));
  const cap = resolveMatchesPerTeamCap(teams.length, maxMatchesPerTeam);

  const actualPairCounts = new Map<string, number>();
  const matchCountByTeam = new Map<string, number>();
  let invalidCount = 0;
  const teamsInMatches = new Set<string>();

  for (const match of matches) {
    const inA = teamIds.has(match.team_a_id);
    const inB = teamIds.has(match.team_b_id);
    if (!inA && !inB) continue;
    if (match.team_a_id === match.team_b_id) {
      invalidCount += 1;
      continue;
    }
    if (inA) {
      teamsInMatches.add(match.team_a_id);
      matchCountByTeam.set(match.team_a_id, (matchCountByTeam.get(match.team_a_id) ?? 0) + 1);
    }
    if (inB) {
      teamsInMatches.add(match.team_b_id);
      matchCountByTeam.set(match.team_b_id, (matchCountByTeam.get(match.team_b_id) ?? 0) + 1);
    }
    if (inA && inB) {
      const key = matchPairKey(match.team_a_id, match.team_b_id);
      actualPairCounts.set(key, (actualPairCounts.get(key) ?? 0) + 1);
    }
  }

  let duplicateCount = 0;
  for (const count of actualPairCounts.values()) {
    if (count > 1) duplicateCount += count - 1;
  }

  const teamsUnderMin = cap != null
    ? teams.filter((t) => (matchCountByTeam.get(t.id) ?? 0) < cap).map((t) => t.id)
    : [];
  const teamsWithoutMatch = teams.filter((t) => !teamsInMatches.has(t.id)).map((t) => t.id);

  const noTeamsToSchedule = teams.length < 2;
  const hasMatches = matches.some(
    (m) => teamIds.has(m.team_a_id) || teamIds.has(m.team_b_id),
  );
  const isSynced = noTeamsToSchedule
    ? !hasMatches
    : cap != null
      ? teamsUnderMin.length === 0 && duplicateCount === 0 && invalidCount === 0
      : duplicateCount === 0 && invalidCount === 0;

  let message: string | null = null;
  if (!isSynced && teams.length >= 2) {
    if (teamsWithoutMatch.length > 0) {
      const names = teamsWithoutMatch.map((id) => nameById.get(id) ?? id).join(", ");
      message =
        teamsWithoutMatch.length === 1
          ? `${names} er ikke med i de genererede kampe — typisk fordi hold er tilføjet efter sidste generering. Generér kampe igen.`
          : `Disse hold mangler i kampprogrammet: ${names}. Generér kampe igen efter ændring af puljen.`;
    } else if (teamsUnderMin.length > 0 && cap != null) {
      const names = teamsUnderMin
        .map((id) => {
          const actual = matchCountByTeam.get(id) ?? 0;
          return `${nameById.get(id) ?? id} (${actual}/${cap})`;
        })
        .join(", ");
      message = `Hold med for få kampe: ${names}. Generér kampe igen for niveauet.`;
    } else if (duplicateCount > 0) {
      message = `${duplicateCount} dublet-kamp(e). Generér kampe igen.`;
    } else if (invalidCount > 0) {
      message = `${invalidCount} ugyldig(e) kamp(e) (hold uden for puljen). Generér kampe igen.`;
    } else {
      message = "Der er uoverensstemmelse mellem puljens hold og de genererede kampe. Generér kampe igen.";
    }
  }

  return {
    isSynced,
    missingCount: teamsUnderMin.length,
    unexpectedCount: 0,
    duplicateCount,
    invalidCount,
    teamsWithoutMatch,
    message,
  };
}

function rotateRoundRobinOrder(order: string[]): void {
  const last = order.pop();
  if (last === undefined) return;
  order.splice(1, 0, last);
}

/** Maks kampe pr. hold i en pulje (begrænset af antal modstandere). */
export function resolveMatchesPerTeamCap(
  teamCount: number,
  maxMatchesPerTeam?: number,
): number | null {
  if (teamCount < 2) return null;
  if (maxMatchesPerTeam == null || !Number.isFinite(maxMatchesPerTeam)) return null;
  return Math.max(1, Math.min(Math.floor(maxMatchesPerTeam), teamCount - 1));
}

/** @deprecated Brug min-mål-generering; ulige n×cap løses med at ét hold kan få én kamp ekstra. */
export function canAllTeamsReachMatchCap(teamCount: number, cap: number): boolean {
  if (teamCount < 2 || cap < 1) return false;
  return cap <= teamCount - 1;
}

/** Maks kampe for ét hold når vi løfter andre op til minimum (typisk mål + 1). */
export function resolveSoftMaxMatchesPerTeam(
  teamCount: number,
  targetPerTeam?: number,
): number | null {
  const minTarget = resolveMatchesPerTeamCap(teamCount, targetPerTeam);
  if (minTarget == null) return null;
  return Math.min(minTarget + 1, teamCount - 1);
}

export function resolveMatchPoolId(poolA: string, poolB: string): string {
  return poolA <= poolB ? poolA : poolB;
}

export type LevelMatchTeam = TeamForPairing & { poolId: string };

export type LevelMatchPairing = {
  teamAId: string;
  teamBId: string;
  poolId: string;
};

/** Tilføj kamp: alle hold skal mindst `minTarget` kampe; op til `softMax` for at løfte under-min hold. */
function tryAddMinTargetPairing(
  teamAId: string,
  teamBId: string,
  minTarget: number,
  softMax: number,
  matchCount: Map<string, number>,
  usedPairs: Set<string>,
  pairings: Array<{ teamAId: string; teamBId: string }>,
): boolean {
  if (teamAId === teamBId) return false;
  const key = matchPairKey(teamAId, teamBId);
  if (usedPairs.has(key)) return false;
  const countA = matchCount.get(teamAId) ?? 0;
  const countB = matchCount.get(teamBId) ?? 0;
  if (countA >= softMax || countB >= softMax) return false;
  if (countA >= minTarget && countB >= minTarget) return false;
  pairings.push({ teamAId, teamBId });
  usedPairs.add(key);
  matchCount.set(teamAId, countA + 1);
  matchCount.set(teamBId, countB + 1);
  return true;
}

function generateFullRoundRobinPairings(teamIds: readonly string[]): Array<{ teamAId: string; teamBId: string }> {
  let order = [...teamIds];
  if (order.length % 2 === 1) order = [...order, ROUND_ROBIN_BYE];

  const n = order.length;
  const pairings: Array<{ teamAId: string; teamBId: string }> = [];
  const slotOrder = [...order];

  for (let round = 0; round < n - 1; round += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      const teamAId = slotOrder[i]!;
      const teamBId = slotOrder[n - 1 - i]!;
      if (teamAId === ROUND_ROBIN_BYE || teamBId === ROUND_ROBIN_BYE) continue;
      pairings.push({ teamAId, teamBId });
    }
    if (round < n - 2) rotateRoundRobinOrder(slotOrder);
  }

  return pairings;
}

function fillUnderMinTargetPairings(
  teamIds: readonly string[],
  minTarget: number,
  softMax: number,
  matchCount: Map<string, number>,
  usedPairs: Set<string>,
  pairings: Array<{ teamAId: string; teamBId: string }>,
): void {
  const allAtMin = () => teamIds.every((id) => (matchCount.get(id) ?? 0) >= minTarget);

  let progress = true;
  while (progress && !allAtMin()) {
    progress = false;
    const underMin = teamIds
      .filter((id) => (matchCount.get(id) ?? 0) < minTarget)
      .sort(
        (a, b) =>
          (matchCount.get(a) ?? 0) - (matchCount.get(b) ?? 0) || a.localeCompare(b),
      );

    for (const teamAId of underMin) {
      const opponents = teamIds
        .filter((id) => id !== teamAId)
        .sort(
          (a, b) =>
            (matchCount.get(a) ?? 0) - (matchCount.get(b) ?? 0) || a.localeCompare(b),
        );
      for (const teamBId of opponents) {
        if (tryAddMinTargetPairing(teamAId, teamBId, minTarget, softMax, matchCount, usedPairs, pairings)) {
          progress = true;
          break;
        }
      }
      if (progress) break;
    }
  }
}

function generateMinTargetPairings(
  teamIds: readonly string[],
  targetPerTeam?: number,
): Array<{ teamAId: string; teamBId: string }> {
  const minTarget = resolveMatchesPerTeamCap(teamIds.length, targetPerTeam);
  if (minTarget == null) return generateFullRoundRobinPairings(teamIds);
  const softMax = resolveSoftMaxMatchesPerTeam(teamIds.length, targetPerTeam)!;

  const matchCount = new Map(teamIds.map((id) => [id, 0]));
  const usedPairs = new Set<string>();
  const pairings: Array<{ teamAId: string; teamBId: string }> = [];

  let order = [...teamIds];
  if (order.length % 2 === 1) order = [...order, ROUND_ROBIN_BYE];
  const n = order.length;
  const slotOrder = [...order];

  for (let round = 0; round < n - 1; round += 1) {
    if (teamIds.every((id) => (matchCount.get(id) ?? 0) >= minTarget)) break;
    for (let i = 0; i < n / 2; i += 1) {
      const teamAId = slotOrder[i]!;
      const teamBId = slotOrder[n - 1 - i]!;
      if (teamAId === ROUND_ROBIN_BYE || teamBId === ROUND_ROBIN_BYE) continue;
      tryAddMinTargetPairing(teamAId, teamBId, minTarget, softMax, matchCount, usedPairs, pairings);
    }
    if (round < n - 2) rotateRoundRobinOrder(slotOrder);
  }

  fillUnderMinTargetPairings(teamIds, minTarget, softMax, matchCount, usedPairs, pairings);
  return pairings;
}

/**
 * Round-robin med minimum `maxMatchesPerTeam` kampe pr. hold (én pulje).
 * Brug `generateLevelCappedMatches` når der kan være flere puljer på niveauet.
 */
export function generateRoundRobinMatches<T extends TeamForPairing>(
  teams: readonly T[],
  maxMatchesPerTeam?: number,
): Array<{ teamAId: string; teamBId: string }> {
  if (teams.length < 2) return [];
  const teamIds = sortTeamsForPairing(teams).map((t) => t.id);
  return generateMinTargetPairings(teamIds, maxMatchesPerTeam);
}

function addLevelPairing(
  teamAId: string,
  teamBId: string,
  poolId: string,
  minTarget: number,
  softMax: number,
  poolByTeamId: ReadonlyMap<string, string>,
  matchCount: Map<string, number>,
  usedPairs: Set<string>,
  pairings: LevelMatchPairing[],
): boolean {
  if (teamAId === teamBId) return false;
  const key = matchPairKey(teamAId, teamBId);
  if (usedPairs.has(key)) return false;
  const countA = matchCount.get(teamAId) ?? 0;
  const countB = matchCount.get(teamBId) ?? 0;
  if (countA >= softMax || countB >= softMax) return false;
  if (countA >= minTarget && countB >= minTarget) return false;
  pairings.push({
    teamAId,
    teamBId,
    poolId: poolId || resolveMatchPoolId(poolByTeamId.get(teamAId)!, poolByTeamId.get(teamBId)!),
  });
  usedPairs.add(key);
  matchCount.set(teamAId, countA + 1);
  matchCount.set(teamBId, countB + 1);
  return true;
}

function balanceLevelPairings(
  teams: readonly LevelMatchTeam[],
  minTarget: number,
  softMax: number,
  poolByTeamId: ReadonlyMap<string, string>,
  matchCount: Map<string, number>,
  usedPairs: Set<string>,
  pairings: LevelMatchPairing[],
  preferCrossPool: boolean,
): void {
  let progress = true;
  while (progress) {
    progress = false;
    const underMin = teams
      .map((t) => t.id)
      .filter((id) => (matchCount.get(id) ?? 0) < minTarget)
      .sort(
        (a, b) =>
          (matchCount.get(a) ?? 0) - (matchCount.get(b) ?? 0) || a.localeCompare(b),
      );

    if (underMin.length === 0) break;

    let best: { a: string; b: string; crossPool: boolean } | null = null;
    for (const a of underMin) {
      const opponents = teams
        .map((t) => t.id)
        .filter((id) => id !== a)
        .sort(
          (x, y) =>
            (matchCount.get(x) ?? 0) - (matchCount.get(y) ?? 0) || x.localeCompare(y),
        );
      for (const b of opponents) {
        const key = matchPairKey(a, b);
        if (usedPairs.has(key)) continue;
        const countA = matchCount.get(a) ?? 0;
        const countB = matchCount.get(b) ?? 0;
        if (countA >= softMax || countB >= softMax) continue;
        if (countA >= minTarget && countB >= minTarget) continue;
        const crossPool = poolByTeamId.get(a) !== poolByTeamId.get(b);
        if (!best) {
          best = { a, b, crossPool };
          continue;
        }
        if (preferCrossPool && crossPool && !best.crossPool) {
          best = { a, b, crossPool };
          continue;
        }
        if (best.crossPool === crossPool) {
          const score = countA + countB;
          const bestScore = (matchCount.get(best.a) ?? 0) + (matchCount.get(best.b) ?? 0);
          if (score < bestScore) best = { a, b, crossPool };
        }
      }
    }

    if (!best) break;
    if (
      addLevelPairing(
        best.a,
        best.b,
        resolveMatchPoolId(poolByTeamId.get(best.a)!, poolByTeamId.get(best.b)!),
        minTarget,
        softMax,
        poolByTeamId,
        matchCount,
        usedPairs,
        pairings,
      )
    ) {
      progress = true;
    }
  }
}

/**
 * Generér kampe for hele et niveau: minimum `maxMatchesPerTeam` for hvert hold.
 * Ved ulige paritet kan enkelte hold få én kamp ekstra (aldrig færre end målet).
 */
export function generateLevelCappedMatches(
  teams: readonly LevelMatchTeam[],
  maxMatchesPerTeam?: number,
): LevelMatchPairing[] {
  if (teams.length < 2) return [];

  const sortedTeams = sortTeamsForPairing(teams);
  const minTarget = resolveMatchesPerTeamCap(sortedTeams.length, maxMatchesPerTeam);
  if (minTarget == null) {
    const poolByTeamId = new Map(sortedTeams.map((t) => [t.id, t.poolId]));
    return generateFullRoundRobinPairings(sortedTeams.map((t) => t.id)).map((p) => ({
      ...p,
      poolId: resolveMatchPoolId(poolByTeamId.get(p.teamAId)!, poolByTeamId.get(p.teamBId)!),
    }));
  }

  const softMax = resolveSoftMaxMatchesPerTeam(sortedTeams.length, maxMatchesPerTeam)!;
  const poolByTeamId = new Map(sortedTeams.map((t) => [t.id, t.poolId]));
  const matchCount = new Map(sortedTeams.map((t) => [t.id, 0]));
  const usedPairs = new Set<string>();
  const pairings: LevelMatchPairing[] = [];

  const teamsByPool = new Map<string, LevelMatchTeam[]>();
  for (const team of sortedTeams) {
    const list = teamsByPool.get(team.poolId) ?? [];
    list.push(team);
    teamsByPool.set(team.poolId, list);
  }

  for (const poolTeams of teamsByPool.values()) {
    if (poolTeams.length < 2) continue;
    const poolIds = sortTeamsForPairing(poolTeams).map((t) => t.id);
    const poolMin = resolveMatchesPerTeamCap(poolIds.length, maxMatchesPerTeam)!;
    const poolSoftMax = resolveSoftMaxMatchesPerTeam(poolIds.length, maxMatchesPerTeam)!;
    for (const pairing of generateMinTargetPairings(poolIds, maxMatchesPerTeam)) {
      addLevelPairing(
        pairing.teamAId,
        pairing.teamBId,
        poolByTeamId.get(pairing.teamAId)!,
        poolMin,
        poolSoftMax,
        poolByTeamId,
        matchCount,
        usedPairs,
        pairings,
      );
    }
  }

  balanceLevelPairings(sortedTeams, minTarget, softMax, poolByTeamId, matchCount, usedPairs, pairings, true);

  return pairings;
}

/** Ekstra kampe på tværs af puljer for at løfte hold op til minimum (uden at slette eksisterende). */
export function computeLevelBalanceAdditions(
  teams: readonly LevelMatchTeam[],
  existingMatches: readonly { team_a_id: string; team_b_id: string }[],
  maxMatchesPerTeam?: number,
): LevelMatchPairing[] {
  if (teams.length < 2) return [];
  const sortedTeams = sortTeamsForPairing(teams);
  const minTarget = resolveMatchesPerTeamCap(sortedTeams.length, maxMatchesPerTeam);
  if (minTarget == null) return [];
  const softMax = resolveSoftMaxMatchesPerTeam(sortedTeams.length, maxMatchesPerTeam)!;

  const teamIds = new Set(sortedTeams.map((t) => t.id));
  const poolByTeamId = new Map(sortedTeams.map((t) => [t.id, t.poolId]));
  const matchCount = new Map(sortedTeams.map((t) => [t.id, 0]));
  const usedPairs = new Set<string>();
  const additions: LevelMatchPairing[] = [];

  for (const match of existingMatches) {
    if (!teamIds.has(match.team_a_id) && !teamIds.has(match.team_b_id)) continue;
    if (match.team_a_id === match.team_b_id) continue;
    const key = matchPairKey(match.team_a_id, match.team_b_id);
    usedPairs.add(key);
    if (teamIds.has(match.team_a_id)) {
      matchCount.set(match.team_a_id, (matchCount.get(match.team_a_id) ?? 0) + 1);
    }
    if (teamIds.has(match.team_b_id)) {
      matchCount.set(match.team_b_id, (matchCount.get(match.team_b_id) ?? 0) + 1);
    }
  }

  balanceLevelPairings(sortedTeams, minTarget, softMax, poolByTeamId, matchCount, usedPairs, additions, true);
  return additions;
}

/** Forventet kampe når alle hold skal have mindst `maxMatchesPerTeam` (én kan få +1 ved ulige paritet). */
export function plannedPoolMatchCount(teamCount: number, maxMatchesPerTeam?: number): number {
  if (teamCount < 2) return 0;
  const cap = resolveMatchesPerTeamCap(teamCount, maxMatchesPerTeam);
  if (cap == null) {
    return (teamCount * (teamCount - 1)) / 2;
  }
  return Math.ceil((teamCount * cap) / 2);
}

/** Forventet kampe når alle hold på niveauet skal have præcis cap kampe. */
export function plannedLevelMatchCount(teamCount: number, maxMatchesPerTeam?: number): number {
  return plannedPoolMatchCount(teamCount, maxMatchesPerTeam);
}

export type TurneringDashboardLevelStats = {
  levelKey: string;
  playerCount: number;
  teamCount: number;
  poolCount: number;
  pooledTeams: number;
  unpooledTeams: number;
  teamPooledPct: number;
  matchesGenerated: number;
  matchesScheduled: number;
  expectedMatches: number;
  /** Genererede kampe i forhold til forventet (Opsætning → Kampe). */
  matchCoveragePct: number;
  /** Kampe med bane og tid i forhold til genererede. */
  matchScheduledPct: number;
};

export type TurneringDashboardOverview = {
  levels: TurneringDashboardLevelStats[];
  totals: {
    playerCount: number;
    teamCount: number;
    poolCount: number;
    pooledTeams: number;
    matchesGenerated: number;
    matchesScheduled: number;
    expectedMatches: number;
    poolsReadyForMatches: number;
  };
  error: string | null;
};
