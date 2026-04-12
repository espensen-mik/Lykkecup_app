import type { DashboardPlayer, Player, PlayerDetail } from "@/types/player";
import { supabase } from "@/lib/supabase";

export const LYKKECUP_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

export async function fetchPlayersForEvent(): Promise<{
  players: Player[];
  error: string | null;
}> {
  const { data, error } = await supabase
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
  playerId: string,
): Promise<{ player: PlayerDetail | null; error: string | null }> {
  const { data, error } = await supabase
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

/** All players for the event — dashboard aggregations and charts */
export async function fetchPlayersForDashboard(): Promise<{
  players: DashboardPlayer[];
  error: string | null;
}> {
  const withTimestamp = await supabase
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

  const fallback = await supabase
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
