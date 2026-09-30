"use client";

import { AlertTriangle, Clock, Crown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { VolunteerFields, volunteerFieldClass } from "@/components/frivillige/volunteer-fields";
import { PickSelect } from "@/components/ui/pick-select";
import {
  assignVolunteerTaskAction,
  deleteVolunteerAction,
  saveVolunteerAction,
  unassignVolunteerTaskAction,
} from "@/lib/volunteers-actions";
import {
  overlappingTasks,
  taskTimeLabel,
  volunteerFullName,
  type Volunteer,
  type VolunteerTask,
  type VolunteerTaskAssignment,
  type VolunteerTeam,
} from "@/lib/volunteers";

type Props = {
  volunteer: Volunteer | null;
  teams: VolunteerTeam[];
  tasks: VolunteerTask[];
  assignments: VolunteerTaskAssignment[];
  readOnly: boolean;
  onClose: () => void;
};

const createdFormatter = new Intl.DateTimeFormat("da-DK", { dateStyle: "long", timeStyle: "short" });

export function VolunteerModal({ volunteer, teams, tasks, assignments, readOnly, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(volunteer?.team_id ?? "");
  const currentLeaderTeam = volunteer ? teams.find((t) => t.leader_volunteer_id === volunteer.id) : undefined;
  const [isLeader, setIsLeader] = useState(Boolean(currentLeaderTeam));
  const selectedTeam = teams.find((t) => t.id === teamId);
  const otherLeader =
    selectedTeam?.leader_volunteer_id && selectedTeam.leader_volunteer_id !== volunteer?.id ? selectedTeam.leader_volunteer_id : null;

  const myTaskIds = volunteer ? new Set(assignments.filter((a) => a.volunteer_id === volunteer.id).map((a) => a.task_id)) : new Set<string>();
  const myTasks = tasks.filter((t) => myTaskIds.has(t.id));
  const savedTeamId = volunteer?.team_id ?? null;
  const otherTasks = savedTeamId ? tasks.filter((t) => !myTaskIds.has(t.id) && t.team_id === savedTeamId) : [];
  const tasksLostOnTeamChange = (teamId || null) !== savedTeamId ? myTasks.filter((t) => t.team_id !== null && t.team_id !== (teamId || null)) : [];

  function taskChange(action: () => ReturnType<typeof assignVolunteerTaskAction>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveVolunteerAction(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!volunteer) return;
    if (!window.confirm(`Slette ${volunteerFullName(volunteer)} permanent?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteVolunteerAction(volunteer.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label={volunteer ? "Rediger frivillig" : "Opret frivillig"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {volunteer ? volunteerFullName(volunteer) : "Opret frivillig"}
            </h2>
            {volunteer ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {volunteer.source === "web" ? "Tilmeldt via lykkecup.dk/frivillig" : "Oprettet i KontrolCenter"} ·{" "}
                {createdFormatter.format(new Date(volunteer.created_at))}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Luk"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5">
          {volunteer ? <input type="hidden" name="id" value={volunteer.id} /> : null}
          <VolunteerFields defaults={volunteer ?? {}} disabled={readOnly || pending} />

          <div className="grid gap-4 border-t border-gray-200 pt-5 dark:border-gray-700 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              Team
              <PickSelect
                name="team_id"
                value={teamId}
                onChange={(id) => {
                  setTeamId(id);
                  if (!id) setIsLeader(false);
                }}
                disabled={readOnly || pending}
                placeholder="Intet team"
                options={[{ value: "", label: "Intet team" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
              />
            </label>
            <div className="flex flex-col justify-end gap-1.5">
              <input type="hidden" name="leader_field" value="1" />
              <label
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isLeader
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
                    : "border-lc-border text-gray-700 dark:border-gray-600 dark:text-gray-300"
                } ${teamId ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
              >
                <input
                  type="checkbox"
                  name="is_team_leader"
                  checked={isLeader}
                  onChange={(e) => setIsLeader(e.target.checked)}
                  disabled={readOnly || pending || !teamId}
                  className="h-4 w-4 accent-amber-500"
                />
                <Crown className={`h-4 w-4 ${isLeader ? "text-amber-500" : "text-gray-400"}`} aria-hidden />
                {selectedTeam ? `Teamleder for ${selectedTeam.name}` : "Teamleder (vælg et team først)"}
              </label>
              {tasksLostOnTeamChange.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Når du gemmer, fjernes {volunteer ? volunteer.first_name : "den frivillige"} fra{" "}
                  {tasksLostOnTeamChange.map((t) => t.name).join(", ")}.
                </p>
              ) : null}
              {isLeader && otherLeader ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">Erstatter den nuværende teamleder for {selectedTeam?.name}.</p>
              ) : null}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Intern note (kun synlig i KontrolCenter)
              <textarea name="admin_note" rows={2} defaultValue={volunteer?.admin_note ?? ""} className={volunteerFieldClass} disabled={readOnly || pending} />
            </label>
          </div>

          {volunteer ? (
            <div className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Opgaver</h3>
              {myTasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Ingen opgaver endnu.</p>
              ) : (
                <ul className="space-y-2">
                  {myTasks.map((t) => {
                    const clash = overlappingTasks(t, myTasks);
                    return (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-lc-border px-3 py-2 text-sm dark:border-gray-700"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock className="h-3 w-3" aria-hidden />
                            {taskTimeLabel(t)}
                          </p>
                          {clash.length > 0 ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" aria-hidden />
                              Overlapper med {clash.map((c) => c.name).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        {readOnly ? null : (
                          <button
                            type="button"
                            onClick={() => taskChange(() => unassignVolunteerTaskAction(t.id, volunteer.id))}
                            disabled={pending}
                            className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                          >
                            Fjern
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {readOnly || !savedTeamId ? null : (
                <PickSelect
                  value=""
                  resetOnSelect
                  onChange={(taskId) => taskId && taskChange(() => assignVolunteerTaskAction(taskId, volunteer.id))}
                  disabled={pending || otherTasks.length === 0}
                  placeholder={otherTasks.length === 0 ? "Ingen flere opgaver i teamet" : "Tilføj opgave fra teamet …"}
                  aria-label="Tilføj opgave"
                  options={otherTasks.map((t) => {
                    const clash = overlappingTasks(t, myTasks);
                    return {
                      value: t.id,
                      label: t.name,
                      hint: taskTimeLabel(t),
                      warning: clash.length > 0 ? "Overlap" : undefined,
                    };
                  })}
                />
              )}
              {!savedTeamId ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Sæt først den frivillige på et team og gem. Derefter kan du vælge blandt teamets opgaver.</p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}

          {readOnly ? null : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                >
                  {pending ? "Gemmer …" : volunteer ? "Gem" : "Opret"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Annuller
                </button>
              </div>
              {volunteer ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Slet frivillig
                </button>
              ) : null}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
