import type { SupabaseClient } from "@supabase/supabase-js";
import type { LevelSchedulePlanningRow } from "@/lib/puljer";

/** Kolonner fra migration `20260520130000_level_schedule_pool_settings.sql`. */
export const LEVEL_SCHEDULE_POOL_COLUMNS = [
  "plan_target_teams_per_pool",
  "plan_max_teams_per_pool",
] as const;

function isMissingPoolColumnsError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("plan_target_teams_per_pool") ||
    message.includes("plan_max_teams_per_pool")
  );
}

export type LevelSchedulePlanningRowWithTiming = LevelSchedulePlanningRow & {
  match_duration_minutes?: number | null;
  break_between_matches_minutes?: number | null;
};

function normalizeRow(
  row: Record<string, unknown>,
  poolColumnsAvailable: boolean,
  includeTiming: boolean,
): LevelSchedulePlanningRowWithTiming {
  const base: LevelSchedulePlanningRowWithTiming = {
    level: String(row.level ?? ""),
    plan_matches_per_team:
      row.plan_matches_per_team != null && Number.isFinite(Number(row.plan_matches_per_team))
        ? Math.floor(Number(row.plan_matches_per_team))
        : null,
    plan_target_teams_per_pool:
      poolColumnsAvailable &&
      row.plan_target_teams_per_pool != null &&
      Number.isFinite(Number(row.plan_target_teams_per_pool))
        ? Math.floor(Number(row.plan_target_teams_per_pool))
        : null,
    plan_max_teams_per_pool:
      poolColumnsAvailable &&
      row.plan_max_teams_per_pool != null &&
      Number.isFinite(Number(row.plan_max_teams_per_pool))
        ? Math.floor(Number(row.plan_max_teams_per_pool))
        : null,
  };
  if (!includeTiming) return base;
  return {
    ...base,
    match_duration_minutes:
      row.match_duration_minutes != null && Number.isFinite(Number(row.match_duration_minutes))
        ? Math.floor(Number(row.match_duration_minutes))
        : null,
    break_between_matches_minutes:
      row.break_between_matches_minutes != null &&
      Number.isFinite(Number(row.break_between_matches_minutes))
        ? Math.floor(Number(row.break_between_matches_minutes))
        : null,
  };
}

function rowHasPoolColumns(row: Record<string, unknown>): boolean {
  return "plan_target_teams_per_pool" in row || "plan_max_teams_per_pool" in row;
}

export type LevelScheduleFetchResult = {
  rows: LevelSchedulePlanningRowWithTiming[];
  error: string | null;
  /** False når pulje-kolonner mangler i databasen (migration ikke kørt). */
  poolColumnsAvailable: boolean;
};

export async function fetchLevelSchedulePlanningRows(
  supabase: SupabaseClient,
  eventId: string,
  options?: { includeTiming?: boolean },
): Promise<LevelScheduleFetchResult> {
  const includeTiming = options?.includeTiming ?? false;

  const res = await supabase.from("level_schedule_settings").select("*").eq("event_id", eventId);

  if (res.error) {
    return { rows: [], error: res.error.message, poolColumnsAvailable: false };
  }

  const raw = (res.data ?? []) as Record<string, unknown>[];
  const poolColumnsAvailable = raw.length === 0 || raw.some(rowHasPoolColumns);

  return {
    rows: raw.map((r) => normalizeRow(r, poolColumnsAvailable, includeTiming)),
    error: null,
    poolColumnsAvailable,
  };
}

export type LevelSchedulePlanningWrite = {
  plan_matches_per_team: number;
  plan_target_teams_per_pool?: number | null;
  plan_max_teams_per_pool?: number | null;
};

/** Gem planlægningsfelter; falder tilbage uden puljekolonner hvis migration mangler. */
export async function writeLevelSchedulePlanning(
  supabase: SupabaseClient,
  ids: string[],
  payload: LevelSchedulePlanningWrite,
): Promise<{ error: string | null; poolColumnsAvailable: boolean }> {
  if (ids.length === 0) return { error: null, poolColumnsAvailable: true };

  const fullPayload = {
    plan_matches_per_team: payload.plan_matches_per_team,
    plan_target_teams_per_pool: payload.plan_target_teams_per_pool ?? null,
    plan_max_teams_per_pool: payload.plan_max_teams_per_pool ?? null,
  };

  const fullRes = await supabase.from("level_schedule_settings").update(fullPayload).in("id", ids);
  if (!fullRes.error) return { error: null, poolColumnsAvailable: true };

  if (!isMissingPoolColumnsError(fullRes.error.message)) {
    return { error: fullRes.error.message, poolColumnsAvailable: false };
  }

  const baseRes = await supabase
    .from("level_schedule_settings")
    .update({ plan_matches_per_team: payload.plan_matches_per_team })
    .in("id", ids);

  return {
    error: baseRes.error?.message ?? null,
    poolColumnsAvailable: false,
  };
}

export async function fetchBanerLevelScheduleRows(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{
  data: Record<string, unknown>[] | null;
  error: string | null;
  poolColumnsAvailable: boolean;
}> {
  const res = await supabase.from("level_schedule_settings").select("*").eq("event_id", eventId);

  if (res.error) {
    return { data: null, error: res.error.message, poolColumnsAvailable: false };
  }

  const raw = (res.data ?? []) as Record<string, unknown>[];
  const poolColumnsAvailable = raw.length === 0 || raw.some(rowHasPoolColumns);

  const data = raw.map((r) => ({
    ...r,
    plan_target_teams_per_pool: poolColumnsAvailable ? (r.plan_target_teams_per_pool ?? null) : null,
    plan_max_teams_per_pool: poolColumnsAvailable ? (r.plan_max_teams_per_pool ?? null) : null,
  }));

  return { data, error: null, poolColumnsAvailable };
}

export async function insertLevelSchedulePlanning(
  supabase: SupabaseClient,
  row: LevelSchedulePlanningWrite & {
    event_id: string;
    level: string;
    match_duration_minutes: number;
    break_between_matches_minutes: number;
  },
): Promise<{ error: string | null; poolColumnsAvailable: boolean }> {
  const fullRes = await supabase.from("level_schedule_settings").insert({
    ...row,
    plan_target_teams_per_pool: row.plan_target_teams_per_pool ?? null,
    plan_max_teams_per_pool: row.plan_max_teams_per_pool ?? null,
  });

  if (!fullRes.error) return { error: null, poolColumnsAvailable: true };

  if (!isMissingPoolColumnsError(fullRes.error.message)) {
    return { error: fullRes.error.message, poolColumnsAvailable: false };
  }

  const { plan_target_teams_per_pool: _t, plan_max_teams_per_pool: _m, ...base } = row;
  const baseRes = await supabase.from("level_schedule_settings").insert(base);
  return {
    error: baseRes.error?.message ?? null,
    poolColumnsAvailable: false,
  };
}
