"use client";

import { ClipboardList, Crown, Mail, Pencil, Trash2, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { volunteerFieldClass } from "@/components/frivillige/volunteer-fields";
import { PickSelect } from "@/components/ui/pick-select";
import {
  deleteVolunteerTeamAction,
  saveVolunteerTeamAction,
  setVolunteerTeamAction,
  type VolunteerActionResult,
} from "@/lib/volunteers-actions";
import type { MailAudience } from "@/lib/volunteer-mail-audience";
import { taskTimeLabel, volunteerFullName, type Volunteer, type VolunteerTask, type VolunteerTeam } from "@/lib/volunteers";

type Props = {
  teams: VolunteerTeam[];
  volunteers: Volunteer[];
  tasks: VolunteerTask[];
  readOnly: boolean;
  onOpenVolunteer: (id: string) => void;
  onMail: (audience: MailAudience) => void;
};

function TeamForm({
  team,
  pending,
  onSubmit,
  onCancel,
}: {
  team?: VolunteerTeam;
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
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      {team ? <input type="hidden" name="leader_volunteer_id" value={team.leader_volunteer_id ?? ""} /> : null}
      <input name="name" required defaultValue={team?.name ?? ""} placeholder="Teamnavn, fx Café" className={volunteerFieldClass} disabled={pending} />
      <textarea
        name="description"
        rows={2}
        defaultValue={team?.description ?? ""}
        placeholder="Beskrivelse (valgfri)"
        className={volunteerFieldClass}
        disabled={pending}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
        >
          {team ? "Gem team" : "Opret team"}
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

export function VolunteerTeamsPanel({ teams, volunteers, tasks, readOnly, onOpenVolunteer, onMail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

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

  function setLeader(team: VolunteerTeam, leaderId: string) {
    const form = new FormData();
    form.set("id", team.id);
    form.set("name", team.name);
    form.set("description", team.description ?? "");
    form.set("leader_volunteer_id", leaderId);
    run(() => saveVolunteerTeamAction(form));
  }

  const unassigned = volunteers.filter((v) => !v.team_id).length;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {readOnly ? null : (
        <div className="rounded-lg border border-dashed border-lc-border p-4 dark:border-gray-700">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Nyt team</h3>
          <TeamForm
            key={formKey}
            pending={pending}
            onSubmit={(form) => run(() => saveVolunteerTeamAction(form), () => setFormKey((k) => k + 1))}
          />
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{teams.length}</span> teams ·{" "}
        <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{unassigned}</span> frivillige uden team
      </p>

      {teams.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Der er ingen teams endnu.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((team) => {
            const members = volunteers.filter((v) => v.team_id === team.id);
            const leader = members.find((m) => m.id === team.leader_volunteer_id) ?? null;
            const teamTasks = tasks.filter((t) => t.team_id === team.id);
            return (
              <section key={team.id} className="rounded-lg border border-lc-border bg-white p-4 dark:border-gray-700 dark:bg-gray-900/30">
                {editingId === team.id ? (
                  <TeamForm
                    team={team}
                    pending={pending}
                    onSubmit={(form) => run(() => saveVolunteerTeamAction(form), () => setEditingId(null))}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {team.name}{" "}
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({members.length})</span>
                      </h3>
                      {team.description ? (
                        <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{team.description}</p>
                      ) : null}
                    </div>
                    {readOnly ? null : (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onMail({ type: "teams", ids: [team.id] })}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-teal-50 hover:text-[#0f766e] dark:hover:bg-teal-900/30 dark:hover:text-teal-300"
                          aria-label={`Send mail til ${team.name}`}
                          title="Send mail"
                        >
                          <Mail className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(team.id)}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                          aria-label={`Rediger ${team.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (teamTasks.length > 0) {
                              setError(`${team.name} har ${teamTasks.length} opgave(r). Slet dem eller flyt dem til et andet team først.`);
                              return;
                            }
                            if (!window.confirm(`Slette teamet ${team.name}? De frivillige bliver ikke slettet, men står derefter uden team.`)) return;
                            run(() => deleteVolunteerTeamAction(team.id));
                          }}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          aria-label={`Slet ${team.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {teamTasks.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      Ingen opgaver endnu
                    </span>
                  ) : (
                    teamTasks.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-medium text-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
                      >
                        {t.name} · {taskTimeLabel(t)}
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Teamleder</span>
                    <PickSelect
                      value={leader?.id ?? ""}
                      onChange={(id) => setLeader(team, id)}
                      disabled={readOnly || pending || members.length === 0}
                      placeholder={members.length === 0 ? "Tilføj medlemmer først" : "Ingen teamleder"}
                      aria-label={`Teamleder for ${team.name}`}
                      options={[
                        { value: "", label: "Ingen teamleder" },
                        ...members.map((m) => ({
                          value: m.id,
                          label: volunteerFullName(m),
                          icon: <Crown className={`h-3.5 w-3.5 ${m.id === leader?.id ? "text-amber-500" : "text-gray-300 dark:text-gray-600"}`} />,
                        })),
                      ]}
                    />
                  </div>
                  {readOnly ? null : (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tilføj frivillig</span>
                      <PickSelect
                        value=""
                        resetOnSelect
                        searchable
                        onChange={(id) => id && run(() => setVolunteerTeamAction(id, team.id))}
                        disabled={pending}
                        placeholder="Vælg frivillig …"
                        emptyText="Alle frivillige er med i teamet"
                        aria-label={`Tilføj frivillig til ${team.name}`}
                        options={volunteers
                          .filter((v) => v.team_id !== team.id)
                          .map((v) => {
                            const current = v.team_id ? teamById.get(v.team_id) : undefined;
                            return {
                              value: v.id,
                              label: volunteerFullName(v),
                              group: current ? "På et andet team" : "Uden team",
                              hint: current ? `Flyttes fra ${current.name}` : undefined,
                            };
                          })
                          .sort((a, b) => (a.group === b.group ? a.label.localeCompare(b.label, "da") : a.group === "Uden team" ? -1 : 1))}
                      />
                    </div>
                  )}
                </div>

                <ul className="mt-4 divide-y divide-lc-border border-t border-lc-border dark:divide-gray-700 dark:border-gray-700">
                  {members.length === 0 ? <li className="py-2 text-sm text-gray-500 dark:text-gray-400">Ingen frivillige på teamet endnu.</li> : null}
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <button
                        type="button"
                        onClick={() => onOpenVolunteer(m.id)}
                        className="flex min-w-0 items-center gap-1.5 text-left text-gray-800 hover:text-[#0f766e] dark:text-gray-200 dark:hover:text-teal-300"
                      >
                        {m.id === leader?.id ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Teamleder" /> : null}
                        <span className="truncate">{volunteerFullName(m)}</span>
                      </button>
                      {readOnly ? null : (
                        <button
                          type="button"
                          onClick={() => run(() => setVolunteerTeamAction(m.id, null))}
                          disabled={pending}
                          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                          aria-label={`Fjern ${volunteerFullName(m)} fra ${team.name}`}
                          title="Fjern fra team"
                        >
                          <UserMinus className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
