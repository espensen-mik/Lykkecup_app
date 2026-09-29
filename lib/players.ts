import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardPlayer, Player, PlayerDetail } from "@/types/player";
import { kontrolCenterTeamDisplayNameFromRow } from "@/lib/team-detail";

export const LYKKECUP_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

export async function fetchPlayersForEvent(client: SupabaseClient): Promise<{
  players: Player[];
  error: string | null;
}> {
  const { data, error } = await client
    .from("players")
    .select("id, name, home_club, level, age, ticket_id")
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("name", { ascending: true });

  if (error) {
    return { players: [], error: error.message };
  }

  const rows = (data ?? []) as Player[];
  return {
    players: rows.filter((p): p is Player => Boolean(p.id)),
    error: null,
  };
}

export async function fetchPlayerById(
  client: SupabaseClient,
  playerId: string,
): Promise<{ player: PlayerDetail | null; error: string | null }> {
  const { data, error } = await client
    .from("players")
    .select(
      "id, name, home_club, birthdate, age, gender, level, preferences, ticket_id",
    )
    .eq("id", playerId)
    .eq("event_id", LYKKECUP_EVENT_ID)
    .maybeSingle();

  if (error) {
    return { player: null, error: error.message };
  }
  if (!data) {
    return { player: null, error: null };
  }

  return { player: data as PlayerDetail, error: null };
}

/** Tildelt hold i KontrolCenter: kaldenavn som primær tekst når sat, officielt navn til oversigt. */
export type PlayerAssignedTeamSummary = {
  /** Team id til dybdelink fra spiller-modal. */
  teamId: string;
  /** Niveau-nøgle til link til korrekt holddannelse-side. */
  levelKey: string;
  /** Primær visning i KontrolCenter (officielt/autogenereret holdnavn). */
  displayName: string;
  /** Autogenereret holdnavn fra holddannelse. */
  officialName: string;
};

/** Hold spilleren er på i dette arrangement — med officielt navn og valgfrit kaldenavn. */
export async function fetchAssignedTeamForPlayer(
  client: SupabaseClient,
  playerId: string,
): Promise<PlayerAssignedTeamSummary | null> {
  const { data: mem, error: memErr } = await client
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId)
    .eq("event_id", LYKKECUP_EVENT_ID)
    .limit(1)
    .maybeSingle();

  if (memErr || !mem?.team_id) return null;

  const { data: team, error: teamErr } = await client
    .from("teams")
    .select("id, name, nickname, level")
    .eq("id", mem.team_id)
    .eq("event_id", LYKKECUP_EVENT_ID)
    .maybeSingle();

  if (teamErr || !team) return null;
  const row = team as { id: string; name: string; nickname?: string | null; level: string | null };
  const officialName = row.name?.trim() ?? "";
  if (!officialName) return null;
  const displayName = kontrolCenterTeamDisplayNameFromRow({
    name: officialName,
    nickname: row.nickname,
  });
  const levelKey = row.level?.trim() || "Ukendt niveau";
  return { teamId: row.id, levelKey, displayName, officialName };
}

/** All players for the event — dashboard aggregations and charts */
export async function fetchPlayersForDashboard(client: SupabaseClient): Promise<{
  players: DashboardPlayer[];
  error: string | null;
}> {
  const withTimestamp = await client
    .from("players")
    .select("id, name, home_club, level, age, gender, created_at")
    .eq("event_id", LYKKECUP_EVENT_ID);

  if (!withTimestamp.error) {
    const rows = (withTimestamp.data ?? []) as DashboardPlayer[];
    return {
      players: rows.filter((p): p is DashboardPlayer => Boolean(p.id)),
      error: null,
    };
  }

  const fallback = await client
    .from("players")
    .select("id, name, home_club, level, age, gender")
    .eq("event_id", LYKKECUP_EVENT_ID);

  if (fallback.error) {
    return { players: [], error: fallback.error.message };
  }

  const rows = (fallback.data ?? []) as Omit<DashboardPlayer, "created_at">[];
  return {
    players: rows
      .filter((p) => Boolean(p.id))
      .map((p) => ({ ...p, created_at: null })),
    error: null,
  };
}
