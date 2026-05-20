"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/auth-server";
import { canonicalBanerLevelLabel, sortLevelKeysForNav } from "@/lib/holddannelse";
import { fetchLevelSchedulePlanningRows } from "@/lib/level-schedule-settings";
import { effectivePoolMaxTeams, poolPlanningHint, suggestNextPoolName } from "@/lib/puljer";
import { generateRoundRobinMatches, TURNERING_EVENT_ID } from "@/lib/turnering";
import {
  assignMatchScheduleForLevelAllDay,
  assignMatchScheduleForLevelPeriodPools,
  assignMatchScheduleForPool,
  listManualScheduleSlotsForMatch,
  minutesToTimestamptz,
  type ManualScheduleSlotOption,
  type UnscheduledMatchDetail,
} from "@/lib/turnering-scheduler";
import { planningLockdownBlock } from "@/lib/kontrolcenter-lockdown-server";
import {
  isAllDayPeriod,
  periodWindowMinutes,
  type TournamentPeriodRow,
} from "@/lib/tournament-periods";

export type TurneringActionResult = {
  ok: boolean;
  message: string;
};

export type SchedulingFailureRow = {
  matchId: string;
  label: string;
  reason: string;
};

async function buildSchedulingFailureRows(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  details: readonly UnscheduledMatchDetail[],
): Promise<SchedulingFailureRow[]> {
  if (details.length === 0) return [];

  const matchIds = details.map((d) => d.matchId);
  const { data: matchRows, error } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .in("id", matchIds);

  if (error || !matchRows?.length) {
    return details.map((d) => ({
      matchId: d.matchId,
      label: "Kamp",
      reason: d.message,
    }));
  }

  const teamIds = new Set<string>();
  for (const m of matchRows) {
    teamIds.add(m.team_a_id);
    teamIds.add(m.team_b_id);
  }

  const { data: teamRows } = await supabase.from("teams").select("id, name").in("id", [...teamIds]);
  const nameById = new Map((teamRows ?? []).map((t) => [t.id, t.name as string]));
  const matchById = new Map(matchRows.map((m) => [m.id, m]));

  return details.map((d) => {
    const m = matchById.get(d.matchId);
    const label = m
      ? `${nameById.get(m.team_a_id) ?? "Hold"} vs ${nameById.get(m.team_b_id) ?? "Hold"}`
      : "Kamp";
    return { matchId: d.matchId, label, reason: d.message };
  });
}

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
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
  const locked = await planningLockdownBlock();
  if (locked) return locked;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const canonLevel = canonicalBanerLevelLabel(levelKey);
  const eventId = TURNERING_EVENT_ID;

  const [teamsRes, poolsRes, membersRes, playersRes] = await Promise.all([
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
  ]);

  if (teamsRes.error) return { ok: false, message: teamsRes.error.message };
  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };
  if (membersRes.error) return { ok: false, message: membersRes.error.message };
  if (playersRes.error) return { ok: false, message: playersRes.error.message };

  const scheduleFetch = await fetchLevelSchedulePlanningRows(supabase, eventId);
  if (scheduleFetch.error) return { ok: false, message: scheduleFetch.error };

  const scheduleRows = scheduleFetch.rows;
  const poolHint = poolPlanningHint(canonLevel, scheduleRows);
  const targetPerPool = poolHint.recommendedTeamCount;
  const maxPerPool = effectivePoolMaxTeams(poolHint);

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
      if (count >= targetPerPool || count >= maxPerPool) continue;
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
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
  options?: { scheduleRelaxedTeamRest?: boolean },
): Promise<TurneringActionResult> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
      schedule_relaxed_team_rest: options?.scheduleRelaxedTeamRest ?? false,
    })
    .eq("id", matchId)
    .eq("event_id", TURNERING_EVENT_ID);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  revalidatePath("/kampprogram");

  return { ok: true, message: "Kamp opdateret." };
}

export type ManualScheduleSlotsActionResult = TurneringActionResult & {
  levelKey?: string | null;
  teamALabel?: string | null;
  teamBLabel?: string | null;
  teamRestMinutes?: number;
  slots?: ManualScheduleSlotOption[];
};

export async function fetchManualScheduleSlotsAction(
  matchId: string,
): Promise<ManualScheduleSlotsActionResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const result = await listManualScheduleSlotsForMatch(supabase, matchId);
  if (!result.ok) {
    return { ok: false, message: result.error ?? "Kunne ikke hente ledige tider." };
  }

  return {
    ok: true,
    message: result.slots.length > 0 ? `${result.slots.length} ledige tider fundet.` : "Ingen ledige tider fundet.",
    levelKey: result.levelKey,
    teamALabel: result.teamALabel,
    teamBLabel: result.teamBLabel,
    teamRestMinutes: result.teamRestMinutes,
    slots: result.slots,
  };
}

export async function applyManualScheduleSlotAction(
  matchId: string,
  levelKey: string,
  courtId: string,
  startMinutes: number,
  endMinutes: number,
  respectsTeamRest: boolean,
): Promise<TurneringActionResult> {
  const startTimeIso = minutesToTimestamptz(startMinutes);
  const endTimeIso = minutesToTimestamptz(endMinutes);
  if (!startTimeIso || !endTimeIso) {
    return { ok: false, message: "Ugyldige tider." };
  }

  return updateMatchScheduleAction(matchId, levelKey, courtId, startTimeIso, endTimeIso, {
    scheduleRelaxedTeamRest: !respectsTeamRest,
  });
}

export async function generatePoolMatchesAction(
  poolId: string,
  levelKey: string,
  regenerate: boolean,
  options?: { skipSchedule?: boolean },
): Promise<
  TurneringActionResult & {
    scheduled?: number;
    matchCount?: number;
    schedulingFailures?: SchedulingFailureRow[];
  }
> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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

  const scheduleFetch = await fetchLevelSchedulePlanningRows(supabase, TURNERING_EVENT_ID);
  if (scheduleFetch.error) return { ok: false, message: scheduleFetch.error };

  const planningLevel = canonicalBanerLevelLabel(levelKey);
  const matchesPerTeam = poolPlanningHint(planningLevel, scheduleFetch.rows).matchesPerTeam;
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
      message: `${pool.name}: ${payload.length} kampe oprettet (${matchesPerTeam} kampe/hold).`,
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
      ? ` ${schedule.unscheduled} kampe mangler stadig bane/tid — se årsager nedenfor.`
      : "";
  const overflow =
    schedule.overflowPeriodNames.length > 0
      ? ` Nogle kampe ligger i ${schedule.overflowPeriodNames.join(", ")} fordi puljens periode var fuld.`
      : "";

  const schedulingFailures = schedule.unscheduledDetails?.length
    ? await buildSchedulingFailureRows(supabase, schedule.unscheduledDetails)
    : undefined;

  return {
    ok: schedule.unscheduled === 0,
    message: `${pool.name}: ${payload.length} kampe genereret (${matchesPerTeam} kampe/hold) — ${schedule.scheduled} med bane og tid.${partial}${overflow}${
      schedule.error ? ` ${schedule.error}` : ""
    }`,
    matchCount: payload.length,
    scheduled: schedule.scheduled,
    schedulingFailures,
  };
}

/** Generer (eller regenerer) kampe for alle puljer på niveauet — planlægger samlet ved «Hele dagen». */
export async function generateAllPoolMatchesForLevelAction(
  levelKey: string,
  regenerate: boolean,
): Promise<
  TurneringActionResult & {
    scheduled?: number;
    matchCount?: number;
    schedulingFailures?: SchedulingFailureRow[];
  }
> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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
  let unscheduledDetails: UnscheduledMatchDetail[] = [];

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
    if (schedule.unscheduledDetails) unscheduledDetails = schedule.unscheduledDetails;
  } else {
    const periodPools = generatedPoolIds.filter((poolId) => {
      const pool = levelPools.find((p) => p.id === poolId);
      return pool?.period_id != null && !allDayPeriodIds.has(pool.period_id);
    });

    if (periodPools.length >= 2) {
      const schedule = await assignMatchScheduleForLevelPeriodPools(
        supabase,
        normalizedLevel,
        periodPools,
      );
      scheduled = schedule.scheduled;
      unscheduled = schedule.unscheduled;
      scheduleError = schedule.error;
      if (schedule.unscheduledDetails) unscheduledDetails = schedule.unscheduledDetails;
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
        if (schedule.unscheduledDetails?.length) {
          unscheduledDetails.push(...schedule.unscheduledDetails);
        }
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

  let schedulingFailures =
    unscheduledDetails.length > 0
      ? await buildSchedulingFailureRows(supabase, unscheduledDetails)
      : undefined;

  if (unscheduled > 0 && (!schedulingFailures || schedulingFailures.length === 0)) {
    const { data: unscheduledRows } = await supabase
      .from("matches")
      .select("id, team_a_id, team_b_id, pool_id")
      .eq("event_id", TURNERING_EVENT_ID)
      .in("pool_id", generatedPoolIds)
      .or("court_id.is.null,start_time.is.null");
    if (unscheduledRows?.length) {
      schedulingFailures = await buildSchedulingFailureRows(
        supabase,
        unscheduledRows.map((m) => ({
          matchId: m.id,
          code: "unknown" as const,
          message: scheduleError ?? "Kunne ikke placeres — prøv «Planlæg manglende» igen",
        })),
      );
    }
  }

  return {
    ok,
    message: `${normalizedLevel}: ${totalMatchCount} kampe i ${generatedPoolIds.length} pulje(r) — ${scheduled} med bane og tid.${partial}${overflow}${skipNote}${errNote}${
      scheduleError && scheduled === 0 ? ` ${scheduleError}` : ""
    }${unscheduled > 0 ? " Se årsager nedenfor." : ""}`,
    matchCount: totalMatchCount,
    scheduled,
    schedulingFailures,
  };
}

/**
 * Generer (eller regenerer) kampe for alle puljer på alle niveauer i én kørsel.
 * Matcher oprettes først på tværs af turneringen; planlægning kører niveau for niveau så
 * hold-pause og banebelastning fra tidligere niveauer medtages.
 */
export async function generateAllPoolMatchesForTournamentAction(
  regenerate: boolean,
): Promise<
  TurneringActionResult & {
    scheduled?: number;
    matchCount?: number;
    levelCount?: number;
    schedulingFailures?: SchedulingFailureRow[];
  }
> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at generere kampe." };
  }

  const poolsRes = await supabase
    .from("pools")
    .select("id, level")
    .eq("event_id", TURNERING_EVENT_ID);

  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };

  const levelKeys = sortLevelKeysForNav(
    [
      ...new Set(
        ((poolsRes.data ?? []) as Array<{ id: string; level: string | null }>).map((p) =>
          canonicalBanerLevelLabel(p.level),
        ),
      ),
    ].filter(Boolean),
  );

  if (levelKeys.length === 0) {
    return { ok: false, message: "Ingen puljer — opret puljer under Puljer først." };
  }

  if (regenerate) {
    const delRes = await supabase.from("matches").delete().eq("event_id", TURNERING_EVENT_ID);
    if (delRes.error) return { ok: false, message: delRes.error.message };
  }

  let totalMatchCount = 0;
  let scheduled = 0;
  let unscheduled = 0;
  const errors: string[] = [];
  const skippedLevels: string[] = [];
  const schedulingFailures: SchedulingFailureRow[] = [];
  let levelsProcessed = 0;

  for (const levelKey of levelKeys) {
    const result = await generateAllPoolMatchesForLevelAction(levelKey, false);
    const levelMatches = result.matchCount ?? 0;
    const levelScheduled = result.scheduled ?? 0;
    if (levelMatches > 0 || levelScheduled > 0) {
      levelsProcessed += 1;
    }
    totalMatchCount += levelMatches;
    scheduled += levelScheduled;
    unscheduled += Math.max(0, levelMatches - levelScheduled);
    if (!result.ok && result.message) {
      if (result.message.includes("alle puljer har allerede kampe")) {
        skippedLevels.push(levelKey);
      } else {
        errors.push(`${levelKey}: ${result.message}`);
      }
    }
    if (result.schedulingFailures?.length) {
      schedulingFailures.push(...result.schedulingFailures);
    }
  }

  revalidatePath("/turnering/plan");
  revalidatePath("/kampprogram");
  for (const levelKey of levelKeys) {
    revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  }

  if (totalMatchCount === 0 && errors.length === 0 && skippedLevels.length === levelKeys.length) {
    return {
      ok: false,
      message:
        "Alle niveauer har allerede kampe. Brug knappen igen for at regenerere hele turneringen.",
      levelCount: 0,
    };
  }

  if (totalMatchCount === 0 && errors.length > 0) {
    return { ok: false, message: errors.join(" "), levelCount: levelsProcessed, schedulingFailures };
  }

  const partial = unscheduled > 0 ? ` ${unscheduled} kampe mangler bane/tid.` : "";
  const skipNote =
    skippedLevels.length > 0 ? ` Sprang over (havde kampe): ${skippedLevels.join(", ")}.` : "";
  const errNote = errors.length > 0 ? ` Fejl: ${errors.join(" ")}` : "";
  const ok = errors.length === 0 && unscheduled === 0 && scheduled > 0;

  return {
    ok,
    message: `Hele turneringen: ${totalMatchCount} kampe på ${levelsProcessed} niveau(er) — ${scheduled} med bane og tid.${partial}${skipNote}${errNote}${
      unscheduled > 0 ? " Se detaljer på det enkelte niveau." : ""
    }`,
    matchCount: totalMatchCount,
    scheduled,
    levelCount: levelsProcessed,
    schedulingFailures: schedulingFailures.length > 0 ? schedulingFailures : undefined,
  };
}

/** Slet alle genererede kampe for alle puljer på niveauet — uden at oprette nye. */
export async function clearAllPoolMatchesForLevelAction(
  levelKey: string,
): Promise<TurneringActionResult & { deletedCount?: number }> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind for at fjerne kampe." };
  }

  const normalizedLevel = canonicalBanerLevelLabel(levelKey);

  const poolsRes = await supabase
    .from("pools")
    .select("id, level")
    .eq("event_id", TURNERING_EVENT_ID);

  if (poolsRes.error) return { ok: false, message: poolsRes.error.message };

  const poolIds = ((poolsRes.data ?? []) as Array<{ id: string; level: string | null }>)
    .filter((p) => canonicalBanerLevelLabel(p.level) === normalizedLevel)
    .map((p) => p.id);

  if (poolIds.length === 0) {
    return { ok: false, message: `${normalizedLevel}: ingen puljer — intet at fjerne.` };
  }

  const countRes = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("event_id", TURNERING_EVENT_ID)
    .in("pool_id", poolIds);

  if (countRes.error) return { ok: false, message: countRes.error.message };

  const existingCount = countRes.count ?? 0;
  if (existingCount === 0) {
    return {
      ok: true,
      message: `${normalizedLevel}: ingen kampe at fjerne.`,
      deletedCount: 0,
    };
  }

  const delRes = await supabase
    .from("matches")
    .delete()
    .eq("event_id", TURNERING_EVENT_ID)
    .in("pool_id", poolIds);

  if (delRes.error) return { ok: false, message: delRes.error.message };

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(normalizedLevel)}`);
  revalidatePath("/kampprogram");

  return {
    ok: true,
    message: `${normalizedLevel}: ${existingCount} kampe fjernet fra alle puljer.`,
    deletedCount: existingCount,
  };
}

/** Planlæg kun kampe i puljen der mangler bane/tid (fx efter period-overflow-fix). */
export async function schedulePoolMatchesAction(
  poolId: string,
  levelKey: string,
): Promise<
  TurneringActionResult & { scheduled?: number; schedulingFailures?: SchedulingFailureRow[] }
> {
  const locked = await planningLockdownBlock();
  if (locked) return locked;

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

  const normalizedLevel = canonicalBanerLevelLabel(levelKey);

  const [siblingPoolsRes, periodsRes] = await Promise.all([
    supabase
      .from("pools")
      .select("id, level, period_id")
      .eq("event_id", TURNERING_EVENT_ID),
    supabase
      .from("tournament_periods")
      .select("id, is_all_day, name")
      .eq("event_id", TURNERING_EVENT_ID),
  ]);

  if (siblingPoolsRes.error) return { ok: false, message: siblingPoolsRes.error.message };
  if (periodsRes.error) return { ok: false, message: periodsRes.error.message };

  const allDayIds = new Set(
    ((periodsRes.data ?? []) as Array<{ id: string; is_all_day: boolean; name: string }>)
      .filter((p) => isAllDayPeriod(p))
      .map((p) => p.id),
  );

  const siblingPoolIds = ((siblingPoolsRes.data ?? []) as Array<{
    id: string;
    level: string | null;
    period_id: string | null;
  }>)
    .filter(
      (p) =>
        canonicalBanerLevelLabel(p.level) === normalizedLevel &&
        p.period_id != null &&
        !allDayIds.has(p.period_id),
    )
    .map((p) => p.id);

  const schedule =
    siblingPoolIds.length >= 2
      ? await assignMatchScheduleForLevelPeriodPools(supabase, normalizedLevel, siblingPoolIds)
      : await assignMatchScheduleForPool(supabase, poolId);

  revalidatePath("/turnering/plan");
  revalidatePath(`/turnering/plan/${encodeURIComponent(levelKey)}`);
  revalidatePath("/kampprogram");

  const schedulingFailuresFromSchedule = schedule.unscheduledDetails?.length
    ? await buildSchedulingFailureRows(supabase, schedule.unscheduledDetails)
    : undefined;

  if (schedule.scheduled === 0 && schedule.error) {
    return {
      ok: false,
      message: schedule.error,
      scheduled: 0,
      schedulingFailures: schedulingFailuresFromSchedule,
    };
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
      schedulingFailures: schedulingFailuresFromSchedule,
    };
  }

  let schedulingFailures = schedulingFailuresFromSchedule;
  if (schedule.unscheduled > 0 && (!schedulingFailures || schedulingFailures.length === 0)) {
    const { data: rows } = await supabase
      .from("matches")
      .select("id")
      .eq("event_id", TURNERING_EVENT_ID)
      .eq("pool_id", poolId)
      .or("court_id.is.null,start_time.is.null");
    if (rows?.length) {
      schedulingFailures = await buildSchedulingFailureRows(
        supabase,
        rows.map((m) => ({
          matchId: m.id,
          code: "unknown" as const,
          message: schedule.error ?? "Kunne ikke placeres",
        })),
      );
    }
  }

  return {
    ok: schedule.unscheduled === 0,
    message: `${pool.name}: ${schedule.scheduled} kamp(e) planlagt.${partial}${overflow}${
      schedule.error ? ` ${schedule.error}` : ""
    }${schedule.unscheduled > 0 ? " Se årsager nedenfor." : ""}`,
    scheduled: schedule.scheduled,
    schedulingFailures,
  };
}
