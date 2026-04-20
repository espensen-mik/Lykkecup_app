import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { HoldCoachRow, HoldPlayerRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

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

export type HolddannelseProgressStats = {
  totalPlayers: number;
  assignedPlayers: number;
  percentAssigned: number;
};

/**
 * Samlet fremdrift for holddannelse på tværs af alle niveauer.
 * Tæller unikke spillere med i eventet og hvor mange af dem der er på et hold.
 */
export async function fetchHolddannelseProgress(): Promise<{
  progress: HolddannelseProgressStats | null;
  error: string | null;
}> {
  const eventId = HOLD_EVENT_ID;

  const [playersRes, membersRes] = await Promise.all([
    supabase.from("players").select("id").eq("event_id", eventId),
    supabase.from("team_members").select("player_id").eq("event_id", eventId),
  ]);

  if (playersRes.error) {
    return { progress: null, error: playersRes.error.message };
  }
  if (membersRes.error) {
    return { progress: null, error: membersRes.error.message };
  }

  const players = (playersRes.data ?? []) as { id: string }[];
  const members = (membersRes.data ?? []) as { player_id: string }[];
  const playerIds = new Set(players.map((p) => p.id));
  let assignedPlayers = 0;

  for (const pid of new Set(members.map((m) => m.player_id))) {
    if (playerIds.has(pid)) assignedPlayers += 1;
  }

  const totalPlayers = playerIds.size;
  const percentAssigned =
    totalPlayers > 0 ? Math.round((assignedPlayers / totalPlayers) * 1000) / 10 : 0;

  return {
    progress: {
      totalPlayers,
      assignedPlayers,
      percentAssigned,
    },
    error: null,
  };
}

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
  coaches: HoldCoachRow[];
  teamCoaches: TeamCoachRow[];
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
    return {
      players: [],
      teams: [],
      members: [],
      eventAssignedPlayerIds: [],
      coaches: [],
      teamCoaches: [],
      error: pErr.message,
    };
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
    return {
      players: [],
      teams: [],
      members: [],
      eventAssignedPlayerIds: [],
      coaches: [],
      teamCoaches: [],
      error: tErr.message,
    };
  }

  const teams = (teamsData ?? []) as TeamRow[];

  const { data: membersData, error: mErr } = await supabase
    .from("team_members")
    .select("id, event_id, player_id, team_id")
    .eq("event_id", eventId);

  if (mErr) {
    return {
      players: [],
      teams: [],
      members: [],
      eventAssignedPlayerIds: [],
      coaches: [],
      teamCoaches: [],
      error: mErr.message,
    };
  }

  const allMemberRows = (membersData ?? []) as TeamMemberRow[];
  const eventAssignedPlayerIds = [
    ...new Set(allMemberRows.map((m) => m.player_id)),
  ];

  const teamIds = new Set(teams.map((t) => t.id));
  const members = allMemberRows.filter((m) => teamIds.has(m.team_id));

  const [{ data: coachesData, error: cErr }, { data: teamCoachesData, error: tcErr }] = await Promise.all([
    supabase.from("coaches").select("id, name, home_club, age").eq("event_id", eventId),
    supabase.from("team_coaches").select("id, event_id, team_id, coach_id").eq("event_id", eventId),
  ]);

  if (cErr) {
    return {
      players,
      teams,
      members,
      eventAssignedPlayerIds,
      coaches: [],
      teamCoaches: [],
      error: cErr.message,
    };
  }
  if (tcErr) {
    return {
      players,
      teams,
      members,
      eventAssignedPlayerIds,
      coaches: [],
      teamCoaches: [],
      error: tcErr.message,
    };
  }

  let coaches = (coachesData ?? []) as HoldCoachRow[];
  coaches.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

  const allTeamCoachRows = (teamCoachesData ?? []) as TeamCoachRow[];
  const teamCoaches = allTeamCoachRows.filter((r) => teamIds.has(r.team_id));

  players.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

  return { players, teams, members, eventAssignedPlayerIds, coaches, teamCoaches, error: null };
}

export function nextDefaultTeamName(levelKey: string, existingCount: number): string {
  return `${levelKey} Hold ${existingCount + 1}`;
}

/** Én holdblok til print (spillere og trænere er sorteret efter navn). */
export type TeamPrintEntry = {
  team: TeamRow;
  players: { name: string; club: string }[];
  coaches: { name: string }[];
};

export type TeamsPrintLevelGroup = {
  levelKey: string;
  teams: TeamPrintEntry[];
};

/**
 * Henter alle hold for arrangementet med spillere og trænere til print.
 * @param levelFilter – når sat, kun hold med præcis dette `teams.level` (samme som holddannelse-niveau).
 */
export async function fetchTeamsPrintData(levelFilter: string | null): Promise<{
  groups: TeamsPrintLevelGroup[];
  error: string | null;
}> {
  const eventId = HOLD_EVENT_ID;

  let q = supabase
    .from("teams")
    .select("id, event_id, pool_id, name, level, sort_order, is_completed")
    .eq("event_id", eventId);

  if (levelFilter != null && levelFilter.trim() !== "") {
    q = q.eq("level", normalizeLevelKey(levelFilter));
  }

  const { data: teamsData, error: tErr } = await q
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (tErr) {
    return { groups: [], error: tErr.message };
  }

  const teams = (teamsData ?? []) as TeamRow[];
  if (teams.length === 0) {
    return { groups: [], error: null };
  }

  const teamIds = teams.map((t) => t.id);

  const [
    { data: membersData, error: mErr },
    { data: tcData, error: tcErr },
    { data: playersData, error: pErr },
    { data: coachesData, error: cErr },
  ] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id, player_id")
      .eq("event_id", eventId)
      .in("team_id", teamIds),
    supabase
      .from("team_coaches")
      .select("team_id, coach_id")
      .eq("event_id", eventId)
      .in("team_id", teamIds),
    supabase.from("players").select("id, name, home_club").eq("event_id", eventId),
    supabase.from("coaches").select("id, name").eq("event_id", eventId),
  ]);

  if (mErr) return { groups: [], error: mErr.message };
  if (tcErr) return { groups: [], error: tcErr.message };
  if (pErr) return { groups: [], error: pErr.message };
  if (cErr) return { groups: [], error: cErr.message };

  const playerById = new Map<string, { name: string; home_club: string | null }>();
  for (const p of (playersData ?? []) as { id: string; name: string; home_club: string | null }[]) {
    playerById.set(p.id, p);
  }

  const coachById = new Map<string, string>();
  for (const c of (coachesData ?? []) as { id: string; name: string }[]) {
    coachById.set(c.id, c.name);
  }

  const membersByTeam = new Map<string, string[]>();
  for (const row of (membersData ?? []) as { team_id: string; player_id: string }[]) {
    const list = membersByTeam.get(row.team_id) ?? [];
    list.push(row.player_id);
    membersByTeam.set(row.team_id, list);
  }

  const coachesByTeam = new Map<string, string[]>();
  for (const row of (tcData ?? []) as { team_id: string; coach_id: string }[]) {
    const list = coachesByTeam.get(row.team_id) ?? [];
    list.push(row.coach_id);
    coachesByTeam.set(row.team_id, list);
  }

  const byLevel = new Map<string, TeamPrintEntry[]>();
  for (const team of teams) {
    const levelKey = normalizeLevelKey(team.level);

    const pids = membersByTeam.get(team.id) ?? [];
    const players: { name: string; club: string }[] = [];
    for (const pid of pids) {
      const pl = playerById.get(pid);
      players.push({
        name: pl?.name?.trim() || pid,
        club: pl?.home_club?.trim() || "—",
      });
    }
    players.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

    const cids = coachesByTeam.get(team.id) ?? [];
    const coaches: { name: string }[] = [];
    for (const cid of cids) {
      coaches.push({ name: coachById.get(cid)?.trim() || cid });
    }
    coaches.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

    const entry: TeamPrintEntry = { team, players, coaches };
    const list = byLevel.get(levelKey) ?? [];
    list.push(entry);
    byLevel.set(levelKey, list);
  }

  for (const list of byLevel.values()) {
    list.sort(
      (a, b) =>
        a.team.sort_order - b.team.sort_order ||
        a.team.name.localeCompare(b.team.name, "da", { sensitivity: "base" }),
    );
  }

  const levelKeys = sortLevelKeysForNav([...byLevel.keys()]);
  const groups: TeamsPrintLevelGroup[] = levelKeys.map((levelKey) => ({
    levelKey,
    teams: byLevel.get(levelKey) ?? [],
  }));

  return { groups, error: null };
}
