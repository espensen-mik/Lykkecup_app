import { createServerSupabase } from "@/lib/auth-server";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { PLANNING_LOCKDOWN_MESSAGE } from "@/lib/kontrolcenter-lockdown-shared";

export async function fetchPlanningLockdown(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("kontrolcenter_event_settings")
    .select("planning_lockdown")
    .eq("event_id", LYKKECUP_EVENT_ID)
    .maybeSingle();

  if (error) {
    console.warn("[kontrolcenter-lockdown] fetch failed", error.message);
    return false;
  }
  return Boolean(data?.planning_lockdown);
}

/** Returnerer fejl-resultat hvis planlægning er låst; ellers null. */
export async function planningLockdownBlock(): Promise<{ ok: false; message: string } | null> {
  if (await fetchPlanningLockdown()) {
    return { ok: false, message: PLANNING_LOCKDOWN_MESSAGE };
  }
  return null;
}
