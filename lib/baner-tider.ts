import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalBanerLevelLabel, sortLevelKeysForNav } from "@/lib/holddannelse";
import { fetchBanerLevelScheduleRows } from "@/lib/level-schedule-settings";
import { computeScheduledRoundsByCourtId } from "@/lib/lykkecup-regnemaskine";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

/** DB enum `court_type`: mini (tidligere small), kort (ny), stor (tidligere large). */
export const COURT_TYPES = ["mini", "kort", "stor"] as const;
export type CourtType = (typeof COURT_TYPES)[number];

/** Sorter banetyper: Mini → Kort → Stor (ukendte sidst). */
export function compareCourtTypes(a: string, b: string): number {
  const ia = COURT_TYPES.indexOf(a as CourtType);
  const ib = COURT_TYPES.indexOf(b as CourtType);
  const ra = ia === -1 ? 999 : ia;
  const rb = ib === -1 ? 999 : ib;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, "da");
}

const BANE_NAME_NUMBER_RE = /Bane\s*(\d+)/i;

/** Numerisk rækkefølge for banenavne (Bane 1, Bane 2, … Bane 10). */
export function compareCourtNamesForSchedule(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const key = (name: string | null | undefined) => {
    if (!name) return Number.POSITIVE_INFINITY;
    const m = BANE_NAME_NUMBER_RE.exec(name.trim());
    if (m) return Number.parseInt(m[1]!, 10);
    return Number.POSITIVE_INFINITY - 1;
  };
  const na = key(a);
  const nb = key(b);
  if (na !== nb) return na - nb;
  return (a ?? "").localeCompare(b ?? "", "da", { numeric: true, sensitivity: "base" });
}

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
  court_type: CourtType;
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
  /** Antal på hinanden følgende runder (9+1 min) én kamp optager — fx 2 for to halvlege. */
  rounds_per_match: number;
  /** Regnemaskine: null = brug standard i UI */
  plan_target_players_per_team: number | null;
  plan_matches_per_team: number | null;
  /** Puljer: mål hold pr. pulje; null = kampe/hold + 1 */
  plan_target_teams_per_pool: number | null;
  /** Puljer: valgfri hård grænse; null = kun systemloft */
  plan_max_teams_per_pool: number | null;
};

export type LevelCourtSettingRow = {
  id: string;
  event_id: string;
  level: string;
  court_type: CourtType;
};

/** Til opslag uden id — fx defaults fra Regnemaskine. */
export type LevelCourtSettingLike = Pick<LevelCourtSettingRow, "level" | "court_type">;

export type BanerTiderBundle = {
  venues: VenueRow[];
  courts: CourtRow[];
  availability: CourtAvailabilityRow[];
  breaks: CourtBreakRow[];
  levelSettings: LevelScheduleRow[];
  /** Gemte niveau → banetype; tom rækker bruger defaults i `courtTypeForLevel`. */
  levelCourtSettings: LevelCourtSettingRow[];
  levelKeys: string[];
  /** Planlagte runder pr. bane (sum af runder pr. kamp for planlagte kampe). */
  scheduledSlotsByCourtId: Record<string, number>;
  error: string | null;
};

/** Dato brugt når vi gemmer kun klokkeslæt som `timestamptz` (UTC, vægur = UTC-tal). */
const TIME_ANCHOR_DATE = "2000-01-01";

/** Parser Postgres `timestamptz` / ISO eller ren HH:MM til minutter fra midnat (UTC for ISO). */
export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== "string") return null;
  const trimmed = t.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    }
  }
  const parts = trimmed.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  const s = Number(parts[2] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m + (Number.isFinite(s) ? s / 60 : 0);
}

/** HH:MM fra formularen → ISO-streng som Postgres accepterer for `timestamptz`. */
export function timeInputToTimestamptz(timeInput: string): string | null {
  const total = timeToMinutes(timeInput);
  if (total == null) return null;
  const h = Math.floor(total / 60) % 24;
  const min = Math.floor(total % 60);
  return `${TIME_ANCHOR_DATE}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`;
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

function mergeLevelScheduleRow(a: LevelScheduleRow, b: LevelScheduleRow): LevelScheduleRow {
  const moreSpecific = a.level.length >= b.level.length ? a : b;
  const other = moreSpecific === a ? b : a;
  const canon = canonicalBanerLevelLabel(moreSpecific.level);
  const planMatches =
    moreSpecific.plan_matches_per_team != null
      ? moreSpecific.plan_matches_per_team
      : other.plan_matches_per_team;
  return {
    ...moreSpecific,
    level: canon,
    plan_target_players_per_team: moreSpecific.plan_target_players_per_team ?? other.plan_target_players_per_team,
    plan_matches_per_team: planMatches,
    plan_target_teams_per_pool:
      moreSpecific.plan_target_teams_per_pool ?? other.plan_target_teams_per_pool,
    plan_max_teams_per_pool: moreSpecific.plan_max_teams_per_pool ?? other.plan_max_teams_per_pool,
    match_duration_minutes: moreSpecific.match_duration_minutes || other.match_duration_minutes,
    break_between_matches_minutes:
      moreSpecific.break_between_matches_minutes || other.break_between_matches_minutes,
    rounds_per_match: Math.max(moreSpecific.rounds_per_match ?? 1, other.rounds_per_match ?? 1),
  };
}

function dedupeLevelScheduleRows(rows: LevelScheduleRow[]): LevelScheduleRow[] {
  const map = new Map<string, LevelScheduleRow>();
  for (const row of rows) {
    const key = canonicalBanerLevelLabel(row.level);
    const prev = map.get(key);
    map.set(key, prev ? mergeLevelScheduleRow(prev, row) : { ...row, level: key });
  }
  return sortLevelKeysForNav([...map.keys()]).map((k) => map.get(k)!);
}

function dedupeLevelCourtSettingsRows(rows: LevelCourtSettingRow[]): LevelCourtSettingRow[] {
  const map = new Map<string, LevelCourtSettingRow>();
  for (const row of rows) {
    const key = canonicalBanerLevelLabel(row.level);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row, level: key });
      continue;
    }
    const prefer = prev.level.length <= row.level.length ? prev : row;
    const other = prefer === prev ? row : prev;
    map.set(key, { ...prefer, level: key, court_type: prefer.court_type ?? other.court_type });
  }
  return sortLevelKeysForNav([...map.keys()]).map((k) => map.get(k)!);
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
      levelCourtSettings: [],
      levelKeys: [],
      scheduledSlotsByCourtId: {},
      error: venuesRes.error.message,
    };
  }

  const venues = (venuesRes.data ?? []) as VenueRow[];
  const venueIds = venues.map((v) => v.id);

  const levelSet = new Set<string>();
  for (const row of (playersRes.data ?? []) as { level: string | null }[]) {
    levelSet.add(canonicalBanerLevelLabel(row.level));
  }
  for (const row of (teamsRes.data ?? []) as { level: string | null }[]) {
    levelSet.add(canonicalBanerLevelLabel(row.level));
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
      levelCourtSettings: [],
      levelKeys: sortLevelKeysForNav([...levelSet]),
      scheduledSlotsByCourtId: {},
      error: courtsRes.error.message,
    };
  }

  let courts = (courtsRes.data ?? []) as CourtRow[];
  courts = courts.filter((c) => !c.event_id || c.event_id === eventId);

  const courtIds = courts.map((c) => c.id);

  const [availRes, breaksRes, levelCourtRes, matchesRes, poolsRes] = await Promise.all([
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
    supabase.from("level_court_settings").select("id, event_id, level, court_type").eq("event_id", eventId),
    supabase.from("matches").select("court_id, pool_id").eq("event_id", eventId).not("court_id", "is", null),
    supabase.from("pools").select("id, level").eq("event_id", eventId),
  ]);

  const levelFetch = await fetchBanerLevelScheduleRows(supabase, eventId);

  const err =
    availRes.error?.message ??
    breaksRes.error?.message ??
    levelFetch.error ??
    levelCourtRes.error?.message ??
    matchesRes.error?.message ??
    poolsRes.error?.message ??
    null;
  if (err) {
    return {
      venues,
      courts,
      availability: [],
      breaks: [],
      levelSettings: [],
      levelCourtSettings: [],
      levelKeys: sortLevelKeysForNav([...levelSet]),
      scheduledSlotsByCourtId: {},
      error: err,
    };
  }

  const levelSettingsRaw = (levelFetch.data ?? []).map((row) => {
    const r = row as LevelScheduleRow & {
      rounds_per_match?: number | null;
      plan_target_players_per_team?: number | null;
      plan_matches_per_team?: number | null;
      plan_target_teams_per_pool?: number | null;
      plan_max_teams_per_pool?: number | null;
    };
    const rpm = r.rounds_per_match;
    const clampPoolField = (v: number | null | undefined): number | null => {
      if (v == null || !Number.isFinite(v)) return null;
      const n = Math.floor(v);
      return n >= 2 && n <= 99 ? n : null;
    };
    return {
      ...r,
      rounds_per_match:
        rpm != null && Number.isFinite(rpm) && rpm >= 1 ? Math.min(4, Math.floor(rpm)) : 1,
      plan_target_players_per_team: r.plan_target_players_per_team ?? null,
      plan_matches_per_team: r.plan_matches_per_team ?? null,
      plan_target_teams_per_pool: clampPoolField(r.plan_target_teams_per_pool),
      plan_max_teams_per_pool: clampPoolField(r.plan_max_teams_per_pool),
    };
  });
  const levelSettings = dedupeLevelScheduleRows(levelSettingsRaw);
  for (const row of levelSettings) {
    levelSet.add(canonicalBanerLevelLabel(row.level));
  }

  const poolLevelById = new Map(
    ((poolsRes.data ?? []) as { id: string; level: string | null }[]).map((p) => [p.id, p.level]),
  );
  const scheduledSlotsByCourtId = computeScheduledRoundsByCourtId(
    (matchesRes.data ?? []) as { court_id: string; pool_id: string }[],
    poolLevelById,
    levelSettings,
  );

  const levelCourtSettings = dedupeLevelCourtSettingsRows((levelCourtRes.data ?? []) as LevelCourtSettingRow[]);
  for (const row of levelCourtSettings) {
    levelSet.add(canonicalBanerLevelLabel(row.level));
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
    levelCourtSettings,
    levelKeys: sortLevelKeysForNav([...levelSet]),
    scheduledSlotsByCourtId,
    error: null,
  };
}
