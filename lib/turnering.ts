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

  const expected = new Set(
    generateRoundRobinMatches([...teams], maxMatchesPerTeam).map((m) =>
      matchPairKey(m.teamAId, m.teamBId),
    ),
  );

  const actualPairCounts = new Map<string, number>();
  let invalidCount = 0;
  const teamsInMatches = new Set<string>();

  for (const match of matches) {
    if (!teamIds.has(match.team_a_id) || !teamIds.has(match.team_b_id) || match.team_a_id === match.team_b_id) {
      invalidCount += 1;
      continue;
    }
    teamsInMatches.add(match.team_a_id);
    teamsInMatches.add(match.team_b_id);
    const key = matchPairKey(match.team_a_id, match.team_b_id);
    actualPairCounts.set(key, (actualPairCounts.get(key) ?? 0) + 1);
  }

  let duplicateCount = 0;
  for (const count of actualPairCounts.values()) {
    if (count > 1) duplicateCount += count - 1;
  }

  const missingCount = [...expected].filter((key) => !actualPairCounts.has(key)).length;
  const unexpectedCount = [...actualPairCounts.keys()].filter((key) => !expected.has(key)).length;
  const teamsWithoutMatch = teams.filter((t) => !teamsInMatches.has(t.id)).map((t) => t.id);

  const noTeamsToSchedule = teams.length < 2;
  const hasMatches = matches.length > 0;
  const isSynced = noTeamsToSchedule
    ? !hasMatches
    : missingCount === 0 &&
      unexpectedCount === 0 &&
      duplicateCount === 0 &&
      invalidCount === 0;

  let message: string | null = null;
  if (!isSynced && teams.length >= 2) {
    if (teamsWithoutMatch.length > 0) {
      const names = teamsWithoutMatch.map((id) => nameById.get(id) ?? id).join(", ");
      message =
        teamsWithoutMatch.length === 1
          ? `${names} er ikke med i de genererede kampe — typisk fordi hold er tilføjet efter sidste generering. Generér kampe igen.`
          : `Disse hold mangler i kampprogrammet: ${names}. Generér kampe igen efter ændring af puljen.`;
    } else if (unexpectedCount > 0 && missingCount > 0) {
      message = `Kampene passer ikke til puljens ${teams.length} hold (${missingCount} mangler, ${unexpectedCount} overflødige). Generér kampe igen.`;
    } else if (unexpectedCount > 0) {
      message = `${unexpectedCount} kamp(e) hører ikke til puljens nuværende hold. Generér kampe igen.`;
    } else if (missingCount > 0) {
      message = `${missingCount} forventet kamp mangler. Generér kampe igen.`;
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
    missingCount,
    unexpectedCount,
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

function tryAddCappedPairing(
  teamAId: string,
  teamBId: string,
  cap: number,
  matchCount: Map<string, number>,
  usedPairs: Set<string>,
  pairings: Array<{ teamAId: string; teamBId: string }>,
): boolean {
  if (teamAId === teamBId) return false;
  const key = matchPairKey(teamAId, teamBId);
  if (usedPairs.has(key)) return false;
  const countA = matchCount.get(teamAId) ?? 0;
  const countB = matchCount.get(teamBId) ?? 0;
  if (countA >= cap || countB >= cap) return false;
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

function generateCappedRoundRobinPairings(
  teamIds: readonly string[],
  cap: number,
): Array<{ teamAId: string; teamBId: string }> {
  const matchCount = new Map(teamIds.map((id) => [id, 0]));
  const usedPairs = new Set<string>();
  const pairings: Array<{ teamAId: string; teamBId: string }> = [];

  const allAtCap = () => teamIds.every((id) => (matchCount.get(id) ?? 0) >= cap);

  let order = [...teamIds];
  if (order.length % 2 === 1) order = [...order, ROUND_ROBIN_BYE];
  const n = order.length;
  const slotOrder = [...order];

  for (let round = 0; round < n - 1; round += 1) {
    if (allAtCap()) break;
    for (let i = 0; i < n / 2; i += 1) {
      const teamAId = slotOrder[i]!;
      const teamBId = slotOrder[n - 1 - i]!;
      if (teamAId === ROUND_ROBIN_BYE || teamBId === ROUND_ROBIN_BYE) continue;
      tryAddCappedPairing(teamAId, teamBId, cap, matchCount, usedPairs, pairings);
    }
    if (round < n - 2) rotateRoundRobinOrder(slotOrder);
  }

  let progress = true;
  while (progress) {
    progress = false;
    const underCap = teamIds
      .filter((id) => (matchCount.get(id) ?? 0) < cap)
      .sort(
        (a, b) =>
          (matchCount.get(a) ?? 0) - (matchCount.get(b) ?? 0) || a.localeCompare(b),
      );

    if (underCap.length < 2) break;

    for (let i = 0; i < underCap.length; i += 1) {
      for (let j = i + 1; j < underCap.length; j += 1) {
        if (tryAddCappedPairing(underCap[i]!, underCap[j]!, cap, matchCount, usedPairs, pairings)) {
          progress = true;
          break;
        }
      }
      if (progress) break;
    }
  }

  return pairings;
}

/**
 * Round-robin op til `maxMatchesPerTeam` kampe pr. hold.
 * Ulige puljer: ingen hold får flere end cap; total matcher `plannedPoolMatchCount`.
 * Når cap×hold er ulige kan ét hold få cap−1 — resten cap (grafteori, ikke fejl).
 */
export function generateRoundRobinMatches<T extends TeamForPairing>(
  teams: readonly T[],
  maxMatchesPerTeam?: number,
): Array<{ teamAId: string; teamBId: string }> {
  if (teams.length < 2) return [];

  const teamIds = sortTeamsForPairing(teams).map((t) => t.id);
  const cap = resolveMatchesPerTeamCap(teams.length, maxMatchesPerTeam);

  if (cap == null) {
    return generateFullRoundRobinPairings(teamIds);
  }

  return generateCappedRoundRobinPairings(teamIds, cap);
}

/** Antal kampe ved begrænset round-robin (til KPI / sync). */
export function plannedPoolMatchCount(teamCount: number, maxMatchesPerTeam?: number): number {
  if (teamCount < 2) return 0;
  const cap = resolveMatchesPerTeamCap(teamCount, maxMatchesPerTeam);
  if (cap == null) {
    return (teamCount * (teamCount - 1)) / 2;
  }
  return Math.floor((teamCount * cap) / 2);
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
  expectedMatches: number;
  matchCoveragePct: number;
};

export type TurneringDashboardOverview = {
  levels: TurneringDashboardLevelStats[];
  totals: {
    playerCount: number;
    teamCount: number;
    poolCount: number;
    pooledTeams: number;
    matchesGenerated: number;
    expectedMatches: number;
    poolsReadyForMatches: number;
  };
  error: string | null;
};
