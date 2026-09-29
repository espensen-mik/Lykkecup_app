import type { SupabaseClient } from "@supabase/supabase-js";
import type { Coach } from "@/types/coach";

export async function fetchCoachesForEvent(client: SupabaseClient, eventId: string): Promise<{
  coaches: Coach[];
  error: string | null;
}> {
  const { data, error } = await client
    .from("coaches")
    .select("id, event_id, ticket_id, name, home_club, email, phone, birthdate, age, tshirt_size")
    .eq("event_id", eventId)
    .order("name", { ascending: true });

  if (error) return { coaches: [], error: error.message };

  const rows = (data ?? []) as Coach[];
  return {
    coaches: rows.filter((c): c is Coach => Boolean(c.id)),
    error: null,
  };
}

export async function fetchCoachById(
  client: SupabaseClient,
  eventId: string,
  coachId: string,
): Promise<{ coach: Coach | null; error: string | null }> {
  const { data, error } = await client
    .from("coaches")
    .select("id, event_id, ticket_id, name, home_club, email, phone, birthdate, age, tshirt_size")
    .eq("id", coachId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    return { coach: null, error: error.message };
  }
  if (!data) {
    return { coach: null, error: null };
  }
  return { coach: data as Coach, error: null };
}
