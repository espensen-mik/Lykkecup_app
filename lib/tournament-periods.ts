import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTimeForInput, timeInputToTimestamptz, timeToMinutes, validateAvailability } from "@/lib/baner-tider";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

export type TournamentPeriodRow = {
  id: string;
  event_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
};

export type PoolPeriodAssignmentRow = {
  id: string;
  level: string | null;
  name: string;
  sort_order: number;
  period_id: string | null;
};

export type PeriodsBundle = {
  periods: TournamentPeriodRow[];
  pools: PoolPeriodAssignmentRow[];
  error: string | null;
};

export const DEFAULT_PERIODS: Array<{ name: string; start: string; end: string }> = [
  { name: "Formiddag", start: "08:00", end: "12:00" },
  { name: "Eftermiddag", start: "12:00", end: "17:00" },
];

export function periodWindowMinutes(period: Pick<TournamentPeriodRow, "start_time" | "end_time">): {
  startMinutes: number;
  endMinutes: number;
} | null {
  const startMinutes = timeToMinutes(period.start_time);
  const endMinutes = timeToMinutes(period.end_time);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

export function formatPeriodRange(period: Pick<TournamentPeriodRow, "start_time" | "end_time">): string {
  const a = formatTimeForInput(period.start_time);
  const b = formatTimeForInput(period.end_time);
  if (!a || !b) return "—";
  return `${a}–${b}`;
}

export async function fetchPeriodsBundle(supabase: SupabaseClient): Promise<PeriodsBundle> {
  const eventId = TURNERING_EVENT_ID;
  const [periodsRes, poolsRes] = await Promise.all([
    supabase
      .from("tournament_periods")
      .select("id, event_id, name, start_time, end_time, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("pools")
      .select("id, level, name, sort_order, period_id")
      .eq("event_id", eventId)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (periodsRes.error) {
    return { periods: [], pools: [], error: periodsRes.error.message };
  }
  if (poolsRes.error) {
    return { periods: (periodsRes.data ?? []) as TournamentPeriodRow[], pools: [], error: poolsRes.error.message };
  }

  return {
    periods: (periodsRes.data ?? []) as TournamentPeriodRow[],
    pools: (poolsRes.data ?? []) as PoolPeriodAssignmentRow[],
    error: null,
  };
}

export function validatePeriodTimes(start: string, end: string): string | null {
  return validateAvailability(start, end);
}

export function periodInsertPayload(name: string, start: string, end: string, sortOrder: number) {
  const start_time = timeInputToTimestamptz(start);
  const end_time = timeInputToTimestamptz(end);
  if (!start_time || !end_time) throw new Error("Ugyldigt tidsformat.");
  const err = validatePeriodTimes(start, end);
  if (err) throw new Error(err);
  return {
    event_id: TURNERING_EVENT_ID,
    name: name.trim(),
    start_time,
    end_time,
    sort_order: sortOrder,
  };
}
