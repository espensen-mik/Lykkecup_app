import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { HoldPlayerRow, TeamMemberRow, TeamRow } from "@/types/teams";

export const HOLD_EVENT_ID = LYKKECUP_EVENT_ID;

/** Kanonisk niveau-nøgle til gruppering og URL (tom → ukendt). */
export function normalizeLevelKey(level: string | null | undefined): string {
  const t = level?.trim();
  return t && t.length > 0 ? t : "Ukendt niveau";
}

export function levelPathSegment(levelKey: string): string {
  return encodeURIComponent(levelKey);
}

/**
 * Officiel rækkefølge: lavest → højest (Cool → Rock).
 * Bruges til sidemenu og holddannelse-oversigt. Matcher DB-navne som "CoolStars (4-17 år)".
 */
export const HOLDDANNELSE_LEVEL_ORDER = [
  "Coolstars",
  "Superstars",
  "Powerstars",
  "Turbostars",
  "Jazz",
  "Funk",
  "Rock",
] as const;

/** Til sammenligning: fjern parenteser, små bogstaver, ingen mellemrum. */
function levelSortToken(raw: string): string {
  return raw
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * Første sammenhængende latinske bogstav-run (a–z), ellers første run hvor som helst i strengen.
 * Sikrer at "JAZZ (18-25 år) ***" og edge cases stadig matcher "jazz" — også hvis token ikke starter med bogstav.
 */
function primaryLevelSlug(raw: string): string {
  const n = levelSortToken(raw);
  const head = n.match(/^[a-z]+/);
  if (head) return head[0];
  const any = n.match(/[a-z]+/);
  return any ? any[0] : n;
}

/** Stabil nøgle til farver i UI (Spillere, Klubber m.m.). */
export function levelSlugForPalette(level: string | null | undefined): string {
  if (level == null || String(level).trim() === "") return "ukendt";
  const t = String(level).trim();
  if (t === "Ukendt niveau") return "ukendt";
  const slug = primaryLevelSlug(t);
  return slug || "ukendt";
}

/** Lavere tal = højere prioritet i menuen. Ukendte niveauer efter kendte, derefter A–Å. */
export function rankLevelKeyForSorting(levelKey: string): number {
  if (levelKey === "Ukendt niveau") return 10_000;
  const normalized = levelSortToken(levelKey);
  const slug = primaryLevelSlug(levelKey);

  for (let i = 0; i < HOLDDANNELSE_LEVEL_ORDER.length; i++) {
    const token = levelSortToken(HOLDDANNELSE_LEVEL_ORDER[i]);
    const orderSlug = primaryLevelSlug(HOLDDANNELSE_LEVEL_ORDER[i]);

    if (normalized === token) return i;
    if (normalized.startsWith(token) || token.startsWith(normalized)) return i;
    if (slug && orderSlug && slug === orderSlug) return i;
    if (orderSlug.length >= 5 && slug.startsWith(orderSlug)) return i;
    if (slug.length >= 5 && orderSlug.startsWith(slug)) return i;
  }
  return 1000;
}

export function sortLevelKeysForNav(levelKeys: string[]): string[] {
  return [...levelKeys].sort((a, b) => {
    const ra = rankLevelKeyForSorting(a);
    const rb = rankLevelKeyForSorting(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, "da", { numeric: true, sensitivity: "base" });
  });
}

export type LevelOverviewStats = {
  levelKey: string;
  totalPlayers: number;
  assignedPlayers: number;
  unassignedPlayers: number;
  teamCount: number;
};

export async function fetchHolddannelseOverview(): Promise<{
  levels: LevelOverviewStats[];
  error: string | null;
}> {
  const eventId = HOLD_EVENT_ID;

  const [playersRes, teamsRes, membersRes] = await Promise.all([
    supabase.from("players").select("id, level").eq("event_id", eventId),
    supabase.from("teams").select("id, level").eq("event_id", eventId),
    supabase.from("team_members").select("id, player_id, team_id").eq("event_id", eventId),
  ]);

  if (playersRes.error) {
    return { levels: [], error: playersRes.error.message };
  }
  if (teamsRes.error) {
    return { levels: [], error: teamsRes.error.message };
  }
  if (membersRes.error) {
    return { levels: [], error: membersRes.error.message };
  }

  const players = (playersRes.data ?? []) as { id: string; level: string | null }[];
  const teams = (teamsRes.data ?? []) as Pick<TeamRow, "id" | "level">[];
  const members = (membersRes.data ?? []) as Pick<TeamMemberRow, "player_id" | "team_id">[];

  const teamLevelById = new Map<string, string>();
  for (const t of teams) {
    teamLevelById.set(t.id, normalizeLevelKey(t.level));
  }

  const playerLevel = new Map<string, string>();
  const levelPlayerIds = new Map<string, Set<string>>();
  for (const p of players) {
    const key = normalizeLevelKey(p.level);
    playerLevel.set(p.id, key);
    let set = levelPlayerIds.get(key);
    if (!set) {
      set = new Set();
      levelPlayerIds.set(key, set);
    }
    set.add(p.id);
  }

  const assignedInLevel = new Map<string, Set<string>>();
  for (const m of members) {
    const lvl = teamLevelById.get(m.team_id);
    if (!lvl) continue;
    let set = assignedInLevel.get(lvl);
    if (!set) {
      set = new Set();
      assignedInLevel.set(lvl, set);
    }
    set.add(m.player_id);
  }

  const teamCountByLevel = new Map<string, number>();
  for (const t of teams) {
    const k = normalizeLevelKey(t.level);
    teamCountByLevel.set(k, (teamCountByLevel.get(k) ?? 0) + 1);
  }

  const levelKeys = sortLevelKeysForNav([...levelPlayerIds.keys()]);

  const levels: LevelOverviewStats[] = levelKeys.map((levelKey) => {
    const ids = levelPlayerIds.get(levelKey) ?? new Set();
    const assigned = assignedInLevel.get(levelKey) ?? new Set();
    let assignedCount = 0;
    for (const pid of ids) {
      if (assigned.has(pid)) assignedCount += 1;
    }
    return {
      levelKey,
      totalPlayers: ids.size,
      assignedPlayers: assignedCount,
      unassignedPlayers: ids.size - assignedCount,
      teamCount: teamCountByLevel.get(levelKey) ?? 0,
    };
  });

  return { levels, error: null };
}

export type HoldLevelBundle = {
  players: HoldPlayerRow[];
  teams: TeamRow[];
  members: TeamMemberRow[];
  /** Alle spillere der allerede er på et hold i dette arrangement (én hold-plads pr. spiller). */
  eventAssignedPlayerIds: string[];
  error: string | null;
};

export async function fetchHoldLevelData(levelKey: string): Promise<HoldLevelBundle> {
  const eventId = HOLD_EVENT_ID;
  const normalized = normalizeLevelKey(levelKey);

  const playersQuery = supabase
    .from("players")
    .select("id, name, home_club, age, gender, level, preferences")
    .eq("event_id", eventId);

  const { data: allPlayers, error: pErr } = normalized === "Ukendt niveau"
    ? await playersQuery
    : await supabase
        .from("players")
        .select("id, name, home_club, age, gender, level, preferences")
        .eq("event_id", eventId)
        .eq("level", normalized);

  if (pErr) {
    return { players: [], teams: [], members: [], eventAssignedPlayerIds: [], error: pErr.message };
  }

  let players = (allPlayers ?? []) as HoldPlayerRow[];
  if (normalized === "Ukendt niveau") {
    players = players.filter((p) => normalizeLevelKey(p.level) === "Ukendt niveau");
  }

  const { data: teamsData, error: tErr } = await supabase
    .from("teams")
    .select("id, event_id, pool_id, name, level, sort_order, is_completed")
    .eq("event_id", eventId)
    .eq("level", normalized)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (tErr) {
    return { players: [], teams: [], members: [], eventAssignedPlayerIds: [], error: tErr.message };
  }

  const teams = (teamsData ?? []) as TeamRow[];

  const { data: membersData, error: mErr } = await supabase
    .from("team_members")
    .select("id, event_id, player_id, team_id")
    .eq("event_id", eventId);

  if (mErr) {
    return { players: [], teams: [], members: [], eventAssignedPlayerIds: [], error: mErr.message };
  }

  const allMemberRows = (membersData ?? []) as TeamMemberRow[];
  const eventAssignedPlayerIds = [
    ...new Set(allMemberRows.map((m) => m.player_id)),
  ];

  const teamIds = new Set(teams.map((t) => t.id));
  const members = allMemberRows.filter((m) => teamIds.has(m.team_id));

  players.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

  return { players, teams, members, eventAssignedPlayerIds, error: null };
}

export function nextDefaultTeamName(levelKey: string, existingCount: number): string {
  return `${levelKey} Hold ${existingCount + 1}`;
}
