import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

export type VenueRow = {
  id: string;
  event_id: string;
  name: string;
  sort_order: number | null;
};

export type CourtRow = {
  id: string;
  venue_id: string;
  event_id: string | null;
  name: string;
  court_type: "large" | "small";
  is_active: boolean;
  sort_order: number | null;
};

export type CourtAvailabilityRow = {
  id: string;
  event_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
};

export type CourtBreakRow = {
  id: string;
  event_id: string;
  court_id: string;
  label: string | null;
  start_time: string;
  end_time: string;
};

export type LevelScheduleRow = {
  id: string;
  event_id: string;
  level: string;
  match_duration_minutes: number;
  break_between_matches_minutes: number;
};

export type BanerTiderBundle = {
  venues: VenueRow[];
  courts: CourtRow[];
  availability: CourtAvailabilityRow[];
  breaks: CourtBreakRow[];
  levelSettings: LevelScheduleRow[];
  levelKeys: string[];
  error: string | null;
};

/** Parser Postgres time / HH:MM til minutter fra midnat */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== "string") return null;
  const parts = t.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m + (Number.isFinite(s) ? s / 60 : 0);
}

export function minutesToTimeInput(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = Math.floor(m % 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function formatTimeForInput(t: string | null | undefined): string {
  const m = timeToMinutes(t);
  if (m == null) return "";
  return minutesToTimeInput(m);
}

export function validateAvailability(start: string, end: string): string | null {
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  if (a == null || b == null) return "Ugyldigt tidsformat.";
  if (b <= a) return "Sluttid skal være efter starttid.";
  return null;
}

export function validateBreakInsideAvailability(
  availStart: string,
  availEnd: string,
  breakStart: string,
  breakEnd: string,
): string | null {
  const as = timeToMinutes(availStart);
  const ae = timeToMinutes(availEnd);
  const bs = timeToMinutes(breakStart);
  const be = timeToMinutes(breakEnd);
  if (as == null || ae == null || bs == null || be == null) return "Ugyldigt tidsformat.";
  if (be <= bs) return "Pausens sluttid skal være efter starttid.";
  if (bs < as || be > ae) return "Pause skal ligge inden for hallens åbningstid.";
  return null;
}

export async function fetchBanerTiderData(supabase: SupabaseClient): Promise<BanerTiderBundle> {
  const eventId = TURNERING_EVENT_ID;

  const [venuesRes, playersRes, teamsRes] = await Promise.all([
    supabase.from("venues").select("id, event_id, name, sort_order").eq("event_id", eventId).order("sort_order", { ascending: true }),
    supabase.from("players").select("level").eq("event_id", eventId),
    supabase.from("teams").select("level").eq("event_id", eventId),
  ]);

  if (venuesRes.error) {
    return {
      venues: [],
      courts: [],
      availability: [],
      breaks: [],
      levelSettings: [],
      levelKeys: [],
      error: venuesRes.error.message,
    };
  }

  const venues = (venuesRes.data ?? []) as VenueRow[];
  const venueIds = venues.map((v) => v.id);

  const levelSet = new Set<string>();
  for (const row of (playersRes.data ?? []) as { level: string | null }[]) {
    levelSet.add(normalizeLevelKey(row.level));
  }
  for (const row of (teamsRes.data ?? []) as { level: string | null }[]) {
    levelSet.add(normalizeLevelKey(row.level));
  }

  const courtsRes =
    venueIds.length > 0
      ? await supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .in("venue_id", venueIds)
          .order("sort_order", { ascending: true })
      : await supabase
          .from("courts")
          .select("id, venue_id, event_id, name, court_type, is_active, sort_order")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true });

  if (courtsRes.error) {
    return {
      venues,
      courts: [],
      availability: [],
      breaks: [],
      levelSettings: [],
      levelKeys: sortLevelKeysForNav([...levelSet]),
      error: courtsRes.error.message,
    };
  }

  let courts = (courtsRes.data ?? []) as CourtRow[];
  courts = courts.filter((c) => !c.event_id || c.event_id === eventId);

  const courtIds = courts.map((c) => c.id);

  const [availRes, breaksRes, levelRes] = await Promise.all([
    courtIds.length
      ? supabase
          .from("court_availability")
          .select("id, event_id, court_id, start_time, end_time")
          .eq("event_id", eventId)
          .in("court_id", courtIds)
      : Promise.resolve({ data: [], error: null } as const),
    courtIds.length
      ? supabase
          .from("court_breaks")
          .select("id, event_id, court_id, label, start_time, end_time")
          .eq("event_id", eventId)
          .in("court_id", courtIds)
          .order("start_time", { ascending: true })
      : Promise.resolve({ data: [], error: null } as const),
    supabase.from("level_schedule_settings").select("id, event_id, level, match_duration_minutes, break_between_matches_minutes").eq("event_id", eventId),
  ]);

  const err = availRes.error?.message ?? breaksRes.error?.message ?? levelRes.error?.message ?? null;
  if (err) {
    return {
      venues,
      courts,
      availability: [],
      breaks: [],
      levelSettings: [],
      levelKeys: sortLevelKeysForNav([...levelSet]),
      error: err,
    };
  }

  const levelSettings = (levelRes.data ?? []) as LevelScheduleRow[];
  for (const row of levelSettings) {
    levelSet.add(normalizeLevelKey(row.level));
  }

  const availabilityRows = (availRes.data ?? []) as CourtAvailabilityRow[];
  const availabilityByCourt = new Map<string, CourtAvailabilityRow>();
  for (const row of availabilityRows) {
    if (!availabilityByCourt.has(row.court_id)) availabilityByCourt.set(row.court_id, row);
  }

  return {
    venues,
    courts,
    availability: [...availabilityByCourt.values()],
    breaks: (breaksRes.data ?? []) as CourtBreakRow[],
    levelSettings,
    levelKeys: sortLevelKeysForNav([...levelSet]),
    error: null,
  };
}
