import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/auth-server";
import {
  canonicalBanerLevelLabel,
  levelSlugForPalette,
  normalizeLevelKey,
  sortLevelKeysForNav,
} from "@/lib/holddannelse";
import { roundLengthMinutes, type RoundTiming } from "@/lib/lykkecup-regnemaskine";
import { poolPlanningHint } from "@/lib/puljer";
import { teamRestMinutesBetweenMatches } from "@/lib/turnering-scheduler";
import {
  TURNERING_EVENT_ID,
  type MatchRow,
  type PuljerOverviewLevel,
  type TurneringsplanOverviewLevel,
  type TurneringDashboardLevelStats,
  type TurneringDashboardOverview,
  type TurneringLevelBundle,
  type TurneringPlanLevelBundle,
} from "@/lib/turnering";
import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

/** Puljer som hold i niveauet peger på, men som ikke matchede niveau-filter (fx gammelt level-felt). */
async function mergePoolsReferencedByTeams<T extends { id: string; sort_order: number; name: string }>(
  client: SupabaseClient,
  eventId: string,
  teams: Pick<TeamRow, "pool_id">[],
  pools: T[],
  select: string,
): Promise<T[]> {
  const byId = new Map(pools.map((p) => [p.id, p]));
  const missingIds = [
    ...new Set(
      teams
        .map((t) => t.pool_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && !byId.has(id)),
    ),
  ];
  if (missingIds.length === 0) return pools;

  const extraRes = await client.from("pools").select(select).eq("event_id", eventId).in("id", missingIds);

  if (extraRes.error || !extraRes.data?.length) return pools;

  for (const row of extraRes.data as unknown as T[]) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da"),
  );
}

const LEVEL_POOL_SELECT = "id, event_id, level, name, sort_order, is_closed, period_id";
const PLAN_POOL_SELECT = "id, event_id, level, name, sort_order, period_id";

function cleanLevelLabel(level: string | null | undefined): string {
  const normalized = normalizeLevelKey(level);
  if (normalized === "Ukendt niveau") return normalized;
  return normalized.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

function canonicalLevelBucket(level: string | null | undefined): { bucketKey: string; label: string } {
  const cleaned = cleanLevelLabel(level);
  if (cleaned === "Ukendt niveau") return { bucketKey: cleaned, label: cleaned };
  const slug = levelSlugForPalette(cleaned);
  return { bucketKey: `slug:${slug}`, label: cleaned };
}

export async function fetchPuljerOverview(): Promise<{
  levels: PuljerOverviewLevel[];
  error: string | null;
}> {
  const eventId = TURNERING_EVENT_ID;
  const client = await createServerSupabase();
  const [teamsRes, poolsRes] = await Promise.all([
    client.from("teams").select("id, level, pool_id").eq("event_id", eventId),
    client.from("pools").select("id, level").eq("event_id", eventId),
  ]);

  if (teamsRes.error) return { levels: [], error: teamsRes.error.message };
  if (poolsRes.error) return { levels: [], error: poolsRes.error.message };

  const teams = (teamsRes.data ?? []) as Pick<TeamRow, "id" | "level" | "pool_id">[];
  const pools = (poolsRes.data ?? []) as { id: string; level: string | null }[];

  const levelMap = new Map<string, PuljerOverviewLevel>();
  for (const t of teams) {
    const levelKey = canonicalBanerLevelLabel(t.level);
    const row =
      levelMap.get(levelKey) ??
      {
        levelKey,
        totalTeams: 0,
        poolCount: 0,
        assignedTeams: 0,
        unassignedTeams: 0,
      };
    row.totalTeams += 1;
    if (t.pool_id) row.assignedTeams += 1;
    else row.unassignedTeams += 1;
    levelMap.set(levelKey, row);
  }

  for (const p of pools) {
    const key = canonicalBanerLevelLabel(p.level);
    const row = levelMap.get(key);
    if (!row) continue;
    row.poolCount += 1;
  }

  const keys = sortLevelKeysForNav([...levelMap.keys()]);
  return { levels: keys.map((k) => levelMap.get(k)!), error: null };
}

export async function fetchTurneringsplanOverview(): Promise<{
  levels: TurneringsplanOverviewLevel[];
  error: string | null;
}> {
  const { levels, error } = await fetchPuljerOverview();
  if (error) return { levels: [], error };
  return {
    levels: levels.map((l) => ({
      levelKey: l.levelKey,
      teamCount: l.totalTeams,
      poolCount: l.poolCount,
    })),
    error: null,
  };
}

export async function fetchTurneringLevelData(levelKey: string): Promise<TurneringLevelBundle> {
  const eventId = TURNERING_EVENT_ID;
  const canonLevel = canonicalBanerLevelLabel(levelKey);
  const client = await createServerSupabase();

  const [teamsRes, poolsRes, membersRes, playersRes, scheduleRes, coachesRes, teamCoachesRes] =
    await Promise.all([
      client
        .from("teams")
        .select("id, event_id, pool_id, name, nickname, level, sort_order, is_completed")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      client
        .from("pools")
        .select("id, event_id, level, name, sort_order, is_closed, period_id")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      client.from("team_members").select("id, event_id, player_id, team_id").eq("event_id", eventId),
      client.from("players").select("id, name, home_club, age").eq("event_id", eventId),
      client
        .from("level_schedule_settings")
        .select("level, plan_matches_per_team, plan_target_teams_per_pool, plan_max_teams_per_pool")
        .eq("event_id", eventId),
      client.from("coaches").select("id, name, home_club, age").eq("event_id", eventId),
      client.from("team_coaches").select("id, event_id, team_id, coach_id").eq("event_id", eventId),
    ]);

  const empty = {
    teams: [] as TeamRow[],
    pools: [] as TurneringLevelBundle["pools"],
    members: [] as TeamMemberRow[],
    players: [] as TurneringLevelBundle["players"],
    planMatchesPerTeam: poolPlanningHint(canonLevel, []).matchesPerTeam,
    poolHint: poolPlanningHint(canonLevel, []),
    coaches: [] as HoldCoachRow[],
    teamCoaches: [] as TeamCoachRow[],
  };

  if (teamsRes.error) return { ...empty, error: teamsRes.error.message };
  if (poolsRes.error) return { ...empty, error: poolsRes.error.message };
  if (membersRes.error) return { ...empty, error: membersRes.error.message };
  if (playersRes.error) return { ...empty, error: playersRes.error.message };
  if (scheduleRes.error) return { ...empty, error: scheduleRes.error.message };
  if (coachesRes.error) return { ...empty, error: coachesRes.error.message };
  if (teamCoachesRes.error) return { ...empty, error: teamCoachesRes.error.message };

  const scheduleRows = (scheduleRes.data ?? []) as {
    level: string;
    plan_matches_per_team: number | null;
    plan_target_teams_per_pool: number | null;
    plan_max_teams_per_pool: number | null;
  }[];
  const poolHint = poolPlanningHint(canonLevel, scheduleRows);
  const planMatchesPerTeam = poolHint.matchesPerTeam;

  const teams = ((teamsRes.data ?? []) as TeamRow[]).filter(
    (t) => canonicalBanerLevelLabel(t.level) === canonLevel,
  );
  let pools = ((poolsRes.data ?? []) as TurneringLevelBundle["pools"]).filter(
    (p) => canonicalBanerLevelLabel(p.level) === canonLevel,
  );
  pools = await mergePoolsReferencedByTeams(client, eventId, teams, pools, LEVEL_POOL_SELECT);
  const allMembers = (membersRes.data ?? []) as TeamMemberRow[];
  const allPlayers = (playersRes.data ?? []) as TurneringLevelBundle["players"];

  const teamIds = new Set(teams.map((t) => t.id));
  const playerIdsInTeams = new Set<string>();
  const members = allMembers.filter((m) => {
    if (!teamIds.has(m.team_id)) return false;
    playerIdsInTeams.add(m.player_id);
    return true;
  });

  const players = allPlayers.filter((p) => playerIdsInTeams.has(p.id));
  const coaches = ((coachesRes.data ?? []) as HoldCoachRow[]).sort((a, b) =>
    a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
  );
  const teamCoaches = (teamCoachesRes.data ?? []) as TeamCoachRow[];
  return { teams, pools, members, players, planMatchesPerTeam, poolHint, coaches, teamCoaches, error: null };
}

export async function fetchTurneringPlanLevelData(levelKey: string): Promise<TurneringPlanLevelBundle> {
  const eventId = TURNERING_EVENT_ID;
  const canonLevel = canonicalBanerLevelLabel(levelKey);
  const client = await createServerSupabase();
  const [poolsRes, teamsRes, membersRes, playersRes, coachesRes, teamCoachesRes, periodsRes, venuesRes, scheduleRes] =
    await Promise.all([
      client
        .from("pools")
        .select("id, event_id, level, name, sort_order, period_id")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      client
        .from("teams")
        .select("id, event_id, pool_id, name, nickname, level, sort_order, is_completed")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      client.from("team_members").select("id, team_id, player_id").eq("event_id", eventId),
      client.from("players").select("id, name, home_club, age").eq("event_id", eventId),
      client.from("coaches").select("id, name, home_club, age").eq("event_id", eventId),
      client.from("team_coaches").select("id, event_id, team_id, coach_id").eq("event_id", eventId),
      client.from("tournament_periods").select("id, name").eq("event_id", eventId).order("sort_order"),
      client.from("venues").select("id").eq("event_id", eventId),
      client
        .from("level_schedule_settings")
        .select(
          "level, plan_matches_per_team, plan_target_teams_per_pool, plan_max_teams_per_pool, match_duration_minutes, break_between_matches_minutes",
        )
        .eq("event_id", eventId),
    ]);

  const scheduleRowsFull = (scheduleRes.data ?? []) as Array<{
    level: string;
    plan_matches_per_team: number | null;
    plan_target_teams_per_pool: number | null;
    plan_max_teams_per_pool: number | null;
    match_duration_minutes: number | null;
    break_between_matches_minutes: number | null;
  }>;
  const poolHint = poolPlanningHint(canonLevel, scheduleRowsFull);
  const planMatchesPerTeam = poolHint.matchesPerTeam;
  const levelScheduleRow = scheduleRowsFull.find((r) => canonicalBanerLevelLabel(r.level) === canonLevel);
  const levelTiming: RoundTiming = {
    matchDurationMinutes: levelScheduleRow?.match_duration_minutes ?? 9,
    breakBetweenMatchesMinutes: levelScheduleRow?.break_between_matches_minutes ?? 1,
  };
  const teamRestMinutes = teamRestMinutesBetweenMatches(roundLengthMinutes(levelTiming));

  const emptyPlan = {
    planMatchesPerTeam,
    poolHint,
    teamRestMinutes,
    pools: [] as TurneringPlanLevelBundle["pools"],
    teams: [] as TeamRow[],
    members: [] as TeamMemberRow[],
    players: [] as TurneringPlanLevelBundle["players"],
    coaches: [] as HoldCoachRow[],
    teamCoaches: [] as TeamCoachRow[],
    matches: [] as MatchRow[],
    courts: [] as TurneringPlanLevelBundle["courts"],
    periods: [] as TurneringPlanLevelBundle["periods"],
  };

  if (poolsRes.error) return { ...emptyPlan, error: poolsRes.error.message };
  if (teamsRes.error) return { ...emptyPlan, error: teamsRes.error.message };
  if (membersRes.error) return { ...emptyPlan, error: membersRes.error.message };
  if (playersRes.error) return { ...emptyPlan, error: playersRes.error.message };
  if (coachesRes.error) return { ...emptyPlan, error: coachesRes.error.message };
  if (teamCoachesRes.error) return { ...emptyPlan, error: teamCoachesRes.error.message };

  let pools = ((poolsRes.data ?? []) as TurneringPlanLevelBundle["pools"]).filter(
    (p) => canonicalBanerLevelLabel(p.level) === canonLevel,
  );
  const teams = ((teamsRes.data ?? []) as TeamRow[]).filter(
    (t) => canonicalBanerLevelLabel(t.level) === canonLevel,
  );
  pools = await mergePoolsReferencedByTeams(client, eventId, teams, pools, PLAN_POOL_SELECT);
  const members = (membersRes.data ?? []) as TeamMemberRow[];
  const allPlayers = (playersRes.data ?? []) as TurneringPlanLevelBundle["players"];
  const coaches = ((coachesRes.data ?? []) as HoldCoachRow[]).sort((a, b) =>
    a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
  );
  const teamCoaches = (teamCoachesRes.data ?? []) as TeamCoachRow[];
  const periods = (periodsRes.data ?? []) as TurneringPlanLevelBundle["periods"];

  const teamIds = new Set(teams.map((t) => t.id));
  const playerIdsInTeams = new Set(members.filter((m) => teamIds.has(m.team_id)).map((m) => m.player_id));
  const players = allPlayers.filter((p) => playerIdsInTeams.has(p.id));

  const venueIds = ((venuesRes.data ?? []) as { id: string }[]).map((v) => v.id);
  const courtsRes =
    venueIds.length > 0
      ? await client
          .from("courts")
          .select("id, name")
          .in("venue_id", venueIds)
          .eq("is_active", true)
          .order("sort_order")
      : await client
          .from("courts")
          .select("id, name")
          .eq("event_id", eventId)
          .eq("is_active", true)
          .order("sort_order");

  const courts = (courtsRes.data ?? []) as TurneringPlanLevelBundle["courts"];

  const poolIds = pools.map((p) => p.id);
  if (poolIds.length === 0) {
    return {
      planMatchesPerTeam,
      poolHint,
      teamRestMinutes,
      pools,
      teams,
      members,
      players,
      coaches,
      teamCoaches,
      matches: [],
      courts,
      periods,
      error: null,
    };
  }

  const matchesRes = await client
    .from("matches")
    .select(
      "id, event_id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, status, created_at, schedule_relaxed_team_rest",
    )
    .eq("event_id", eventId)
    .in("pool_id", poolIds)
    .order("created_at", { ascending: true });

  if (matchesRes.error) {
    return { ...emptyPlan, error: matchesRes.error.message };
  }
  return {
    planMatchesPerTeam,
    poolHint,
    teamRestMinutes,
    pools,
    teams,
    members,
    players,
    coaches,
    teamCoaches,
    matches: (matchesRes.data ?? []) as MatchRow[],
    courts,
    periods,
    error: null,
  };
}

export async function fetchTurneringDashboardOverview(): Promise<TurneringDashboardOverview> {
  const client = await createServerSupabase();
  const eventId = TURNERING_EVENT_ID;
  const [playersRes, teamsRes, poolsRes, matchesRes] = await Promise.all([
    client.from("players").select("id, level").eq("event_id", eventId),
    client.from("teams").select("id, level, pool_id").eq("event_id", eventId),
    client.from("pools").select("id, level").eq("event_id", eventId),
    client.from("matches").select("id, pool_id").eq("event_id", eventId),
  ]);

  if (playersRes.error) {
    return {
      levels: [],
      totals: {
        playerCount: 0,
        teamCount: 0,
        poolCount: 0,
        pooledTeams: 0,
        matchesGenerated: 0,
        expectedMatches: 0,
        poolsReadyForMatches: 0,
      },
      error: playersRes.error.message,
    };
  }
  if (teamsRes.error) {
    return {
      levels: [],
      totals: {
        playerCount: 0,
        teamCount: 0,
        poolCount: 0,
        pooledTeams: 0,
        matchesGenerated: 0,
        expectedMatches: 0,
        poolsReadyForMatches: 0,
      },
      error: teamsRes.error.message,
    };
  }
  if (poolsRes.error) {
    return {
      levels: [],
      totals: {
        playerCount: 0,
        teamCount: 0,
        poolCount: 0,
        pooledTeams: 0,
        matchesGenerated: 0,
        expectedMatches: 0,
        poolsReadyForMatches: 0,
      },
      error: poolsRes.error.message,
    };
  }
  if (matchesRes.error) {
    return {
      levels: [],
      totals: {
        playerCount: 0,
        teamCount: 0,
        poolCount: 0,
        pooledTeams: 0,
        matchesGenerated: 0,
        expectedMatches: 0,
        poolsReadyForMatches: 0,
      },
      error: matchesRes.error.message,
    };
  }

  const players = (playersRes.data ?? []) as { id: string; level: string | null }[];
  const teams = (teamsRes.data ?? []) as { id: string; level: string | null; pool_id: string | null }[];
  const pools = (poolsRes.data ?? []) as { id: string; level: string | null }[];
  const matches = (matchesRes.data ?? []) as { id: string; pool_id: string | null }[];

  const levelMap = new Map<string, TurneringDashboardLevelStats>();
  const ensureLevel = (bucketKey: string, label: string): TurneringDashboardLevelStats => {
    const current = levelMap.get(bucketKey);
    if (current) return current;
    const row: TurneringDashboardLevelStats = {
      levelKey: label,
      playerCount: 0,
      teamCount: 0,
      poolCount: 0,
      pooledTeams: 0,
      unpooledTeams: 0,
      teamPooledPct: 0,
      matchesGenerated: 0,
      expectedMatches: 0,
      matchCoveragePct: 0,
    };
    levelMap.set(bucketKey, row);
    return row;
  };

  for (const p of players) {
    const level = canonicalLevelBucket(p.level);
    ensureLevel(level.bucketKey, level.label).playerCount += 1;
  }

  const poolLevelById = new Map<string, string>();
  for (const pool of pools) {
    const level = canonicalLevelBucket(pool.level);
    poolLevelById.set(pool.id, level.bucketKey);
    ensureLevel(level.bucketKey, level.label).poolCount += 1;
  }

  const teamCountByPool = new Map<string, number>();
  for (const team of teams) {
    const level = canonicalLevelBucket(team.level);
    const row = ensureLevel(level.bucketKey, level.label);
    row.teamCount += 1;
    if (team.pool_id) {
      row.pooledTeams += 1;
      teamCountByPool.set(team.pool_id, (teamCountByPool.get(team.pool_id) ?? 0) + 1);
    } else {
      row.unpooledTeams += 1;
    }
  }

  for (const match of matches) {
    if (!match.pool_id) continue;
    const bucketKey = poolLevelById.get(match.pool_id);
    if (!bucketKey) continue;
    const row = levelMap.get(bucketKey);
    if (!row) continue;
    row.matchesGenerated += 1;
  }

  for (const [poolId, teamCount] of teamCountByPool.entries()) {
    const bucketKey = poolLevelById.get(poolId);
    if (!bucketKey) continue;
    const expected = teamCount >= 2 ? (teamCount * (teamCount - 1)) / 2 : 0;
    const row = levelMap.get(bucketKey);
    if (!row) continue;
    row.expectedMatches += expected;
  }

  for (const row of levelMap.values()) {
    row.teamPooledPct = row.teamCount > 0 ? Math.round((row.pooledTeams / row.teamCount) * 1000) / 10 : 0;
    row.matchCoveragePct =
      row.expectedMatches > 0 ? Math.round((row.matchesGenerated / row.expectedMatches) * 1000) / 10 : 0;
  }

  const levels = sortLevelKeysForNav([...levelMap.values()].map((v) => v.levelKey)).map(
    (label) => [...levelMap.values()].find((row) => row.levelKey === label)!,
  );

  const totals = levels.reduce(
    (acc, row) => {
      acc.playerCount += row.playerCount;
      acc.teamCount += row.teamCount;
      acc.poolCount += row.poolCount;
      acc.pooledTeams += row.pooledTeams;
      acc.matchesGenerated += row.matchesGenerated;
      acc.expectedMatches += row.expectedMatches;
      return acc;
    },
    {
      playerCount: 0,
      teamCount: 0,
      poolCount: 0,
      pooledTeams: 0,
      matchesGenerated: 0,
      expectedMatches: 0,
      poolsReadyForMatches: 0,
    },
  );

  totals.poolsReadyForMatches = [...teamCountByPool.values()].filter((count) => count >= 2).length;
  return { levels, totals, error: null };
}
