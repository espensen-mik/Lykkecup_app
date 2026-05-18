import { createServerSupabase } from "@/lib/auth-server";
import { compareCourtNamesForSchedule } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import type {
  KampprogramBundle,
  KampprogramCourt,
  KampprogramMatch,
  KampprogramPeriod,
} from "@/lib/kampprogram";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import { buildTeamDetailsById, type TeamPlayerLite } from "@/lib/team-detail";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import { isAllDayPeriod, periodWindowMinutes } from "@/lib/tournament-periods";
import { timeToMinutes } from "@/lib/baner-tider";
import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

const empty: KampprogramBundle = {
  matches: [],
  courts: [],
  levels: [],
  periods: [],
  teamDetails: {},
  stats: { total: 0, scheduled: 0, unscheduled: 0, orphanMatches: 0 },
  error: null,
};

export async function fetchKampprogramBundle(): Promise<KampprogramBundle> {
  const eventId = TURNERING_EVENT_ID;
  const client = await createServerSupabase();

  const [matchesRes, teamsRes, poolsRes, periodsRes, venuesRes, membersRes, playersRes, coachesRes, teamCoachesRes] =
    await Promise.all([
      client
        .from("matches")
        .select("id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, round_index")
        .eq("event_id", eventId)
        .order("start_time", { ascending: true, nullsFirst: false }),
      client
        .from("teams")
        .select("id, event_id, pool_id, name, nickname, level, sort_order, is_completed")
        .eq("event_id", eventId),
      client.from("pools").select("id, name, level, period_id").eq("event_id", eventId),
      client
        .from("tournament_periods")
        .select("id, name, sort_order, start_time, end_time, is_all_day")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      client.from("venues").select("id, name").eq("event_id", eventId),
      client.from("team_members").select("id, team_id, player_id").eq("event_id", eventId),
      client.from("players").select("id, name, home_club, age").eq("event_id", eventId),
      client.from("coaches").select("id, name, home_club, age").eq("event_id", eventId),
      client.from("team_coaches").select("id, event_id, team_id, coach_id").eq("event_id", eventId),
    ]);

  const err =
    matchesRes.error?.message ??
    teamsRes.error?.message ??
    poolsRes.error?.message ??
    periodsRes.error?.message ??
    venuesRes.error?.message ??
    membersRes.error?.message ??
    playersRes.error?.message ??
    coachesRes.error?.message ??
    teamCoachesRes.error?.message ??
    null;
  if (err) return { ...empty, error: err };

  const venueRows = (venuesRes.data ?? []) as { id: string; name: string }[];
  const venueById = new Map(venueRows.map((v) => [v.id, v.name]));
  const venueIds = venueRows.map((v) => v.id);
  const courtsRes =
    venueIds.length > 0
      ? await client
          .from("courts")
          .select("id, name, venue_id, sort_order, is_active")
          .in("venue_id", venueIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
      : await client
          .from("courts")
          .select("id, name, venue_id, sort_order, is_active")
          .eq("event_id", eventId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

  if (courtsRes.error) return { ...empty, error: courtsRes.error.message };

  const teams = (teamsRes.data ?? []) as TeamRow[];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamIds = new Set(teams.map((t) => t.id));
  const poolRows = (poolsRes.data ?? []) as {
    id: string;
    name: string;
    level: string | null;
    period_id: string | null;
  }[];
  const poolById = new Map(poolRows.map((p) => [p.id, p]));
  const poolIds = new Set(poolRows.map((p) => p.id));
  const teamDetailsMap = buildTeamDetailsById(
    teams,
    (membersRes.data ?? []) as TeamMemberRow[],
    (playersRes.data ?? []) as TeamPlayerLite[],
    (teamCoachesRes.data ?? []) as TeamCoachRow[],
    (coachesRes.data ?? []) as HoldCoachRow[],
  );
  const teamDetails: KampprogramBundle["teamDetails"] = {};
  for (const [id, detail] of teamDetailsMap) teamDetails[id] = detail;
  type PeriodRow = {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
  };
  const periodRows = (periodsRes.data ?? []) as PeriodRow[];
  const periodById = new Map(periodRows.map((p) => [p.id, p]));
  type CourtRow = { id: string; name: string; venue_id: string | null; sort_order: number | null };
  const courtRows = (courtsRes.data ?? []) as CourtRow[];

  const courtById = new Map(
    courtRows.map((c) => [
      c.id,
      {
        name: c.name,
        venueName: c.venue_id ? (venueById.get(c.venue_id) ?? null) : null,
      },
    ]),
  );

  const courts: KampprogramCourt[] = courtRows
    .map((c) => ({
      id: c.id,
      name: c.name,
      venueName: c.venue_id ? (venueById.get(c.venue_id) ?? null) : null,
      sortOrder: c.sort_order ?? 0,
    }))
    .sort((a, b) => compareCourtNamesForSchedule(a.name, b.name) || a.sortOrder - b.sortOrder);

  const levelSet = new Set<string>();
  const matches: KampprogramMatch[] = [];

  for (const row of (matchesRes.data ?? []) as Array<{
    id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
    end_time: string | null;
    round_index: number | null;
  }>) {
    const pool = poolById.get(row.pool_id);
    const teamA = teamById.get(row.team_a_id);
    const teamB = teamById.get(row.team_b_id);
    const court = row.court_id ? courtById.get(row.court_id) : undefined;
    const levelKey = canonicalBanerLevelLabel(pool?.level ?? teamA?.level ?? teamB?.level);
    levelSet.add(levelKey);

    const isOrphan = isOrphanKampprogramMatch(
      { teamAId: row.team_a_id, teamBId: row.team_b_id, poolId: row.pool_id },
      teamIds,
      poolIds,
    );
    const isScheduled = Boolean(row.court_id && row.start_time && row.end_time);
    const poolPeriod = pool?.period_id ? periodById.get(pool.period_id) : undefined;
    let scheduledOutsidePoolPeriod = false;
    if (isScheduled && poolPeriod && row.start_time && !isAllDayPeriod(poolPeriod)) {
      const matchStart = timeToMinutes(row.start_time);
      const win = periodWindowMinutes(poolPeriod);
      if (matchStart != null && win) {
        scheduledOutsidePoolPeriod = matchStart < win.startMinutes || matchStart >= win.endMinutes;
      }
    }
    matches.push({
      id: row.id,
      poolId: row.pool_id,
      teamAId: row.team_a_id,
      teamBId: row.team_b_id,
      isOrphan,
      levelKey,
      poolName: pool?.name ?? "Pulje",
      periodName: poolPeriod?.name ?? null,
      scheduledOutsidePoolPeriod,
      courtId: row.court_id,
      courtName: court?.name ?? null,
      venueName: court?.venueName ?? null,
      startTime: row.start_time,
      endTime: row.end_time,
      roundIndex: row.round_index,
      isScheduled,
    });
  }

  const periods: KampprogramPeriod[] = periodRows.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const scheduled = matches.filter((m) => m.isScheduled).length;
  const orphanMatches = matches.filter((m) => m.isOrphan).length;

  return {
    matches,
    courts,
    levels: [...levelSet].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" })),
    periods,
    teamDetails,
    stats: {
      total: matches.length,
      scheduled,
      unscheduled: matches.length - scheduled,
      orphanMatches,
    },
    error: null,
  };
}
