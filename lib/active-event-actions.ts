"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listEvents } from "@/lib/active-event-server";
import { getCurrentAuthAppUser } from "@/lib/auth-server";
import { ACTIVE_EVENT_COOKIE, EVENT_PICKER_PATH, safeInternalPath } from "@/lib/events";

export async function selectActiveEventAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? ""));

  const user = await getCurrentAuthAppUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(EVENT_PICKER_PATH)}`);

  const events = await listEvents();
  if (!events.some((e) => e.id === eventId)) redirect(EVENT_PICKER_PATH);

  (await cookies()).set(ACTIVE_EVENT_COOKIE, eventId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(next);
}
