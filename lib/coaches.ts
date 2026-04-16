import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { Coach } from "@/types/coach";

export async function fetchCoachesForEvent(): Promise<{
  coaches: Coach[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, event_id, ticket_id, name, home_club, email, phone, birthdate, age, tshirt_size")
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("name", { ascending: true });

  if (error) return { coaches: [], error: error.message };

  const rows = (data ?? []) as Coach[];
  return {
    coaches: rows.filter((c): c is Coach => Boolean(c.id)),
    error: null,
  };
}

export async function fetchCoachById(
  coachId: string,
): Promise<{ coach: Coach | null; error: string | null }> {
  const { data, error } = await supabase
    .from("coaches")
    .select("id, event_id, ticket_id, name, home_club, email, phone, birthdate, age, tshirt_size")
    .eq("id", coachId)
    .eq("event_id", LYKKECUP_EVENT_ID)
    .maybeSingle();

  if (error) {
    return { coach: null, error: error.message };
  }
  if (!data) {
    return { coach: null, error: null };
  }
  return { coach: data as Coach, error: null };
}
