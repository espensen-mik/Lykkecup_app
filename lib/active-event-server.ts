import { cookies } from "next/headers";
import { cache } from "react";
import { createServerSupabase } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE, DEFAULT_EVENT_ID } from "@/lib/events";

/** Arrangementet KontrolCenter arbejder i for denne request. Cookien stoles kun på, hvis id'et findes i `events`. */
export const getActiveEventId = cache(async (): Promise<string> => {
  const requested = (await cookies()).get(ACTIVE_EVENT_COOKIE)?.value;
  if (!requested || requested === DEFAULT_EVENT_ID) return DEFAULT_EVENT_ID;

  const supabase = await createServerSupabase();
  const { data } = await supabase.from("events").select("id").eq("id", requested).maybeSingle();
  return (data?.id as string | undefined) ?? DEFAULT_EVENT_ID;
});
