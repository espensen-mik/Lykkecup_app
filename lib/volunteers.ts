import type { SupabaseClient } from "@supabase/supabase-js";
import { LYKKECUP_2027_EVENT_ID, eventYearLabel, type EventSummary } from "@/lib/events";

/** Arrangementet, som lykkecup.dk/frivillig tilmelder til. */
export const VOLUNTEER_SIGNUP_EVENT_ID = LYKKECUP_2027_EVENT_ID;

/** Frivillige-modulet blev taget i brug fra LykkeCup 2027. */
export function volunteersEnabledFor(event: Pick<EventSummary, "name" | "startsOn">): boolean {
  return Number(eventYearLabel(event)) >= 2027;
}

export const AVAILABILITY_FULL_DAY = "Jeg kan hjælpe til hele dagen";
export const AVAILABILITY_TIMEBOX = "Jeg kan kun hjælpe i et bestemt tidsrum";
export const AVAILABILITY_OPTIONS = [AVAILABILITY_FULL_DAY, AVAILABILITY_TIMEBOX] as const;

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"] as const;

export type Volunteer = {
  id: string;
  event_id: string;
  team_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birthdate: string | null;
  previous_volunteer: boolean | null;
  availability: string | null;
  availability_note: string | null;
  tshirt_size: string | null;
  task_wish: string | null;
  buddy_wish: string | null;
  dietary_needs: string | null;
  photo_consent: boolean | null;
  other_info: string | null;
  admin_note: string | null;
  source: "web" | "manual";
  created_at: string;
};

export type VolunteerTeam = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  leader_volunteer_id: string | null;
  sort_order: number;
};

export type VolunteerTask = {
  id: string;
  event_id: string;
  team_id: string | null;
  name: string;
  period_label: string | null;
  /** "HH:MM:SS" */
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  description: string | null;
  sort_order: number;
};

export type VolunteerTaskAssignment = { task_id: string; volunteer_id: string };

/** "08:00:00" → "8.00" */
export function formatTaskTime(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}.${m ?? "00"}`;
}

/** Fx "Formiddag · 8.00–12.00" */
export function taskTimeLabel(task: Pick<VolunteerTask, "period_label" | "starts_at" | "ends_at">): string {
  const range = `${formatTaskTime(task.starts_at)}–${formatTaskTime(task.ends_at)}`;
  return task.period_label ? `${task.period_label} · ${range}` : range;
}

export function tasksOverlap(a: Pick<VolunteerTask, "starts_at" | "ends_at">, b: Pick<VolunteerTask, "starts_at" | "ends_at">): boolean {
  return a.starts_at < b.ends_at && b.starts_at < a.ends_at;
}

/** Opgaver, som overlapper med `task` blandt dem, den frivillige allerede har. */
export function overlappingTasks(task: VolunteerTask, otherTasks: VolunteerTask[]): VolunteerTask[] {
  return otherTasks.filter((t) => t.id !== task.id && tasksOverlap(t, task));
}

/** Felter, som både tilmelding og KontrolCenter-formularen udfylder. */
export type VolunteerInput = Pick<
  Volunteer,
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "birthdate"
  | "previous_volunteer"
  | "availability"
  | "availability_note"
  | "tshirt_size"
  | "task_wish"
  | "buddy_wish"
  | "dietary_needs"
  | "photo_consent"
  | "other_info"
>;

const VOLUNTEER_COLUMNS =
  "id, event_id, team_id, first_name, last_name, email, phone, birthdate, previous_volunteer, availability, availability_note, tshirt_size, task_wish, buddy_wish, dietary_needs, photo_consent, other_info, admin_note, source, created_at";

export function volunteerFullName(v: Pick<Volunteer, "first_name" | "last_name">): string {
  return `${v.first_name} ${v.last_name}`.trim();
}

export function ageFromBirthdate(birthdate: string | null, on: Date = new Date()): number | null {
  if (!birthdate) return null;
  const [y, m, d] = birthdate.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}

function text(value: FormDataEntryValue | null, max: number): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v.slice(0, max) : null;
}

function oneOf<T extends string>(value: string | null, options: readonly T[]): T | null {
  return value && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function yesNo(value: FormDataEntryValue | null): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null;
}

export type ParsedVolunteerInput = { ok: true; input: VolunteerInput } | { ok: false; message: string };

/** Fælles validering af formularfelter fra både den offentlige side og KontrolCenter. */
export function parseVolunteerForm(form: FormData): ParsedVolunteerInput {
  const first_name = text(form.get("first_name"), 100);
  const last_name = text(form.get("last_name"), 100);
  const email = text(form.get("email"), 320)?.toLowerCase() ?? null;
  const phone = text(form.get("phone"), 40);
  if (!first_name || !last_name) return { ok: false, message: "Udfyld fornavn og efternavn." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Udfyld en gyldig e-mail." };
  if (!phone || phone.replace(/\D/g, "").length < 8) return { ok: false, message: "Udfyld et gyldigt mobilnummer." };

  let birthdate = text(form.get("birthdate"), 10);
  if (!birthdate) {
    const d = text(form.get("birth_day"), 2);
    const m = text(form.get("birth_month"), 2);
    const y = text(form.get("birth_year"), 4);
    if (d || m || y) {
      if (!(d && m && y)) return { ok: false, message: "Udfyld hele fødselsdatoen eller lad den være tom." };
      birthdate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  if (birthdate) {
    const parsed = new Date(`${birthdate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthdate) {
      return { ok: false, message: "Fødselsdatoen er ikke gyldig." };
    }
  }

  const availability = oneOf(text(form.get("availability"), 200), AVAILABILITY_OPTIONS);

  return {
    ok: true,
    input: {
      first_name,
      last_name,
      email,
      phone,
      birthdate,
      previous_volunteer: yesNo(form.get("previous_volunteer")),
      availability,
      availability_note: availability === AVAILABILITY_TIMEBOX ? text(form.get("availability_note"), 1000) : null,
      tshirt_size: oneOf(text(form.get("tshirt_size"), 20), TSHIRT_SIZES),
      task_wish: text(form.get("task_wish"), 1000),
      buddy_wish: text(form.get("buddy_wish"), 1000),
      dietary_needs: text(form.get("dietary_needs"), 1000),
      photo_consent: yesNo(form.get("photo_consent")),
      other_info: text(form.get("other_info"), 4000),
    },
  };
}

export async function fetchVolunteersBundle(
  client: SupabaseClient,
  eventId: string,
): Promise<{
  volunteers: Volunteer[];
  teams: VolunteerTeam[];
  tasks: VolunteerTask[];
  assignments: VolunteerTaskAssignment[];
  error: string | null;
}> {
  const [volRes, teamRes, taskRes, assignRes] = await Promise.all([
    client
      .from("volunteers")
      .select(VOLUNTEER_COLUMNS)
      .eq("event_id", eventId)
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true }),
    client
      .from("volunteer_teams")
      .select("id, event_id, name, description, leader_volunteer_id, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("volunteer_tasks")
      .select("id, event_id, team_id, name, period_label, starts_at, ends_at, capacity, description, sort_order")
      .eq("event_id", eventId)
      .order("starts_at", { ascending: true })
      .order("name", { ascending: true }),
    client.from("volunteer_task_assignments").select("task_id, volunteer_id").eq("event_id", eventId),
  ]);
  const error =
    volRes.error?.message ?? teamRes.error?.message ?? taskRes.error?.message ?? assignRes.error?.message ?? null;
  return {
    volunteers: (volRes.data ?? []) as Volunteer[],
    teams: (teamRes.data ?? []) as VolunteerTeam[],
    tasks: (taskRes.data ?? []) as VolunteerTask[],
    assignments: (assignRes.data ?? []) as VolunteerTaskAssignment[],
    error,
  };
}
