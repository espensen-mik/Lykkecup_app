import { createServerSupabase } from "@/lib/auth-server";
import { fetchBanerTiderData } from "@/lib/baner-tider";
import { fetchLevelSchedulePlanningRows } from "@/lib/level-schedule-settings";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  computeCourtCapacities,
  conservativeRoundTimingFromSchedule,
  courtsRowsToRegnemaskineCourts,
  planMatchesByLevelFromScheduleRows,
} from "@/lib/lykkecup-regnemaskine";
import {
  runLykkecupCheck,
  type LykkecupCheckCourtUsageRow,
  type LykkecupCheckInput,
  type LykkecupCheckResult,
} from "@/lib/lykkecup-check";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

function buildCourtUsageRows(
  baner: Awaited<ReturnType<typeof fetchBanerTiderData>>,
): LykkecupCheckCourtUsageRow[] {
  const courts = courtsRowsToRegnemaskineCourts(baner.courts);
  const availability = availabilityRowsToRegnemaskineAvailability(baner.availability);
  const breaks = breakRowsToRegnemaskineBreaks(baner.breaks);
  const timing = conservativeRoundTimingFromSchedule(baner.levelSettings);
  const capacityRows = computeCourtCapacities(courts, availability, breaks, timing);
  const capacityById = new Map(capacityRows.map((r) => [r.courtId, r.slots]));

  return baner.courts
    .filter((c) => c.is_active)
    .map((c) => {
      const capacityRounds = capacityById.get(c.id) ?? 0;
      const usedRounds = baner.scheduledSlotsByCourtId[c.id] ?? 0;
      return {
        courtId: c.id,
        courtName: c.name,
        capacityRounds,
        usedRounds,
        freeRounds: capacityRounds - usedRounds,
      };
    })
    .sort((a, b) => a.courtName.localeCompare(b.courtName, "da", { numeric: true }));
}

export async function fetchAndRunLykkecupCheck(): Promise<LykkecupCheckResult & { error: string | null }> {
  const eventId = TURNERING_EVENT_ID;
  const client = await createServerSupabase();

  const [playersRes, teamsRes, poolsRes, membersRes, matchesRes, courtsRes, periodsRes, coachesRes, teamCoachesRes, baner] =
    await Promise.all([
      client.from("players").select("id, name, level").eq("event_id", eventId),
      client
        .from("teams")
        .select("id, name, level, pool_id, sort_order")
        .eq("event_id", eventId),
      client.from("pools").select("id, name, level, period_id").eq("event_id", eventId),
      client.from("team_members").select("player_id, team_id").eq("event_id", eventId),
      client
        .from("matches")
        .select("id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, schedule_relaxed_team_rest")
        .eq("event_id", eventId),
      client.from("courts").select("id, name").eq("event_id", eventId),
      client.from("tournament_periods").select("id, name, start_time, end_time, is_all_day").eq("event_id", eventId),
      client.from("coaches").select("id, name").eq("event_id", eventId).order("name", { ascending: true }),
      client.from("team_coaches").select("coach_id, team_id").eq("event_id", eventId),
      fetchBanerTiderData(client),
    ]);

  const scheduleFetch = await fetchLevelSchedulePlanningRows(client, eventId);

  const err =
    playersRes.error?.message ??
    teamsRes.error?.message ??
    poolsRes.error?.message ??
    membersRes.error?.message ??
    matchesRes.error?.message ??
    courtsRes.error?.message ??
    periodsRes.error?.message ??
    coachesRes.error?.message ??
    teamCoachesRes.error?.message ??
    baner.error ??
    scheduleFetch.error ??
    null;

  if (err) {
    return {
      ranAt: new Date().toISOString(),
      overallOk: false,
      summary: { ok: 0, warn: 0, error: 0, total: 0 },
      items: [],
      error: err,
    };
  }

  const scheduleRows = scheduleFetch.rows;

  const courtNamesById = Object.fromEntries((courtsRes.data ?? []).map((c) => [c.id, c.name]));

  const input: LykkecupCheckInput = {
    players: (playersRes.data ?? []) as LykkecupCheckInput["players"],
    teams: (teamsRes.data ?? []) as LykkecupCheckInput["teams"],
    pools: (poolsRes.data ?? []) as LykkecupCheckInput["pools"],
    members: (membersRes.data ?? []) as LykkecupCheckInput["members"],
    matches: (matchesRes.data ?? []) as LykkecupCheckInput["matches"],
    planMatchesByLevel: planMatchesByLevelFromScheduleRows(scheduleRows),
    scheduleRows,
    periods: (periodsRes.data ?? []) as LykkecupCheckInput["periods"],
    courtNamesById,
    courtUsage: buildCourtUsageRows(baner),
    coaches: (coachesRes.data ?? []) as LykkecupCheckInput["coaches"],
    teamCoaches: (teamCoachesRes.data ?? []) as LykkecupCheckInput["teamCoaches"],
  };

  const result = runLykkecupCheck(input);
  return { ...result, error: null };
}
