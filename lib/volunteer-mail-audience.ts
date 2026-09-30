import type { MergeValues } from "@/lib/volunteer-mail-format";
import {
  taskTimeLabel,
  volunteerFullName,
  type Volunteer,
  type VolunteerTask,
  type VolunteerTaskAssignment,
  type VolunteerTeam,
} from "@/lib/volunteers";

export type MailAudienceType = "all" | "teams" | "volunteers" | "tasks" | "leaders";
export type MailAudience = { type: MailAudienceType; ids: string[] };

export const MAIL_AUDIENCE_TYPES: { value: MailAudienceType; label: string }[] = [
  { value: "teams", label: "Teams" },
  { value: "volunteers", label: "Personer" },
  { value: "tasks", label: "Opgaver" },
  { value: "leaders", label: "Teamledere" },
  { value: "all", label: "Alle frivillige" },
];

export const MAX_MAIL_RECIPIENTS = 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isMailableAddress(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

type Data = { volunteers: Volunteer[]; teams: VolunteerTeam[]; tasks: VolunteerTask[]; assignments: VolunteerTaskAssignment[] };

export function parseMailAudience(value: unknown): MailAudience | null {
  if (!value || typeof value !== "object") return null;
  const { type, ids } = value as { type?: unknown; ids?: unknown };
  if (!MAIL_AUDIENCE_TYPES.some((t) => t.value === type)) return null;
  const cleanIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) : [];
  return { type: type as MailAudienceType, ids: [...new Set(cleanIds)].slice(0, 2000) };
}

/** Modtagere for et valg. Samme person optræder kun én gang. */
export function resolveMailAudience(audience: MailAudience, data: Data): Volunteer[] {
  const ids = new Set(audience.ids);
  let list: Volunteer[];
  switch (audience.type) {
    case "all":
      list = data.volunteers;
      break;
    case "teams":
      list = data.volunteers.filter((v) => v.team_id && ids.has(v.team_id));
      break;
    case "volunteers":
      list = data.volunteers.filter((v) => ids.has(v.id));
      break;
    case "tasks": {
      const onTasks = new Set(data.assignments.filter((a) => ids.has(a.task_id)).map((a) => a.volunteer_id));
      list = data.volunteers.filter((v) => onTasks.has(v.id));
      break;
    }
    case "leaders": {
      const leaders = new Set(data.teams.map((t) => t.leader_volunteer_id).filter(Boolean));
      list = data.volunteers.filter((v) => leaders.has(v.id));
      break;
    }
  }
  const seen = new Set<string>();
  return list
    .filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    })
    .sort((a, b) => volunteerFullName(a).localeCompare(volunteerFullName(b), "da"));
}

export function mailAudienceLabel(audience: MailAudience, data: Data): string {
  const names = (list: { id: string; name: string }[]) =>
    list
      .filter((x) => audience.ids.includes(x.id))
      .map((x) => x.name)
      .join(", ");
  switch (audience.type) {
    case "all":
      return "Alle frivillige";
    case "leaders":
      return "Alle teamledere";
    case "teams":
      return `Team: ${names(data.teams)}`;
    case "tasks":
      return `Opgave: ${names(data.tasks.map((t) => ({ id: t.id, name: t.period_label ? `${t.name} (${t.period_label})` : t.name })))}`;
    case "volunteers": {
      const picked = data.volunteers.filter((v) => audience.ids.includes(v.id));
      return picked.length <= 3 ? `Personer: ${picked.map(volunteerFullName).join(", ")}` : `${picked.length} udvalgte personer`;
    }
  }
}

export function mergeValuesFor(volunteer: Volunteer, data: Data): MergeValues {
  const team = volunteer.team_id ? data.teams.find((t) => t.id === volunteer.team_id) : undefined;
  const taskIds = new Set(data.assignments.filter((a) => a.volunteer_id === volunteer.id).map((a) => a.task_id));
  const tasks = data.tasks
    .filter((t) => taskIds.has(t.id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((t) => `${t.name} (${taskTimeLabel(t)})`);
  return {
    fornavn: volunteer.first_name,
    navn: volunteerFullName(volunteer),
    team: team?.name ?? "dit team",
    opgaver: tasks.length ? tasks.join(", ") : "ingen opgaver endnu",
  };
}
