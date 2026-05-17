"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/auth-server";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { POOL_MAX_TEAMS, poolPlanningHint, suggestNextPoolName } from "@/lib/puljer";
import { generateRoundRobinMatches, TURNERING_EVENT_ID } from "@/lib/turnering";
import {
  assignMatchScheduleForLevelAllDay,
  assignMatchScheduleForPool,
} from "@/lib/turnering-scheduler";
import {
  isAllDayPeriod,
  periodWindowMinutes,
  type TournamentPeriodRow,
} from "@/lib/tournament-periods";

export type TurneringActionResult = {
  ok: boolean;
  message: string;
};

export type CreatedPoolRow = {
  id: string;
  event_id: string;
  level: string | null;
  name: string;
  sort_order: number;
  period_id: string | null;
  is_closed: boolean;
};

export async function createPoolAction(
  levelKey: string,
  options?: { revalidate?: boolean },
): Promise<TurneringActionResult & { pool?: CreatedPoolRow }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at oprette puljer." };
  }

  const normalizedLevel = canonicalBanerLevelLabel(levelKey);
  const { data: allPools, error: listErr } = await supabase
    .from("pools")
    .select("sort_order, name, level")
    .eq("event_id", TURNERING_EVENT_ID);

  if (listErr) return { ok: false, message: listErr.message };

  const existing = (allPools ?? []).filter(
    (p) => canonicalBanerLevelLabel(p.level) === normalizedLevel,
  );
  const maxSort =
    existing.length > 0 ? Math.max(...existing.map((p) => p.sort_order)) : 0;
  const name = suggestNextPoolName(existing.map((p) => p.name));

  const { data, error } = await supabase
    .from("pools")
    .insert({
      event_id: TURNERING_EVENT_ID,
      level: normalizedLevel,
      name,
      sort_order: maxSort + 1,
      is_closed: false,
    })
    .select("id, event_id, level, name, sort_order, period_id, is_closed")
    .single();

  if (error) return { ok: false, message: error.message };

  if (options?.revalidate !== false) {
    revalidatePath("/turnering/puljer");
    revalidatePath(`/turnering/puljer/${encodeURIComponent(normalizedLevel)}`);
    revalidatePath("/turnering/plan");
    revalidatePath(`/turnering/plan/${encodeURIComponent(normalizedLevel)}`);
  }

  return {
    ok: true,
    message: `${name} oprettet.`,
    pool: data as CreatedPoolRow,
  };
}

/** Frigør hold der peger på en pulje-id som ikke findes (fx efter sletning). */
export async function releaseOrphanedPoolTeamsAction(levelKey: string): Promise<TurneringActionResult & { released?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const canonLevel = canonicalBanerLevelLabel(levelKey);
  const eventId = TURNERING_EVENT_ID;

  const [teamsRes, poolsRes] = await Promise.all([
    supabase.from("teams").select("id, level, pool_id").eq("event_id", eventId),
    supabase.from("pools").select("id").eq("event_id", eventId),
  ]);

  if (teamsRes.error) return { ok: false, message: teamsRes.error.message };
  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };

  const poolIds = new Set((poolsRes.data ?? []).map((p) => p.id));
  const orphanIds = (teamsRes.data ?? [])
    .filter(
      (t) =>
        canonicalBanerLevelLabel(t.level) === canonLevel &&
        t.pool_id &&
        !poolIds.has(t.pool_id),
    )
    .map((t) => t.id);

  if (orphanIds.length === 0) {
    return { ok: true, message: "Ingen hold med manglende pulje.", released: 0 };
  }

  const { error } = await supabase.from("teams").update({ pool_id: null }).in("id", orphanIds);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/turnering/puljer");
  revalidatePath(`/turnering/puljer/${encodeURIComponent(canonLevel)}`);
  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(canonLevel)}`);

  return {
    ok: true,
    message: `${orphanIds.length} hold frigjort — de kan fordeles på puljer igen.`,
    released: orphanIds.length,
  };
}

export type AutoAssignPoolsAssignment = { teamId: string; poolId: string };

/** Fordel alle hold uden pulje på åbne puljer (opretter nye ved behov) — én server-kørsel. */
export async function autoAssignPoolsAction(levelKey: string): Promise<
  TurneringActionResult & {
    assigned?: number;
    skipped?: number;
    poolsCreated?: number;
    assignments?: AutoAssignPoolsAssignment[];
    newPools?: CreatedPoolRow[];
  }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const canonLevel = canonicalBanerLevelLabel(levelKey);
  const eventId = TURNERING_EVENT_ID;

  const [teamsRes, poolsRes, membersRes, playersRes, scheduleRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, level, pool_id, name, sort_order")
      .eq("event_id", eventId),
    supabase
      .from("pools")
      .select("id, event_id, level, name, sort_order, period_id, is_closed")
      .eq("event_id", eventId),
    supabase.from("team_members").select("team_id, player_id").eq("event_id", eventId),
    supabase.from("players").select("id, age").eq("event_id", eventId),
    supabase.from("level_schedule_settings").select("level, plan_matches_per_team").eq("event_id", eventId),
  ]);

  if (teamsRes.error) return { ok: false, message: teamsRes.error.message };
  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };
  if (membersRes.error) return { ok: false, message: membersRes.error.message };
  if (playersRes.error) return { ok: false, message: playersRes.error.message };
  if (scheduleRes.error) return { ok: false, message: scheduleRes.error.message };

  const scheduleRows = (scheduleRes.data ?? []) as { level: string; plan_matches_per_team: number | null }[];
  const targetPerPool = Math.min(
    POOL_MAX_TEAMS,
    Math.max(2, poolPlanningHint(canonLevel, scheduleRows).matchesPerTeam + 1),
  );

  const levelTeams = (teamsRes.data ?? []).filter(
    (t) => canonicalBanerLevelLabel(t.level) === canonLevel,
  );
  const levelPools = (poolsRes.data ?? []).filter(
    (p) => canonicalBanerLevelLabel(p.level) === canonLevel,
  );
  const unassigned = levelTeams.filter((t) => !t.pool_id);

  if (unassigned.length === 0) {
    return { ok: false, message: "Ingen hold uden pulje at fordele." };
  }

  const playerAge = new Map(
    ((playersRes.data ?? []) as { id: string; age: number | null }[]).map((p) => [p.id, p.age]),
  );
  const membersByTeam = new Map<string, string[]>();
  for (const m of membersRes.data ?? []) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push(m.player_id);
    membersByTeam.set(m.team_id, list);
  }

  const avgAge = (teamId: string): number | null => {
    const ids = membersByTeam.get(teamId) ?? [];
    let sum = 0;
    let n = 0;
    for (const pid of ids) {
      const age = playerAge.get(pid);
      if (typeof age === "number" && !Number.isNaN(age)) {
        sum += age;
        n += 1;
      }
    }
    return n > 0 ? Math.round((sum / n) * 10) / 10 : null;
  };

  const teamsSorted = [...unassigned].sort((a, b) => (avgAge(b.id) ?? -1) - (avgAge(a.id) ?? -1));

  const openPools = levelPools.filter((p) => !p.is_closed);
  const openPoolIds = new Set(openPools.map((p) => p.id));
  const poolState = new Map<string, number>();
  for (const p of openPools) {
    poolState.set(p.id, levelTeams.filter((t) => t.pool_id === p.id).length);
  }

  const existingNames = levelPools.map((p) => p.name);
  const newPools: CreatedPoolRow[] = [];
  let maxSort =
    levelPools.length > 0 ? Math.max(...levelPools.map((p) => p.sort_order)) : 0;

  const pickPoolWithRoom = (): string | null => {
    let best: { poolId: string; count: number } | null = null;
    for (const [poolId, count] of poolState.entries()) {
      if (!openPoolIds.has(poolId)) continue;
      if (count >= targetPerPool) continue;
      if (!best || count < best.count) best = { poolId, count };
    }
    return best?.poolId ?? null;
  };

  const createOpenPool = async (): Promise<string | null> => {
    const name = suggestNextPoolName([...existingNames, ...newPools.map((p) => p.name)]);
    maxSort += 1;
    const { data, error } = await supabase
      .from("pools")
      .insert({
        event_id: eventId,
        level: canonLevel,
        name,
        sort_order: maxSort,
        is_closed: false,
      })
      .select("id, event_id, level, name, sort_order, period_id, is_closed")
      .single();

    if (error || !data) return null;

    const row = data as CreatedPoolRow;
    newPools.push(row);
    existingNames.push(name);
    openPoolIds.add(row.id);
    poolState.set(row.id, 0);
    return row.id;
  };

  const assignments: AutoAssignPoolsAssignment[] = [];
  let skipped = 0;

  for (const team of teamsSorted) {
    let poolId = pickPoolWithRoom();
    if (!poolId) {
      poolId = await createOpenPool();
      if (!poolId) {
        skipped = teamsSorted.length - assignments.length;
        break;
      }
    }
    const count = poolState.get(poolId) ?? 0;
    assignments.push({ teamId: team.id, poolId });
    poolState.set(poolId, count + 1);
  }

  if (assignments.length === 0) {
    return {
      ok: false,
      message: "Kunne ikke fordele hold — tjek Opsætning → Kampe og prøv igen.",
    };
  }

  const updates = await Promise.all(
    assignments.map((a) =>
      supabase.from("teams").update({ pool_id: a.poolId }).eq("id", a.teamId),
    ),
  );
  const updateErr = updates.find((r) => r.error)?.error;
  if (updateErr) {
    return { ok: false, message: updateErr.message };
  }

  revalidatePath("/turnering/puljer");
  revalidatePath(`/turnering/puljer/${encodeURIComponent(canonLevel)}`);
  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(canonLevel)}`);

  const createdNote =
    newPools.length > 0
      ? ` ${newPools.length} ${newPools.length === 1 ? "ny pulje" : "nye puljer"} oprettet.`
      : "";
  const base = `AutoPulje: ${assignments.length} hold fordelt (${targetPerPool} pr. pulje).${createdNote}`;
  const message = skipped > 0 ? `${base} ${skipped} hold kunne ikke placeres.` : base;

  return {
    ok: true,
    message,
    assigned: assignments.length,
    skipped,
    poolsCreated: newPools.length,
    assignments,
    newPools,
  };
}

/** Ensret `pools.level` til kanonisk navn (fjern stjerner / dubletter som "CoolStars …" vs "CoolStars … *"). */
export async function normalizePoolLevelLabelsAction(): Promise<TurneringActionResult & { updated?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const { data: pools, error: listErr } = await supabase
    .from("pools")
    .select("id, level")
    .eq("event_id", TURNERING_EVENT_ID);

  if (listErr) return { ok: false, message: listErr.message };

  let updated = 0;
  for (const pool of pools ?? []) {
    const canon = canonicalBanerLevelLabel(pool.level);
    if (pool.level === canon) continue;
    const { error } = await supabase.from("pools").update({ level: canon }).eq("id", pool.id);
    if (error) return { ok: false, message: error.message };
    updated += 1;
  }

  revalidatePath("/turnering");
  revalidatePath("/turnering/baner");
  revalidatePath("/turnering/puljer");
  revalidatePath("/turnering/plan");

  return {
    ok: true,
    message:
      updated > 0
        ? `${updated} pulje(r) fik ens niveau-navn i databasen.`
        : "Alle puljer havde allerede ens niveau-navne.",
    updated,
  };
}

/** Omdøb puljer i ét niveau til Pulje 1…n (løser dubletter fra tidligere oprettelse). */
export async function renumberPoolNamesForLevelAction(
  levelKey: string,
): Promise<TurneringActionResult & { updated?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const canon = canonicalBanerLevelLabel(levelKey);
  const { data: allPools, error: listErr } = await supabase
    .from("pools")
    .select("id, level, name, sort_order")
    .eq("event_id", TURNERING_EVENT_ID);

  if (listErr) return { ok: false, message: listErr.message };

  const levelPools = (allPools ?? [])
    .filter((p) => canonicalBanerLevelLabel(p.level) === canon)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da"));

  if (levelPools.length === 0) {
    return { ok: true, message: "Ingen puljer i dette niveau.", updated: 0 };
  }

  const needsRename = levelPools.some((p, i) => p.name !== `Pulje ${i + 1}`);
  if (!needsRename) {
    return { ok: true, message: "Puljenavne er allerede Pulje 1, 2, 3 …", updated: 0 };
  }

  for (let i = 0; i < levelPools.length; i += 1) {
    const { error } = await supabase
      .from("pools")
      .update({ name: `Pulje ${9000 + i}` })
      .eq("id", levelPools[i]!.id);
    if (error) return { ok: false, message: error.message };
  }

  let updated = 0;
  for (let i = 0; i < levelPools.length; i += 1) {
    const target = `Pulje ${i + 1}`;
    const { error } = await supabase.from("pools").update({ name: target }).eq("id", levelPools[i]!.id);
    if (error) return { ok: false, message: error.message };
    updated += 1;
  }

  revalidatePath("/turnering/puljer");
  revalidatePath(`/turnering/puljer/${encodeURIComponent(canon)}`);
  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(canon)}`);
  revalidatePath("/turnering/baner");

  return {
    ok: true,
    message: `${updated} puljer omdøbt til Pulje 1–${updated} i ${canon}.`,
    updated,
  };
}

export async function updateMatchScheduleAction(
  matchId: string,
  levelKey: string,
  courtId: string | null,
  startTimeIso: string,
  endTimeIso: string,
): Promise<TurneringActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at opdatere kampe." };
  }

  const { error } = await supabase
    .from("matches")
    .update({
      court_id: courtId,
      start_time: startTimeIso,
      end_time: endTimeIso,
    })
    .eq("id", matchId)
    .eq("event_id", TURNERING_EVENT_ID);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);

  return { ok: true, message: "Kamp opdateret." };
}

export async function generatePoolMatchesAction(
  poolId: string,
  levelKey: string,
  regenerate: boolean,
  options?: { skipSchedule?: boolean },
): Promise<TurneringActionResult & { scheduled?: number; matchCount?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at generere kampe." };
  }

  const { data: pool, error: poolErr } = await supabase
    .from("pools")
    .select("id, name, level")
    .eq("id", poolId)
    .eq("event_id", TURNERING_EVENT_ID)
    .maybeSingle();

  if (poolErr) return { ok: false, message: poolErr.message };
  if (!pool) return { ok: false, message: "Pulje ikke fundet." };

  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, sort_order, name")
    .eq("event_id", TURNERING_EVENT_ID)
    .eq("pool_id", poolId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (teamsErr) return { ok: false, message: teamsErr.message };
  if ((teams ?? []).length < 2) {
    return { ok: false, message: `${pool.name}: mindst 2 hold i puljen kræves.` };
  }

  if (regenerate) {
    const delRes = await supabase.from("matches").delete().eq("event_id", TURNERING_EVENT_ID).eq("pool_id", poolId);
    if (delRes.error) return { ok: false, message: delRes.error.message };
  }

  const { data: scheduleRows, error: scheduleErr } = await supabase
    .from("level_schedule_settings")
    .select("level, plan_matches_per_team")
    .eq("event_id", TURNERING_EVENT_ID);

  if (scheduleErr) return { ok: false, message: scheduleErr.message };

  const poolLevel = canonicalBanerLevelLabel(pool.level ?? levelKey);
  const matchesPerTeam = poolPlanningHint(poolLevel, scheduleRows ?? []).matchesPerTeam;
  const pairings = generateRoundRobinMatches(
    teams as { id: string; sort_order: number; name: string }[],
    matchesPerTeam,
  );
  if (pairings.length === 0) {
    return { ok: false, message: `${pool.name}: ingen kampe blev genereret.` };
  }

  const payload = pairings.map((match) => ({
    event_id: TURNERING_EVENT_ID,
    pool_id: poolId,
    team_a_id: match.teamAId,
    team_b_id: match.teamBId,
    court_id: null,
    start_time: null,
    end_time: null,
    status: "scheduled",
  }));

  const insRes = await supabase.from("matches").insert(payload);
  if (insRes.error) {
    return {
      ok: false,
      message: `Kunne ikke oprette kampe: ${insRes.error.message}`,
    };
  }

  if (options?.skipSchedule) {
    return {
      ok: true,
      message: `${pool.name}: ${payload.length} kampe oprettet.`,
      matchCount: payload.length,
      scheduled: 0,
    };
  }

  const schedule = await assignMatchScheduleForPool(supabase, poolId);

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  revalidatePath("/kampprogram");

  if (schedule.scheduled === 0) {
    return {
      ok: false,
      message:
        schedule.error ??
        `${pool.name}: ${payload.length} kampe oprettet, men ingen fik bane/tid. Tildel periode under Opsætning → Perioder.`,
      matchCount: payload.length,
      scheduled: 0,
    };
  }

  const partial =
    schedule.unscheduled > 0
      ? ` ${schedule.unscheduled} kampe mangler stadig bane/tid.`
      : "";
  const overflow =
    schedule.overflowPeriodNames.length > 0
      ? ` Nogle kampe ligger i ${schedule.overflowPeriodNames.join(", ")} fordi puljens periode var fuld.`
      : "";

  return {
    ok: true,
    message: `${pool.name}: ${payload.length} kampe genereret — ${schedule.scheduled} med bane og tid.${partial}${overflow}`,
    matchCount: payload.length,
    scheduled: schedule.scheduled,
  };
}

/** Generer (eller regenerer) kampe for alle puljer på niveauet — planlægger samlet ved «Hele dagen». */
export async function generateAllPoolMatchesForLevelAction(
  levelKey: string,
  regenerate: boolean,
): Promise<TurneringActionResult & { scheduled?: number; matchCount?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at generere kampe." };
  }

  const normalizedLevel = canonicalBanerLevelLabel(levelKey);

  const [poolsRes, scheduleRes, periodsRes] = await Promise.all([
    supabase
      .from("pools")
      .select("id, name, level, period_id, sort_order")
      .eq("event_id", TURNERING_EVENT_ID)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("level_schedule_settings").select("level, plan_matches_per_team").eq("event_id", TURNERING_EVENT_ID),
    supabase
      .from("tournament_periods")
      .select("id, event_id, name, start_time, end_time, sort_order, is_all_day")
      .eq("event_id", TURNERING_EVENT_ID),
  ]);

  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };
  if (scheduleRes.error) return { ok: false, message: scheduleRes.error.message };
  if (periodsRes.error) return { ok: false, message: periodsRes.error.message };

  const levelPools = ((poolsRes.data ?? []) as Array<{
    id: string;
    name: string;
    level: string | null;
    period_id: string | null;
    sort_order: number;
  }>).filter((p) => canonicalBanerLevelLabel(p.level) === normalizedLevel);

  if (levelPools.length === 0) {
    return { ok: false, message: `${normalizedLevel}: ingen puljer — opret puljer under Puljer.` };
  }

  const poolIds = levelPools.map((p) => p.id);

  if (regenerate && poolIds.length > 0) {
    const delRes = await supabase.from("matches").delete().eq("event_id", TURNERING_EVENT_ID).in("pool_id", poolIds);
    if (delRes.error) return { ok: false, message: delRes.error.message };
  }

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("pool_id")
    .eq("event_id", TURNERING_EVENT_ID)
    .in("pool_id", poolIds);

  const poolsWithMatches = new Set(((existingMatches ?? []) as { pool_id: string }[]).map((m) => m.pool_id));

  let totalMatchCount = 0;
  const generatedPoolIds: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const pool of levelPools) {
    if (!regenerate && poolsWithMatches.has(pool.id)) {
      skipped.push(pool.name);
      continue;
    }

    const result = await generatePoolMatchesAction(pool.id, levelKey, regenerate, { skipSchedule: true });
    if (!result.ok) {
      errors.push(`${pool.name}: ${result.message}`);
      continue;
    }
    totalMatchCount += result.matchCount ?? 0;
    generatedPoolIds.push(pool.id);
  }

  if (generatedPoolIds.length === 0 && errors.length === 0) {
    return {
      ok: false,
      message:
        skipped.length > 0
          ? `${normalizedLevel}: alle puljer har allerede kampe. Brug «Generer alle» igen for at regenerere.`
          : `${normalizedLevel}: ingen kampe blev genereret.`,
    };
  }

  if (generatedPoolIds.length === 0) {
    return { ok: false, message: errors.join(" ") };
  }

  const allPeriods = (periodsRes.data ?? []) as TournamentPeriodRow[];
  const allDayPeriodIds = new Set(allPeriods.filter((p) => isAllDayPeriod(p)).map((p) => p.id));
  const allDayPools = levelPools.filter((p) => p.period_id != null && allDayPeriodIds.has(p.period_id));

  let scheduled = 0;
  let unscheduled = 0;
  let scheduleError: string | null = null;
  const overflowNames: string[] = [];

  if (allDayPools.length > 0) {
    const anchor = allDayPools[0]!;
    const schedule = await assignMatchScheduleForLevelAllDay(
      supabase,
      normalizedLevel,
      anchor.id,
      anchor.period_id!,
    );
    scheduled = schedule.scheduled;
    unscheduled = schedule.unscheduled;
    scheduleError = schedule.error;
    overflowNames.push(...schedule.overflowPeriodNames);
  } else {
    const periodStartByPoolId = new Map(
      generatedPoolIds.map((poolId) => {
        const pool = levelPools.find((p) => p.id === poolId);
        const period = allPeriods.find((p) => p.id === pool?.period_id);
        const win = period ? periodWindowMinutes(period) : null;
        return [poolId, win?.startMinutes ?? 0] as const;
      }),
    );
    const scheduleOrder = [...generatedPoolIds].sort(
      (a, b) => (periodStartByPoolId.get(b) ?? 0) - (periodStartByPoolId.get(a) ?? 0),
    );

    for (const poolId of scheduleOrder) {
      const schedule = await assignMatchScheduleForPool(supabase, poolId);
      scheduled += schedule.scheduled;
      unscheduled += schedule.unscheduled;
      if (schedule.error && !scheduleError) scheduleError = schedule.error;
      for (const n of schedule.overflowPeriodNames) {
        if (!overflowNames.includes(n)) overflowNames.push(n);
      }
    }
  }

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  revalidatePath("/kampprogram");

  const partial = unscheduled > 0 ? ` ${unscheduled} kampe mangler bane/tid.` : "";
  const overflow =
    overflowNames.length > 0 ? ` Nogle kampe ligger i ${overflowNames.join(", ")}.` : "";
  const skipNote =
    skipped.length > 0 ? ` Sprang over (havde kampe): ${skipped.join(", ")}.` : "";
  const errNote = errors.length > 0 ? ` Fejl: ${errors.join(" ")}` : "";

  const ok = errors.length === 0 && unscheduled === 0 && scheduled > 0;

  return {
    ok,
    message: `${normalizedLevel}: ${totalMatchCount} kampe i ${generatedPoolIds.length} pulje(r) — ${scheduled} med bane og tid.${partial}${overflow}${skipNote}${errNote}${
      scheduleError && scheduled === 0 ? ` ${scheduleError}` : ""
    }`,
    matchCount: totalMatchCount,
    scheduled,
  };
}

/** Planlæg kun kampe i puljen der mangler bane/tid (fx efter period-overflow-fix). */
export async function schedulePoolMatchesAction(
  poolId: string,
  levelKey: string,
): Promise<TurneringActionResult & { scheduled?: number }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const { data: pool, error: poolErr } = await supabase
    .from("pools")
    .select("id, name")
    .eq("id", poolId)
    .eq("event_id", TURNERING_EVENT_ID)
    .maybeSingle();

  if (poolErr) return { ok: false, message: poolErr.message };
  if (!pool) return { ok: false, message: "Pulje ikke fundet." };

  const schedule = await assignMatchScheduleForPool(supabase, poolId);

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  revalidatePath("/kampprogram");

  if (schedule.scheduled === 0 && schedule.error) {
    return { ok: false, message: schedule.error, scheduled: 0 };
  }

  const partial =
    schedule.unscheduled > 0 ? ` ${schedule.unscheduled} kampe mangler stadig bane/tid.` : "";
  const overflow =
    schedule.overflowPeriodNames.length > 0
      ? ` Nogle kampe ligger i ${schedule.overflowPeriodNames.join(", ")} (puljens periode var fuld).`
      : "";

  if (schedule.scheduled === 0) {
    return {
      ok: false,
      message:
        schedule.error ??
        `${pool.name}: ingen kampe fik bane/tid.${partial} Tjek banetider under Opsætning → Haller & baner.`,
      scheduled: 0,
    };
  }

  return {
    ok: schedule.unscheduled === 0,
    message: `${pool.name}: ${schedule.scheduled} kamp(e) planlagt.${partial}${overflow}${
      schedule.error ? ` ${schedule.error}` : ""
    }`,
    scheduled: schedule.scheduled,
  };
}
