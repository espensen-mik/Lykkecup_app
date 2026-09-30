import { getActiveEvent } from "@/lib/active-event-server";
import { createServerSupabase, getCurrentAuthAppUser } from "@/lib/auth-server";
import type { AuthAppUser } from "@/lib/auth-app-user";
import type { EventSummary } from "@/lib/events";
import { ARCHIVED_EVENT_MESSAGE } from "@/lib/kontrolcenter-lockdown-shared";

export type EditableContext =
  | { error: string }
  | {
      error?: undefined;
      supabase: Awaited<ReturnType<typeof createServerSupabase>>;
      eventId: string;
      event: EventSummary;
      user: AuthAppUser;
    };

/** Indlogget bruger og et aktivt (ikke arkiveret) år — krav for alle ændringer under Frivillige. */
export async function editableContext(): Promise<EditableContext> {
  const [user, event] = await Promise.all([getCurrentAuthAppUser(), getActiveEvent()]);
  if (!user) return { error: "Du skal være logget ind." };
  if (event.status === "archived") return { error: ARCHIVED_EVENT_MESSAGE };
  return { supabase: await createServerSupabase(), eventId: event.id, event, user };
}
