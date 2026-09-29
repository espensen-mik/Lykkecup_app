import { cookies } from "next/headers";
import { cache } from "react";
import { createServerSupabase } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE, DEFAULT_EVENT_ID, type EventSummary } from "@/lib/events";

type EventRow = {
  id: string;
  name: string;
  starts_on: string | null;
  location: string | null;
  status: string | null;
};

function toSummary(row: EventRow): EventSummary {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    location: row.location,
    status: row.status === "archived" ? "archived" : "active",
  };
}

export const listEvents = cache(async (): Promise<EventSummary[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, starts_on, location, status")
    .order("starts_on", { ascending: false });
  if (error) throw new Error(`Kunne ikke hente arrangementer: ${error.message}`);
  return ((data ?? []) as EventRow[]).map(toSummary);
});

export const getRequestedEventId = cache(async (): Promise<string | null> => {
  return (await cookies()).get(ACTIVE_EVENT_COOKIE)?.value ?? null;
});

/** Arrangementet KontrolCenter arbejder i for denne request. Cookien stoles kun på, hvis id'et findes i `events`. */
export const getActiveEvent = cache(async (): Promise<EventSummary> => {
  const [events, requested] = await Promise.all([listEvents(), getRequestedEventId()]);
  const match =
    events.find((e) => e.id === requested) ?? events.find((e) => e.id === DEFAULT_EVENT_ID) ?? events[0];
  if (!match) throw new Error("Der findes ingen arrangementer i databasen.");
  return match;
});

export const getActiveEventId = cache(async (): Promise<string> => (await getActiveEvent()).id);
