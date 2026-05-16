import { createServerSupabase } from "@/lib/auth-server";
import { planMatchesByLevelFromScheduleRows } from "@/lib/lykkecup-regnemaskine";
import { LYKKECUP_EVENT_ID } from "@/lib/players";

export type PlayerMatchCountsBundle = {
  matchCountByPlayerId: Record<string, number>;
  /** Kanonisk niveau-label → forventet kampe pr. hold (Opsætning → Kampe). */
  planMatchesByLevel: Record<string, number>;
  error: string | null;
};

/** Antal turneringskampe pr. spiller (via hold) + forventet antal pr. niveau. */
export async function fetchPlayerMatchCountsForEvent(): Promise<PlayerMatchCountsBundle> {
  const eventId = LYKKECUP_EVENT_ID;
  const client = await createServerSupabase();

  const [membersRes, matchesRes, scheduleRes] = await Promise.all([
    client.from("team_members").select("player_id, team_id").eq("event_id", eventId),
    client.from("matches").select("team_a_id, team_b_id").eq("event_id", eventId),
    client.from("level_schedule_settings").select("level, plan_matches_per_team").eq("event_id", eventId),
  ]);

  const err =
    membersRes.error?.message ?? matchesRes.error?.message ?? scheduleRes.error?.message ?? null;
  if (err) {
    return { matchCountByPlayerId: {}, planMatchesByLevel: {}, error: err };
  }

  const planMatchesByLevel = planMatchesByLevelFromScheduleRows(
    (scheduleRes.data ?? []) as { level: string; plan_matches_per_team: number | null }[],
  );

  const teamMatchCount = new Map<string, number>();
  for (const match of (matchesRes.data ?? []) as { team_a_id: string; team_b_id: string }[]) {
    teamMatchCount.set(match.team_a_id, (teamMatchCount.get(match.team_a_id) ?? 0) + 1);
    teamMatchCount.set(match.team_b_id, (teamMatchCount.get(match.team_b_id) ?? 0) + 1);
  }

  const playerToTeam = new Map<string, string>();
  for (const row of (membersRes.data ?? []) as { player_id: string; team_id: string }[]) {
    playerToTeam.set(row.player_id, row.team_id);
  }

  const matchCountByPlayerId: Record<string, number> = {};
  for (const [playerId, teamId] of playerToTeam) {
    matchCountByPlayerId[playerId] = teamMatchCount.get(teamId) ?? 0;
  }

  return { matchCountByPlayerId, planMatchesByLevel, error: null };
}
