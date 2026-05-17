"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/auth-server";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { poolPlanningHint, suggestNextPoolName } from "@/lib/puljer";
import { generateRoundRobinMatches, TURNERING_EVENT_ID } from "@/lib/turnering";
import {
  assignMatchScheduleForLevelAllDay,
  assignMatchScheduleForPool,
} from "@/lib/turnering-scheduler";
import { isAllDayPeriod, type TournamentPeriodRow } from "@/lib/tournament-periods";

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
    for (const poolId of generatedPoolIds) {
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
