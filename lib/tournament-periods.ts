import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTimeForInput, timeInputToTimestamptz, timeToMinutes, validateAvailability } from "@/lib/baner-tider";
import type { RegnemaskineAvailability } from "@/lib/lykkecup-regnemaskine";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

export const ALL_DAY_PERIOD_NAME = "Hele dagen";

/** Standard planlægningsvindue når baner ikke har eksplicit tilgængelighed. */
export const ALL_DAY_SCHEDULING_START_MINUTES = 6 * 60;
export const ALL_DAY_SCHEDULING_END_MINUTES = 22 * 60;

export type TournamentPeriodRow = {
  id: string;
  event_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  is_all_day: boolean;
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

export const ALL_DAY_PERIOD_PRESET = {
  name: ALL_DAY_PERIOD_NAME,
  start: "06:00",
  end: "22:00",
} as const;

export function isAllDayPeriod(
  period: Pick<TournamentPeriodRow, "is_all_day" | "name">,
): boolean {
  return period.is_all_day === true || period.name.trim().toLowerCase() === ALL_DAY_PERIOD_NAME.toLowerCase();
}

export function periodWindowMinutes(period: Pick<TournamentPeriodRow, "start_time" | "end_time">): {
  startMinutes: number;
  endMinutes: number;
} | null {
  const startMinutes = timeToMinutes(period.start_time);
  const endMinutes = timeToMinutes(period.end_time);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

/** Planlægningsvindue: for «Hele dagen» = banernes tilgængelighed (ikke Formiddag/Eftermiddag). */
export function periodWindowForScheduling(
  period: Pick<TournamentPeriodRow, "start_time" | "end_time" | "is_all_day" | "name">,
  baseAvailability?: readonly RegnemaskineAvailability[],
  courtIds?: readonly string[],
): { startMinutes: number; endMinutes: number } | null {
  if (!isAllDayPeriod(period)) {
    return periodWindowMinutes(period);
  }

  if (baseAvailability && courtIds && courtIds.length > 0) {
    const courtSet = new Set(courtIds);
    let min = ALL_DAY_SCHEDULING_END_MINUTES;
    let max = ALL_DAY_SCHEDULING_START_MINUTES;
    for (const row of baseAvailability) {
      if (!courtSet.has(row.courtId)) continue;
      if (row.endMinutes <= row.startMinutes) continue;
      min = Math.min(min, row.startMinutes);
      max = Math.max(max, row.endMinutes);
    }
    if (max > min) {
      return { startMinutes: min, endMinutes: max };
    }
  }

  return {
    startMinutes: ALL_DAY_SCHEDULING_START_MINUTES,
    endMinutes: ALL_DAY_SCHEDULING_END_MINUTES,
  };
}

export function formatPeriodRange(
  period: Pick<TournamentPeriodRow, "start_time" | "end_time" | "is_all_day" | "name">,
): string {
  if (isAllDayPeriod(period)) {
    return "Hele dagen (bane-tider)";
  }
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
      .select("id, event_id, name, start_time, end_time, sort_order, is_all_day")
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
    periods: ((periodsRes.data ?? []) as Array<TournamentPeriodRow & { is_all_day?: boolean }>).map(
      (p) => ({
        ...p,
        is_all_day: p.is_all_day === true,
      }),
    ),
    pools: (poolsRes.data ?? []) as PoolPeriodAssignmentRow[],
    error: null,
  };
}

export function validatePeriodTimes(start: string, end: string): string | null {
  return validateAvailability(start, end);
}

export function periodInsertPayload(
  name: string,
  start: string,
  end: string,
  sortOrder: number,
  isAllDay = false,
) {
  const start_time = timeInputToTimestamptz(start);
  const end_time = timeInputToTimestamptz(end);
  if (!start_time || !end_time) throw new Error("Ugyldigt tidsformat.");
  if (!isAllDay) {
    const err = validatePeriodTimes(start, end);
    if (err) throw new Error(err);
  }
  return {
    event_id: TURNERING_EVENT_ID,
    name: name.trim(),
    start_time,
    end_time,
    sort_order: sortOrder,
    is_all_day: isAllDay,
  };
}
