import { getActiveEvent } from "@/lib/active-event-server";
import { createServerSupabase } from "@/lib/auth-server";
import { ARCHIVED_EVENT_MESSAGE, PLANNING_LOCKDOWN_MESSAGE } from "@/lib/kontrolcenter-lockdown-shared";

export async function fetchPlanningLockdown(): Promise<boolean> {
  const [supabase, event] = await Promise.all([createServerSupabase(), getActiveEvent()]);
  if (event.status === "archived") return true;
  const eventId = event.id;
  const { data, error } = await supabase
    .from("kontrolcenter_event_settings")
    .select("planning_lockdown")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.warn("[kontrolcenter-lockdown] fetch failed", error.message);
    return false;
  }
  return Boolean(data?.planning_lockdown);
}

/** Returnerer fejl-resultat hvis planlægning er låst; ellers null. */
export async function planningLockdownBlock(): Promise<{ ok: false; message: string } | null> {
  if ((await getActiveEvent()).status === "archived") {
    return { ok: false, message: ARCHIVED_EVENT_MESSAGE };
  }
  if (await fetchPlanningLockdown()) {
    return { ok: false, message: PLANNING_LOCKDOWN_MESSAGE };
  }
  return null;
}
