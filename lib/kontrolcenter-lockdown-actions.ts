"use server";

import { revalidatePath } from "next/cache";
import { getActiveEventId } from "@/lib/active-event-server";
import { getCurrentAuthAppUser, createServerSupabase } from "@/lib/auth-server";

export type SetPlanningLockdownResult = {
  ok: boolean;
  message: string;
  planningLockdown?: boolean;
};

export async function setPlanningLockdownAction(enabled: boolean): Promise<SetPlanningLockdownResult> {
  const appUser = await getCurrentAuthAppUser();
  if (!appUser) {
    return { ok: false, message: "Du skal være logget ind." };
  }
  if (appUser.role !== "admin") {
    return { ok: false, message: "Kun administratorer kan ændre Lockdown." };
  }

  const [supabase, eventId] = await Promise.all([createServerSupabase(), getActiveEventId()]);
  const { error } = await supabase
    .from("kontrolcenter_event_settings")
    .upsert(
      {
        event_id: eventId,
        planning_lockdown: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id" },
    );

  if (error) {
    return {
      ok: false,
      message: error.message.includes("kontrolcenter_event_settings")
        ? "Database mangler Lockdown-indstilling — kør migration «kontrolcenter_planning_lockdown» i Supabase."
        : error.message,
    };
  }

  revalidatePath("/holddannelse", "layout");
  revalidatePath("/turnering", "layout");

  return {
    ok: true,
    message: enabled
      ? "Lockdown er slået til — Holddannelse og Turnering er låst."
      : "Lockdown er slået fra — planlægning kan redigeres igen.",
    planningLockdown: enabled,
  };
}
