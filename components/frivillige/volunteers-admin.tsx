"use client";

import { ChevronRight, Crown, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { volunteerFieldClass } from "@/components/frivillige/volunteer-fields";
import { VolunteerModal } from "@/components/frivillige/volunteer-modal";
import { VolunteerMailPanel } from "@/components/frivillige/volunteer-mail-panel";
import { VolunteerTasksPanel } from "@/components/frivillige/volunteer-tasks-panel";
import { VolunteerTeamsPanel } from "@/components/frivillige/volunteer-teams-panel";
import { PickSelect } from "@/components/ui/pick-select";
import type { MailAudience } from "@/lib/volunteer-mail-audience";
import type { VolunteerEmailRecord } from "@/lib/volunteer-mail-history";
import {
  AVAILABILITY_FULL_DAY,
  AVAILABILITY_TIMEBOX,
  TSHIRT_SIZES,
  ageFromBirthdate,
  formatTaskTime,
  taskTimeLabel,
  volunteerFullName,
  type Volunteer,
  type VolunteerTask,
  type VolunteerTaskAssignment,
  type VolunteerTeam,
} from "@/lib/volunteers";

type Props = {
  volunteers: Volunteer[];
  teams: VolunteerTeam[];
  tasks: VolunteerTask[];
  assignments: VolunteerTaskAssignment[];
  mailHistory: VolunteerEmailRecord[];
  mailHistoryError: string | null;
  fetchError: string | null;
  readOnly: boolean;
};

const NO_TEAM = "__none__";
const LEADERS = "__leaders__";
const NO_TASK = "__no_task__";

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </th>
  );
}

export function VolunteersAdmin({ volunteers, teams, tasks, assignments, mailHistory, mailHistoryError, fetchError, readOnly }: Props) {
  const [tab, setTab] = useState<"list" | "teams" | "tasks" | "mails">("list");
  const [mailPreset, setMailPreset] = useState<MailAudience | null>(null);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [modal, setModal] = useState<{ id: string | null } | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const leaderTeamById = useMemo(() => {
    const map = new Map<string, VolunteerTeam>();
    for (const t of teams) if (t.leader_volunteer_id) map.set(t.leader_volunteer_id, t);
    return map;
  }, [teams]);
  const tasksByVolunteer = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const map = new Map<string, VolunteerTask[]>();
    for (const a of assignments) {
      const task = taskById.get(a.task_id);
      if (task) map.set(a.volunteer_id, [...(map.get(a.volunteer_id) ?? []), task]);
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [tasks, assignments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return volunteers.filter((v) => {
      if (q) {
        const hay = `${volunteerFullName(v)} ${v.email} ${v.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (teamFilter === NO_TEAM) {
        if (v.team_id) return false;
      } else if (teamFilter === LEADERS) {
        if (!leaderTeamById.has(v.id)) return false;
      } else if (teamFilter && v.team_id !== teamFilter) return false;
      const myTasks = tasksByVolunteer.get(v.id) ?? [];
      if (taskFilter === NO_TASK ? myTasks.length > 0 : taskFilter && !myTasks.some((t) => t.id === taskFilter)) return false;
      if (sizeFilter && v.tshirt_size !== sizeFilter) return false;
      if (availabilityFilter && v.availability !== availabilityFilter) return false;
      return true;
    });
  }, [volunteers, search, teamFilter, sizeFilter, availabilityFilter, taskFilter, leaderTeamById, tasksByVolunteer]);

  const sizeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of volunteers) if (v.tshirt_size) counts.set(v.tshirt_size, (counts.get(v.tshirt_size) ?? 0) + 1);
    return TSHIRT_SIZES.filter((s) => counts.has(s)).map((s) => [s, counts.get(s)!] as const);
  }, [volunteers]);

  const unassigned = volunteers.filter((v) => !v.team_id).length;
  const selected = modal?.id ? volunteers.find((v) => v.id === modal.id) ?? null : null;


  function openMail(audience: MailAudience) {
    setMailPreset(audience);
    setModal(null);
    setTab("mails");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Kunne ikke indlæse frivillige: {fetchError}
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-[#14b8a6] text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-lc-border p-1 dark:border-gray-700" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "list"} onClick={() => setTab("list")} className={tabClass(tab === "list")}>
            Frivillige ({volunteers.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "teams"} onClick={() => setTab("teams")} className={tabClass(tab === "teams")}>
            Teams ({teams.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "tasks"} onClick={() => setTab("tasks")} className={tabClass(tab === "tasks")}>
            Opgaver ({tasks.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "mails"} onClick={() => setTab("mails")} className={tabClass(tab === "mails")}>
            Mails
          </button>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={() => setModal({ id: null })}
            className="inline-flex items-center gap-2 rounded-md bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Opret frivillig
          </button>
        )}
      </div>

      {tab === "mails" ? (
        <VolunteerMailPanel
          key={mailPreset ? `${mailPreset.type}:${mailPreset.ids.join(",")}` : "blank"}
          volunteers={volunteers}
          teams={teams}
          tasks={tasks}
          assignments={assignments}
          history={mailHistory}
          historyError={mailHistoryError}
          readOnly={readOnly}
          preset={mailPreset}
        />
      ) : tab === "tasks" ? (
        <VolunteerTasksPanel
          tasks={tasks}
          assignments={assignments}
          volunteers={volunteers}
          teams={teams}
          readOnly={readOnly}
          onOpenVolunteer={(id) => setModal({ id })}
          onMail={openMail}
        />
      ) : tab === "teams" ? (
        <VolunteerTeamsPanel
          teams={teams}
          volunteers={volunteers}
          tasks={tasks}
          readOnly={readOnly}
          onOpenVolunteer={(id) => setModal({ id })}
          onMail={openMail}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Søg
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Navn, e-mail eller telefon …"
                className={volunteerFieldClass}
              />
            </label>
            <label className="flex min-w-[10rem] flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Team
              <PickSelect
                value={teamFilter}
                onChange={setTeamFilter}
                placeholder="Alle teams"
                options={[
                  { value: "", label: "Alle teams" },
                  { value: NO_TEAM, label: "Uden team" },
                  { value: LEADERS, label: "Kun teamledere", icon: <Crown className="h-3.5 w-3.5 text-amber-500" /> },
                  ...teams.map((t) => ({ value: t.id, label: t.name, group: "Teams" })),
                ]}
              />
            </label>
            <label className="flex min-w-[10rem] flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Opgave
              <PickSelect
                value={taskFilter}
                onChange={setTaskFilter}
                placeholder="Alle opgaver"
                options={[
                  { value: "", label: "Alle opgaver" },
                  { value: NO_TASK, label: "Uden opgave" },
                  ...tasks.map((t) => ({
                    value: t.id,
                    label: t.name,
                    hint: taskTimeLabel(t),
                    group: (t.team_id && teamById.get(t.team_id)?.name) || "Uden team",
                  })),
                ]}
              />
            </label>
            <label className="flex min-w-[8rem] flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              T-shirt
              <PickSelect
                value={sizeFilter}
                onChange={setSizeFilter}
                placeholder="Alle"
                options={[{ value: "", label: "Alle" }, ...TSHIRT_SIZES.map((sz) => ({ value: sz, label: sz }))]}
              />
            </label>
            <label className="flex min-w-[10rem] flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Tidsrum
              <PickSelect
                value={availabilityFilter}
                onChange={setAvailabilityFilter}
                placeholder="Alle"
                options={[
                  { value: "", label: "Alle" },
                  { value: AVAILABILITY_FULL_DAY, label: "Hele dagen" },
                  { value: AVAILABILITY_TIMEBOX, label: "Bestemt tidsrum" },
                ]}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
            <p>
              <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{volunteers.length}</span> frivillige ·{" "}
              <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{unassigned}</span> uden team · viser{" "}
              <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{filtered.length}</span>
            </p>
            {sizeCounts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sizeCounts.map(([size, count]) => (
                  <span key={size} className="rounded-full border border-lc-border bg-white px-2 py-1 text-[0.72rem] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                    {size} <span className="tabular-nums">{count}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="-mx-1 overflow-x-auto sm:mx-0">
            <div className="inline-block min-w-full rounded-lg border border-lc-border dark:border-gray-700">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-lc-border bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/50">
                    <Th>Navn</Th>
                    <Th>Alder</Th>
                    <Th>Tidligere</Th>
                    <Th>Telefon</Th>
                    <Th>E-mail</Th>
                    <Th>T-shirt</Th>
                    <Th>Tidsrum</Th>
                    <Th>Opgaver</Th>
                    <Th>Team</Th>
                    <th scope="col" className="w-0 px-2 py-3">
                      <span className="sr-only">Detaljer</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lc-border bg-white dark:divide-gray-700 dark:bg-gray-900/20">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        {volunteers.length === 0 ? "Der er ingen frivillige endnu." : "Ingen frivillige matcher filtrene."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((v) => {
                      const team = v.team_id ? teamById.get(v.team_id) : undefined;
                      return (
                        <tr
                          key={v.id}
                          onClick={() => setModal({ id: v.id })}
                          className="group cursor-pointer transition-colors odd:bg-white even:bg-gray-50/35 hover:bg-teal-50/40 dark:odd:bg-gray-900/20 dark:even:bg-gray-900/35"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {volunteerFullName(v)}
                            {team?.leader_volunteer_id === v.id ? (
                              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                <Crown className="h-3 w-3" aria-hidden />
                                Teamleder
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{ageFromBirthdate(v.birthdate) ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {v.previous_volunteer === true ? (
                              "Ja"
                            ) : v.previous_volunteer === false ? (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                                Ny
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.phone}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.email}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.tshirt_size ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {v.availability === AVAILABILITY_TIMEBOX ? v.availability_note || "Bestemt tidsrum" : v.availability ? "Hele dagen" : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {(tasksByVolunteer.get(v.id) ?? []).length === 0 ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <div className="flex max-w-[16rem] flex-wrap gap-1">
                                {(tasksByVolunteer.get(v.id) ?? []).map((t) => (
                                  <span
                                    key={t.id}
                                    className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
                                    title={`${t.name} ${formatTaskTime(t.starts_at)}–${formatTaskTime(t.ends_at)}`}
                                  >
                                    {t.name} {formatTaskTime(t.starts_at)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{team?.name ?? <span className="text-gray-400">—</span>}</td>
                          <td className="px-2 py-3 text-right">
                            <span className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold text-[#0f766e] group-hover:bg-teal-50 dark:text-teal-300 dark:group-hover:bg-teal-900/30">
                              Detaljer
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal ? (
        <VolunteerModal
          key={modal.id ?? "new"}
          volunteer={selected}
          teams={teams}
          tasks={tasks}
          assignments={assignments}
          readOnly={readOnly}
          onMail={openMail}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}
