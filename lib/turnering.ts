import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { supabase } from "@/lib/supabase";
import type { TeamMemberRow, TeamRow } from "@/types/teams";

export const TURNERING_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

export type PuljerOverviewLevel = {
  levelKey: string;
  totalTeams: number;
  poolCount: number;
  assignedTeams: number;
  unassignedTeams: number;
};

export async function fetchPuljerOverview(): Promise<{
  levels: PuljerOverviewLevel[];
  error: string | null;
}> {
  const eventId = TURNERING_EVENT_ID;
  const [teamsRes, poolsRes] = await Promise.all([
    supabase.from("teams").select("id, level, pool_id").eq("event_id", eventId),
    supabase.from("pools").select("id, level").eq("event_id", eventId),
  ]);

  if (teamsRes.error) return { levels: [], error: teamsRes.error.message };
  if (poolsRes.error) return { levels: [], error: poolsRes.error.message };

  const teams = (teamsRes.data ?? []) as Pick<TeamRow, "id" | "level" | "pool_id">[];
  const pools = (poolsRes.data ?? []) as { id: string; level: string | null }[];

  const levelMap = new Map<string, PuljerOverviewLevel>();
  for (const t of teams) {
    const levelKey = normalizeLevelKey(t.level);
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
    const key = normalizeLevelKey(p.level);
    const row = levelMap.get(key);
    if (!row) continue;
    row.poolCount += 1;
  }

  const keys = sortLevelKeysForNav([...levelMap.keys()]);
  return { levels: keys.map((k) => levelMap.get(k)!), error: null };
}

export type TurneringsplanOverviewLevel = {
  levelKey: string;
  teamCount: number;
  poolCount: number;
};

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

export type TurneringLevelBundle = {
  teams: TeamRow[];
  pools: {
    id: string;
    event_id: string;
    level: string | null;
    name: string;
    sort_order: number;
  }[];
  members: TeamMemberRow[];
  players: {
    id: string;
    name: string;
    home_club: string | null;
    age: number | null;
  }[];
  error: string | null;
};

export async function fetchTurneringLevelData(levelKey: string): Promise<TurneringLevelBundle> {
  const eventId = TURNERING_EVENT_ID;
  const normalizedLevel = normalizeLevelKey(levelKey);

  const [teamsRes, poolsRes, membersRes, playersRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, event_id, pool_id, name, level, sort_order")
      .eq("event_id", eventId)
      .eq("level", normalizedLevel)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("pools")
      .select("id, event_id, level, name, sort_order")
      .eq("event_id", eventId)
      .eq("level", normalizedLevel)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("team_members").select("id, event_id, player_id, team_id").eq("event_id", eventId),
    supabase.from("players").select("id, name, home_club, age").eq("event_id", eventId),
  ]);

  if (teamsRes.error) return { teams: [], pools: [], members: [], players: [], error: teamsRes.error.message };
  if (poolsRes.error) return { teams: [], pools: [], members: [], players: [], error: poolsRes.error.message };
  if (membersRes.error)
    return { teams: [], pools: [], members: [], players: [], error: membersRes.error.message };
  if (playersRes.error)
    return { teams: [], pools: [], members: [], players: [], error: playersRes.error.message };

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const pools = (poolsRes.data ?? []) as TurneringLevelBundle["pools"];
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
  return { teams, pools, members, players, error: null };
}

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
};

export type TurneringPlanLevelBundle = {
  pools: {
    id: string;
    event_id: string;
    level: string | null;
    name: string;
    sort_order: number;
  }[];
  teams: TeamRow[];
  matches: MatchRow[];
  error: string | null;
};

export async function fetchTurneringPlanLevelData(levelKey: string): Promise<TurneringPlanLevelBundle> {
  const eventId = TURNERING_EVENT_ID;
  const normalizedLevel = normalizeLevelKey(levelKey);
  const [poolsRes, teamsRes] = await Promise.all([
    supabase
      .from("pools")
      .select("id, event_id, level, name, sort_order")
      .eq("event_id", eventId)
      .eq("level", normalizedLevel)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("teams")
      .select("id, event_id, pool_id, name, level, sort_order")
      .eq("event_id", eventId)
      .eq("level", normalizedLevel)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (poolsRes.error) return { pools: [], teams: [], matches: [], error: poolsRes.error.message };
  if (teamsRes.error) return { pools: [], teams: [], matches: [], error: teamsRes.error.message };

  const pools = (poolsRes.data ?? []) as TurneringPlanLevelBundle["pools"];
  const teams = (teamsRes.data ?? []) as TeamRow[];
  const poolIds = pools.map((p) => p.id);
  if (poolIds.length === 0) return { pools, teams, matches: [], error: null };

  const matchesRes = await supabase
    .from("matches")
    .select("id, event_id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, status, created_at")
    .eq("event_id", eventId)
    .in("pool_id", poolIds)
    .order("created_at", { ascending: true });

  if (matchesRes.error) return { pools: [], teams: [], matches: [], error: matchesRes.error.message };
  return { pools, teams, matches: (matchesRes.data ?? []) as MatchRow[], error: null };
}

export function generateRoundRobinMatches<T extends { id: string }>(
  teams: T[],
): Array<{ teamAId: string; teamBId: string }> {
  const matches: Array<{ teamAId: string; teamBId: string }> = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      matches.push({ teamAId: teams[i].id, teamBId: teams[j].id });
    }
  }
  return matches;
}

