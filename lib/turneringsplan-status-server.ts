import { createServerSupabase } from "@/lib/auth-server";
import { fetchLevelSchedulePlanningRows } from "@/lib/level-schedule-settings";
import { runLykkecupCheck, type LykkecupCheckInput } from "@/lib/lykkecup-check";
import { planMatchesByLevelFromScheduleRows } from "@/lib/lykkecup-regnemaskine";
import {
  computeTurneringsplanMatchStatus,
  type TurneringsplanMatchStatus,
} from "@/lib/turneringsplan-status";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

export async function fetchTurneringsplanMatchStatus(): Promise<
  TurneringsplanMatchStatus & { error: string | null }
> {
  const eventId = TURNERING_EVENT_ID;
  const client = await createServerSupabase();

  const [playersRes, teamsRes, poolsRes, membersRes, matchesRes, courtsRes] = await Promise.all([
    client.from("players").select("id, name, level").eq("event_id", eventId),
    client.from("teams").select("id, name, level, pool_id, sort_order").eq("event_id", eventId),
    client.from("pools").select("id, name, level, period_id").eq("event_id", eventId),
    client.from("team_members").select("player_id, team_id").eq("event_id", eventId),
    client
      .from("matches")
      .select(
        "id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, schedule_relaxed_team_rest",
      )
      .eq("event_id", eventId),
    client.from("courts").select("id, name").eq("event_id", eventId),
  ]);

  const scheduleFetch = await fetchLevelSchedulePlanningRows(client, eventId, { includeTiming: true });

  const err =
    teamsRes.error?.message ??
    poolsRes.error?.message ??
    matchesRes.error?.message ??
    scheduleFetch.error ??
    null;

  const empty: TurneringsplanMatchStatus & { error: string | null } = {
    ranAt: new Date().toISOString(),
    overallStatus: "ok",
    metrics: {
      expectedMatches: 0,
      generatedMatches: 0,
      scheduledMatches: 0,
      unscheduledMatches: 0,
      orphanMatches: 0,
      poolsOutOfSync: 0,
      courtConflicts: 0,
      teamRestWarnings: 0,
      relaxedRestMatches: 0,
      teamsSpanningPeriods: 0,
    },
    issueGroups: [],
    levelBreakdown: [],
    error: err,
  };

  if (err) return empty;

  const scheduleRows = scheduleFetch.rows;

  const checkInput: LykkecupCheckInput = {
    players: (playersRes.data ?? []) as LykkecupCheckInput["players"],
    teams: (teamsRes.data ?? []) as LykkecupCheckInput["teams"],
    pools: (poolsRes.data ?? []) as LykkecupCheckInput["pools"],
    members: (membersRes.data ?? []) as LykkecupCheckInput["members"],
    matches: (matchesRes.data ?? []) as LykkecupCheckInput["matches"],
    planMatchesByLevel: planMatchesByLevelFromScheduleRows(scheduleRows),
    scheduleRows,
  };

  const check = runLykkecupCheck(checkInput);
  const teamNamesById = Object.fromEntries((teamsRes.data ?? []).map((t) => [t.id, t.name as string]));
  const courtNamesById = Object.fromEntries((courtsRes.data ?? []).map((c) => [c.id, c.name as string]));

  const poolPeriodIds = Object.fromEntries(
    ((poolsRes.data ?? []) as Array<{ id: string; period_id: string | null }>).map((p) => [p.id, p.period_id]),
  );

  const status = computeTurneringsplanMatchStatus(
    {
      teams: checkInput.teams,
      pools: checkInput.pools,
      matches: (matchesRes.data ?? []) as Parameters<typeof computeTurneringsplanMatchStatus>[0]["matches"],
      planMatchesByLevel: checkInput.planMatchesByLevel,
      scheduleRows,
      courtNamesById,
      teamNamesById,
      poolPeriodIds,
    },
    check,
  );

  return { ...status, error: courtsRes.error?.message ?? null };
}
