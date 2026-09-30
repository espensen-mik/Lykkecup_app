"use client";

import { AlertTriangle, Clock, Crown, Pencil, Trash2, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { volunteerFieldClass } from "@/components/frivillige/volunteer-fields";
import { PickSelect } from "@/components/ui/pick-select";
import {
  assignVolunteerTaskAction,
  deleteVolunteerTaskAction,
  saveVolunteerTaskAction,
  unassignVolunteerTaskAction,
  type VolunteerActionResult,
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
  tasks: VolunteerTask[];
  assignments: VolunteerTaskAssignment[];
  volunteers: Volunteer[];
  teams: VolunteerTeam[];
  readOnly: boolean;
  onOpenVolunteer: (id: string) => void;
};

const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300";

function TaskForm({
  task,
  teams,
  pending,
  onSubmit,
  onCancel,
}: {
  task?: VolunteerTask;
  teams: VolunteerTeam[];
  pending: boolean;
  onSubmit: (form: FormData) => void;
  onCancel?: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-3"
    >
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className={`${labelClass} lg:col-span-2`}>
          Team
          <PickSelect
            name="team_id"
            defaultValue={task?.team_id ?? ""}
            disabled={pending}
            placeholder="Vælg team …"
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Opgave
          <input
            name="name"
            required
            defaultValue={task?.name ?? ""}
            placeholder="Fx Guldskranke"
            className={volunteerFieldClass}
            disabled={pending}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Vagt (valgfri)
          <input
            name="period_label"
            defaultValue={task?.period_label ?? ""}
            placeholder="Fx Formiddag"
            className={volunteerFieldClass}
            disabled={pending}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Fra
          <input
            name="starts_at"
            type="time"
            required
            defaultValue={task?.starts_at.slice(0, 5) ?? ""}
            className={volunteerFieldClass}
            disabled={pending}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Til
          <input
            name="ends_at"
            type="time"
            required
            defaultValue={task?.ends_at.slice(0, 5) ?? ""}
            className={volunteerFieldClass}
            disabled={pending}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Pladser
          <input
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={task?.capacity ?? ""}
            placeholder="Fx 4"
            className={volunteerFieldClass}
            disabled={pending}
          />
        </label>
      </div>
      <textarea
        name="description"
        rows={2}
        defaultValue={task?.description ?? ""}
        placeholder="Beskrivelse til de frivillige (valgfri)"
        className={volunteerFieldClass}
        disabled={pending}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
        >
          {task ? "Gem opgave" : "Opret opgave"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Annuller
          </button>
        ) : null}
      </div>
    </form>
  );
}

function CapacityBadge({ filled, capacity }: { filled: number; capacity: number | null }) {
  if (capacity === null) {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        {filled} på
      </span>
    );
  }
  const missing = capacity - filled;
  const tone =
    missing > 0
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      : missing === 0
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}>
      {filled}/{capacity}
      {missing > 0 ? ` · mangler ${missing}` : missing === 0 ? " · fuld" : ` · ${-missing} for mange`}
    </span>
  );
}

export function VolunteerTasksPanel({ tasks, assignments, volunteers, teams, readOnly, onOpenVolunteer }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const volunteerById = useMemo(() => new Map(volunteers.map((v) => [v.id, v])), [volunteers]);
  const leaderIds = useMemo(() => new Set(teams.map((t) => t.leader_volunteer_id).filter(Boolean)), [teams]);
  const tasksByVolunteer = useMemo(() => {
    const map = new Map<string, VolunteerTask[]>();
    for (const a of assignments) {
      const task = taskById.get(a.task_id);
      if (!task) continue;
      map.set(a.volunteer_id, [...(map.get(a.volunteer_id) ?? []), task]);
    }
    return map;
  }, [assignments, taskById]);

  function run(action: () => Promise<VolunteerActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  const totalCapacity = tasks.reduce((sum, t) => sum + (t.capacity ?? 0), 0);
  const totalMissing = tasks.reduce((sum, t) => {
    if (t.capacity === null) return sum;
    const filled = assignments.filter((a) => a.task_id === t.id).length;
    return sum + Math.max(0, t.capacity - filled);
  }, 0);
  const withoutTask = volunteers.filter((v) => v.team_id && !tasksByVolunteer.has(v.id)).length;

  const groups = [
    ...teams.map((team) => ({
      key: team.id,
      team,
      leader: team.leader_volunteer_id ? (volunteerById.get(team.leader_volunteer_id) ?? null) : null,
      memberCount: volunteers.filter((v) => v.team_id === team.id).length,
      tasks: tasks.filter((t) => t.team_id === team.id),
    })),
    {
      key: "none",
      team: null,
      leader: null,
      memberCount: volunteers.filter((v) => !v.team_id).length,
      tasks: tasks.filter((t) => t.team_id === null),
    },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {["Opret teams", "Opret opgaver i teamene", "Sæt frivillige på teams", "Sæt teamets frivillige på opgaver"].map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#14b8a6] text-[0.7rem] font-bold text-white">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {readOnly ? null : teams.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lc-border p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          Opret først et team under fanen Teams. Derefter kan du oprette teamets opgaver her.
        </p>
      ) : (
        <div className="rounded-lg border border-dashed border-lc-border p-4 dark:border-gray-700">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Ny opgave</h3>
          <TaskForm
            key={formKey}
            teams={teams}
            pending={pending}
            onSubmit={(form) =>
              run(
                () => saveVolunteerTaskAction(form),
                () => setFormKey((k) => k + 1),
              )
            }
          />
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{tasks.length}</span> opgaver
        {totalCapacity > 0 ? (
          <>
            {" "}
            · <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{totalMissing}</span> ledige pladser
          </>
        ) : null}{" "}
        · <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{withoutTask}</span> frivillige på et team uden opgave
      </p>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Der er ingen opgaver endnu.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-lc-border pb-2 dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {group.team?.name ?? "Uden team"}{" "}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    · {group.tasks.length} {group.tasks.length === 1 ? "opgave" : "opgaver"} · {group.memberCount} i teamet
                  </span>
                </h3>
                {group.leader ? (
                  <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
                    <Crown className="h-3.5 w-3.5" aria-hidden />
                    {volunteerFullName(group.leader)}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {group.tasks.map((task) => {
                  const memberIds = assignments.filter((a) => a.task_id === task.id).map((a) => a.volunteer_id);
                  const members = memberIds
                    .map((id) => volunteerById.get(id))
                    .filter((v): v is Volunteer => Boolean(v))
                    .sort((a, b) => volunteerFullName(a).localeCompare(volunteerFullName(b), "da"));
                  const teamMemberCount = volunteers.filter((v) => task.team_id !== null && v.team_id === task.team_id).length;
            const candidates = volunteers.filter(
                    (v) => !memberIds.includes(v.id) && (task.team_id === null || v.team_id === task.team_id),
                  );
                  const pct = task.capacity ? Math.min(100, Math.round((members.length / task.capacity) * 100)) : 0;

                  return (
                    <section
                      key={task.id}
                      className="rounded-lg border border-lc-border bg-white p-4 dark:border-gray-700 dark:bg-gray-900/30"
                    >
                      {editingId === task.id ? (
                        <TaskForm
                          task={task}
                          teams={teams}
                          pending={pending}
                          onSubmit={(form) =>
                            run(
                              () => saveVolunteerTaskAction(form),
                              () => setEditingId(null),
                            )
                          }
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{task.name}</h3>
                              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                                <Clock className="h-3.5 w-3.5 text-[#14b8a6]" aria-hidden />
                                {taskTimeLabel(task)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <CapacityBadge filled={members.length} capacity={task.capacity} />
                              {readOnly ? null : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(task.id)}
                                    className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                    aria-label={`Rediger ${task.name}`}
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm(`Slette opgaven ${task.name}? De frivillige bliver ikke slettet.`)) return;
                                      run(() => deleteVolunteerTaskAction(task.id));
                                    }}
                                    className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                                    aria-label={`Slet ${task.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {task.description ? (
                            <p className="mt-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                          ) : null}
                          {task.capacity ? (
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className={`h-full rounded-full ${members.length > task.capacity ? "bg-red-500" : members.length === task.capacity ? "bg-emerald-500" : "bg-amber-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          ) : null}
                        </>
                      )}

                      {readOnly ? null : (
                        <div className="mt-4">
                          <PickSelect
                            value=""
                            resetOnSelect
                            searchable
                            onChange={(volunteerId) => volunteerId && run(() => assignVolunteerTaskAction(task.id, volunteerId))}
                            disabled={pending || candidates.length === 0}
                            placeholder={
                              candidates.length > 0
                                ? "Tilføj frivillig fra teamet …"
                                : teamMemberCount > 0
                                  ? "Alle i teamet er sat på"
                                  : "Tilføj først frivillige til teamet"
                            }
                            aria-label={`Tilføj frivillig til ${task.name}`}
                            options={candidates.map((v) => {
                              const clash = overlappingTasks(task, tasksByVolunteer.get(v.id) ?? []);
                              return {
                                value: v.id,
                                label: volunteerFullName(v),
                                hint: clash.length > 0 ? `Optaget: ${clash.map((t) => `${t.name} ${taskTimeLabel(t)}`).join(", ")}` : undefined,
                                warning: clash.length > 0 ? "Overlap" : undefined,
                                icon: leaderIds.has(v.id) ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : undefined,
                              };
                            })}
                          />
                        </div>
                      )}

                      <ul className="mt-3 divide-y divide-lc-border border-t border-lc-border dark:divide-gray-700 dark:border-gray-700">
                        {members.length === 0 ? (
                          <li className="py-2 text-sm text-gray-500 dark:text-gray-400">Ingen frivillige endnu.</li>
                        ) : null}
                        {members.map((m) => {
                          const clash = overlappingTasks(task, tasksByVolunteer.get(m.id) ?? []);
                          return (
                            <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                              <button
                                type="button"
                                onClick={() => onOpenVolunteer(m.id)}
                                className="flex min-w-0 items-center gap-1.5 text-left text-gray-800 hover:text-[#0f766e] dark:text-gray-200 dark:hover:text-teal-300"
                              >
                                {leaderIds.has(m.id) ? (
                                  <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Teamleder" />
                                ) : null}
                                <span className="truncate">{volunteerFullName(m)}</span>
                                {clash.length > 0 ? (
                                  <span
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                    title={`Overlapper med ${clash.map((t) => `${t.name} (${taskTimeLabel(t)})`).join(", ")}`}
                                  >
                                    <AlertTriangle className="h-3 w-3" aria-hidden />
                                    Overlap
                                  </span>
                                ) : null}
                              </button>
                              {readOnly ? null : (
                                <button
                                  type="button"
                                  onClick={() => run(() => unassignVolunteerTaskAction(task.id, m.id))}
                                  disabled={pending}
                                  className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                                  aria-label={`Fjern ${volunteerFullName(m)} fra ${task.name}`}
                                  title="Fjern fra opgave"
                                >
                                  <UserMinus className="h-4 w-4" aria-hidden />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
