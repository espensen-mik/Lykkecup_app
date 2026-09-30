"use server";

import { revalidatePath } from "next/cache";
import { getActiveEvent } from "@/lib/active-event-server";
import { createServerSupabase, getCurrentAuthAppUser } from "@/lib/auth-server";
import { ARCHIVED_EVENT_MESSAGE } from "@/lib/kontrolcenter-lockdown-shared";
import { supabase as anonSupabase } from "@/lib/supabase";
import { parseVolunteerForm, VOLUNTEER_SIGNUP_EVENT_ID } from "@/lib/volunteers";

export type VolunteerActionResult = { ok: true; message?: string } | { ok: false; message: string };

const PATH = "/frivillige";

type EditableContext =
  | { error: string }
  | { error?: undefined; supabase: Awaited<ReturnType<typeof createServerSupabase>>; eventId: string };

async function editableContext(): Promise<EditableContext> {
  const [user, event] = await Promise.all([getCurrentAuthAppUser(), getActiveEvent()]);
  if (!user) return { error: "Du skal være logget ind." };
  if (event.status === "archived") return { error: ARCHIVED_EVENT_MESSAGE };
  return { supabase: await createServerSupabase(), eventId: event.id };
}

function uuidOrNull(value: FormDataEntryValue | null): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

export async function saveVolunteerAction(form: FormData): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };

  const parsed = parseVolunteerForm(form);
  if (!parsed.ok) return parsed;

  const id = uuidOrNull(form.get("id"));
  const adminNote = typeof form.get("admin_note") === "string" ? String(form.get("admin_note")).trim() : "";
  const payload = {
    ...parsed.input,
    team_id: uuidOrNull(form.get("team_id")),
    admin_note: adminNote ? adminNote.slice(0, 4000) : null,
  };

  const { data, error } = id
    ? await ctx.supabase.from("volunteers").update(payload).eq("id", id).eq("event_id", ctx.eventId).select("id").single()
    : await ctx.supabase
        .from("volunteers")
        .insert({ ...payload, event_id: ctx.eventId, source: "manual" })
        .select("id")
        .single();
  if (error) return { ok: false, message: error.message };

  if (form.has("leader_field")) {
    const volunteerId = data.id as string;
    const makeLeader = form.get("is_team_leader") === "on" && payload.team_id;
    const leaderResult = makeLeader
      ? await ctx.supabase
          .from("volunteer_teams")
          .update({ leader_volunteer_id: volunteerId })
          .eq("id", payload.team_id)
          .eq("event_id", ctx.eventId)
      : await ctx.supabase
          .from("volunteer_teams")
          .update({ leader_volunteer_id: null })
          .eq("leader_volunteer_id", volunteerId)
          .eq("event_id", ctx.eventId);
    if (leaderResult.error) return { ok: false, message: leaderResult.error.message };
  }

  revalidatePath(PATH);
  return { ok: true, message: id ? "Frivillig gemt." : "Frivillig oprettet." };
}

export async function deleteVolunteerAction(id: string): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.from("volunteers").delete().eq("id", id).eq("event_id", ctx.eventId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function setVolunteerTeamAction(volunteerId: string, teamId: string | null): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase
    .from("volunteers")
    .update({ team_id: teamId })
    .eq("id", volunteerId)
    .eq("event_id", ctx.eventId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveVolunteerTeamAction(form: FormData): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };

  const id = uuidOrNull(form.get("id"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const description = String(form.get("description") ?? "").trim().slice(0, 2000) || null;
  if (!name) return { ok: false, message: "Teamet skal have et navn." };

  const payload = { name, description, leader_volunteer_id: uuidOrNull(form.get("leader_volunteer_id")) };
  const { error } = id
    ? await ctx.supabase.from("volunteer_teams").update(payload).eq("id", id).eq("event_id", ctx.eventId)
    : await ctx.supabase.from("volunteer_teams").insert({ ...payload, leader_volunteer_id: null, event_id: ctx.eventId });
  if (error) {
    const duplicate = error.code === "23505";
    return { ok: false, message: duplicate ? "Der findes allerede et team med det navn." : error.message };
  }

  revalidatePath(PATH);
  return { ok: true, message: id ? "Team gemt." : "Team oprettet." };
}

export async function deleteVolunteerTeamAction(id: string): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.from("volunteer_teams").delete().eq("id", id).eq("event_id", ctx.eventId);
  if (error) {
    const hasTasks = error.code === "23503";
    return { ok: false, message: hasTasks ? "Teamet har opgaver. Slet opgaverne eller flyt dem til et andet team først." : error.message };
  }
  revalidatePath(PATH);
  return { ok: true };
}

function timeOrNull(value: FormDataEntryValue | null): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;
}

export async function saveVolunteerTaskAction(form: FormData): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };

  const id = uuidOrNull(form.get("id"));
  const teamId = uuidOrNull(form.get("team_id"));
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const periodLabel = String(form.get("period_label") ?? "").trim().slice(0, 60) || null;
  const startsAt = timeOrNull(form.get("starts_at"));
  const endsAt = timeOrNull(form.get("ends_at"));
  const capacityRaw = String(form.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;
  const description = String(form.get("description") ?? "").trim().slice(0, 2000) || null;

  if (!teamId) return { ok: false, message: "Vælg hvilket team opgaven hører til." };
  if (!name) return { ok: false, message: "Opgaven skal have et navn." };
  if (!startsAt || !endsAt) return { ok: false, message: "Udfyld start- og sluttidspunkt." };
  if (endsAt <= startsAt) return { ok: false, message: "Sluttidspunktet skal være efter starttidspunktet." };
  if (capacity !== null && !(capacity >= 1 && capacity <= 500)) {
    return { ok: false, message: "Antal pladser skal være mellem 1 og 500." };
  }

  const payload = { team_id: teamId, name, period_label: periodLabel, starts_at: startsAt, ends_at: endsAt, capacity, description };
  const { error } = id
    ? await ctx.supabase.from("volunteer_tasks").update(payload).eq("id", id).eq("event_id", ctx.eventId)
    : await ctx.supabase.from("volunteer_tasks").insert({ ...payload, event_id: ctx.eventId });
  if (error) return { ok: false, message: error.message };

  revalidatePath(PATH);
  return { ok: true, message: id ? "Opgave gemt." : "Opgave oprettet." };
}

export async function deleteVolunteerTaskAction(id: string): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase.from("volunteer_tasks").delete().eq("id", id).eq("event_id", ctx.eventId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function assignVolunteerTaskAction(taskId: string, volunteerId: string): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase
    .from("volunteer_task_assignments")
    .upsert({ task_id: taskId, volunteer_id: volunteerId, event_id: ctx.eventId }, { onConflict: "task_id,volunteer_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function unassignVolunteerTaskAction(taskId: string, volunteerId: string): Promise<VolunteerActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const { error } = await ctx.supabase
    .from("volunteer_task_assignments")
    .delete()
    .eq("task_id", taskId)
    .eq("volunteer_id", volunteerId)
    .eq("event_id", ctx.eventId);
  if (error) return { ok: false, message: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function submitVolunteerSignupAction(form: FormData): Promise<VolunteerActionResult> {
  if (String(form.get("website") ?? "").trim() !== "") return { ok: true };

  if (form.get("gdpr_consent") !== "on") {
    return { ok: false, message: "Du skal acceptere, at vi gemmer dine oplysninger." };
  }
  const parsed = parseVolunteerForm(form);
  if (!parsed.ok) return parsed;
  if (parsed.input.previous_volunteer === null || !parsed.input.availability || parsed.input.photo_consent === null) {
    return { ok: false, message: "Udfyld alle felter markeret med *." };
  }

  const i = parsed.input;
  const { error } = await anonSupabase.rpc("submit_volunteer_signup", {
    p_event_id: VOLUNTEER_SIGNUP_EVENT_ID,
    p_first_name: i.first_name,
    p_last_name: i.last_name,
    p_email: i.email,
    p_phone: i.phone,
    p_birthdate: i.birthdate,
    p_previous_volunteer: i.previous_volunteer,
    p_availability: i.availability,
    p_availability_note: i.availability_note,
    p_tshirt_size: i.tshirt_size,
    p_task_wish: i.task_wish,
    p_buddy_wish: i.buddy_wish,
    p_dietary_needs: i.dietary_needs,
    p_photo_consent: i.photo_consent,
    p_other_info: i.other_info,
    p_gdpr_consent: true,
  });
  if (error) {
    console.warn("[frivillig] tilmelding fejlede", error.message);
    return {
      ok: false,
      message: error.message.includes("For mange")
        ? error.message
        : "Tilmeldingen kunne ikke gemmes. Prøv igen om lidt, eller kontakt os.",
    };
  }
  return { ok: true };
}
