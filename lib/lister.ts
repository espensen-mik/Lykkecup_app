import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import { publicTeamDisplayName } from "@/lib/team-public-display-name";

export type ListerTeamRow = {
  id: string;
  levelKey: string;
  sort_order: number;
  officialName: string;
  nickname: string | null;
  displayName: string;
};

export type ListerPlayerRow = {
  id: string;
  name: string;
  home_club: string | null;
  level: string | null;
  age: number | null;
  gender: string | null;
  team_id: string | null;
  team_display: string | null;
  team_official: string | null;
  team_levelKey: string | null;
};

/**
 * Data til Lister-siden: alle hold og alle spillere med tilknyttet hold (hvis nogen).
 */
export async function fetchListerExportData(): Promise<{
  teams: ListerTeamRow[];
  players: ListerPlayerRow[];
  error: string | null;
}> {
  const eventId = LYKKECUP_EVENT_ID;

  const [
    { data: teamsData, error: tErr },
    { data: playersData, error: pErr },
    { data: membersData, error: mErr },
  ] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, nickname, level, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("players")
      .select("id, name, home_club, level, age, gender")
      .eq("event_id", eventId),
    supabase.from("team_members").select("team_id, player_id").eq("event_id", eventId),
  ]);

  if (tErr) return { teams: [], players: [], error: tErr.message };
  if (pErr) return { teams: [], players: [], error: pErr.message };
  if (mErr) return { teams: [], players: [], error: mErr.message };

  const rawTeams = (teamsData ?? []) as {
    id: string;
    name: string;
    nickname?: string | null;
    level: string | null;
    sort_order: number | null;
  }[];

  const teams: ListerTeamRow[] = rawTeams.map((t) => {
    const officialName = t.name?.trim() ?? "";
    const nickname = t.nickname?.trim() ? t.nickname.trim() : null;
    const displayName = publicTeamDisplayName({ name: officialName, nickname: t.nickname });
    return {
      id: t.id,
      levelKey: normalizeLevelKey(t.level),
      sort_order: typeof t.sort_order === "number" ? t.sort_order : 0,
      officialName,
      nickname,
      displayName,
    };
  });

  const levelOrder = sortLevelKeysForNav([...new Set(teams.map((t) => t.levelKey))]);
  const levelIndex = new Map(levelOrder.map((k, i) => [k, i]));
  teams.sort((a, b) => {
    const ia = levelIndex.get(a.levelKey) ?? 999;
    const ib = levelIndex.get(b.levelKey) ?? 999;
    if (ia !== ib) return ia - ib;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.officialName.localeCompare(b.officialName, "da", { sensitivity: "base" });
  });

  const teamById = new Map<string, ListerTeamRow>();
  for (const t of teams) teamById.set(t.id, t);

  /** Én hold-plads pr. spiller: første membership vinder (samme som øvrig app). */
  const playerTeamId = new Map<string, string>();
  for (const row of (membersData ?? []) as { team_id: string; player_id: string }[]) {
    if (!playerTeamId.has(row.player_id)) playerTeamId.set(row.player_id, row.team_id);
  }

  const rawPlayers = (playersData ?? []) as {
    id: string;
    name: string;
    home_club: string | null;
    level: string | null;
    age: number | null;
    gender: string | null;
  }[];

  const players: ListerPlayerRow[] = rawPlayers.map((p) => {
    const tid = playerTeamId.get(p.id) ?? null;
    const tm = tid ? teamById.get(tid) : undefined;
    return {
      id: p.id,
      name: p.name?.trim() || "—",
      home_club: p.home_club?.trim() ? p.home_club.trim() : null,
      level: p.level?.trim() ? p.level.trim() : null,
      age: p.age,
      gender: p.gender?.trim() ? p.gender.trim() : null,
      team_id: tid,
      team_display: tm?.displayName ?? null,
      team_official: tm?.officialName ?? null,
      team_levelKey: tm?.levelKey ?? null,
    };
  });

  players.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));

  return { teams, players, error: null };
}
