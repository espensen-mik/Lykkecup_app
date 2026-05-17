"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StyledSelect } from "@/components/ui/styled-select";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { formatTimeForInput } from "@/lib/baner-tider";
import type { PeriodCapacityHint } from "@/lib/period-capacity";
import {
  ALL_DAY_PERIOD_PRESET,
  DEFAULT_PERIODS,
  fetchPeriodsBundle,
  formatPeriodRange,
  isAllDayPeriod,
  periodInsertPayload,
  type PeriodsBundle,
  type PoolPeriodAssignmentRow,
  type TournamentPeriodRow,
  validatePeriodTimes,
} from "@/lib/tournament-periods";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { normalizePoolLevelLabelsAction } from "@/lib/turnering-actions";

type PeriodDraft = {
  name: string;
  start: string;
  end: string;
};

function draftFromRow(row: TournamentPeriodRow): PeriodDraft {
  return {
    name: row.name,
    start: formatTimeForInput(row.start_time),
    end: formatTimeForInput(row.end_time),
  };
}

export function PerioderPanel({
  initial,
  capacityHints,
}: {
  initial: PeriodsBundle;
  capacityHints: PeriodCapacityHint[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => getAuthBrowserClient(), []);

  const [periods, setPeriods] = useState(initial.periods);
  const [pools, setPools] = useState(initial.pools);
  const [drafts, setDrafts] = useState<Record<string, PeriodDraft>>(() =>
    Object.fromEntries(initial.periods.map((p) => [p.id, draftFromRow(p)])),
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial.error);

  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("12:00");

  const poolsByLevel = useMemo(() => {
    const map = new Map<string, PoolPeriodAssignmentRow[]>();
    for (const p of pools) {
      const key = canonicalBanerLevelLabel(p.level);
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da"));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "da"));
  }, [pools]);

  const capacityByPeriodId = useMemo(
    () => new Map(capacityHints.map((h) => [h.periodId, h])),
    [capacityHints],
  );

  const periodOptions = useMemo(
    () => [
      { value: "", label: "Ingen periode" },
      ...periods.map((p) => {
        const cap = capacityByPeriodId.get(p.id);
        const capLabel =
          cap && cap.assignedPoolCount > 0
            ? cap.surplusRounds >= 0
              ? ` · ${cap.surplusRounds} ledige runder`
              : ` · mangler ~${Math.abs(cap.surplusRounds)} runder`
            : "";
        return { value: p.id, label: `${p.name} (${formatPeriodRange(p)})${capLabel}` };
      }),
    ],
    [periods, capacityByPeriodId],
  );

  const refresh = useCallback(async () => {
    const bundle = await fetchPeriodsBundle(supabase);
    if (bundle.error) {
      setError(bundle.error);
      return;
    }
    setPeriods(bundle.periods);
    setPools(bundle.pools);
    setDrafts(Object.fromEntries(bundle.periods.map((p) => [p.id, draftFromRow(p)])));
    router.refresh();
  }, [router, supabase]);

  async function ensureDefaultPeriods() {
    if (periods.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      for (let i = 0; i < DEFAULT_PERIODS.length; i += 1) {
        const d = DEFAULT_PERIODS[i]!;
        const payload = periodInsertPayload(d.name, d.start, d.end, i);
        const { error: insErr } = await supabase.from("tournament_periods").insert(payload);
        if (insErr) throw new Error(insErr.message);
      }
      setToast("Standardperioder oprettet (Formiddag & Eftermiddag).");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke oprette perioder.");
    } finally {
      setBusy(false);
    }
  }

  async function savePeriod(id: string) {
    const draft = drafts[id];
    const row = periods.find((p) => p.id === id);
    if (!draft || !row) return;
    const allDay = isAllDayPeriod(row);
    if (!allDay) {
      const err = validatePeriodTimes(draft.start, draft.end);
      if (err) {
        setError(err);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const payload = periodInsertPayload(
        draft.name,
        allDay ? ALL_DAY_PERIOD_PRESET.start : draft.start,
        allDay ? ALL_DAY_PERIOD_PRESET.end : draft.end,
        row.sort_order,
        allDay,
      );
      const { error: upErr } = await supabase
        .from("tournament_periods")
        .update({
          name: payload.name,
          start_time: payload.start_time,
          end_time: payload.end_time,
          is_all_day: payload.is_all_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (upErr) throw new Error(upErr.message);
      setToast("Periode gemt.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
    } finally {
      setBusy(false);
    }
  }

  async function addAllDayPeriod() {
    const existing = periods.some((p) => isAllDayPeriod(p));
    if (existing) {
      setError("«Hele dagen» findes allerede — tildel puljen den periode nedenfor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = periodInsertPayload(
        ALL_DAY_PERIOD_PRESET.name,
        ALL_DAY_PERIOD_PRESET.start,
        ALL_DAY_PERIOD_PRESET.end,
        periods.length,
        true,
      );
      const { error: insErr } = await supabase.from("tournament_periods").insert(payload);
      if (insErr) throw new Error(insErr.message);
      setToast("«Hele dagen» oprettet — kampe planlægges efter bane-tider, ikke Formiddag/Eftermiddag.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke oprette Hele dagen.");
    } finally {
      setBusy(false);
    }
  }

  async function addPeriod() {
    const err = validatePeriodTimes(newStart, newEnd);
    if (err) {
      setError(err);
      return;
    }
    if (!newName.trim()) {
      setError("Angiv et navn.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sortOrder = periods.length;
      const payload = periodInsertPayload(newName, newStart, newEnd, sortOrder);
      const { error: insErr } = await supabase.from("tournament_periods").insert(payload);
      if (insErr) throw new Error(insErr.message);
      setNewName("");
      setToast("Periode tilføjet.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke oprette periode.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePeriod(id: string) {
    if (!window.confirm("Slet perioden? Puljer mister tilknytning.")) return;
    setBusy(true);
    setError(null);
    try {
      const { error: delErr } = await supabase.from("tournament_periods").delete().eq("id", id);
      if (delErr) throw new Error(delErr.message);
      setToast("Periode slettet.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette.");
    } finally {
      setBusy(false);
    }
  }

  async function assignPoolPeriod(poolId: string, periodId: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("pools")
        .update({ period_id: periodId || null })
        .eq("id", poolId);
      if (upErr) throw new Error(upErr.message);
      setPools((prev) =>
        prev.map((p) => (p.id === poolId ? { ...p, period_id: periodId || null } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke tildele periode.");
    } finally {
      setBusy(false);
    }
  }

  const unassignedPools = pools.filter((p) => !p.period_id).length;

  const legacyLevelLabels = useMemo(
    () => pools.some((p) => p.level != null && p.level !== canonicalBanerLevelLabel(p.level)),
    [pools],
  );

  async function fixLegacyLevelLabels() {
    setBusy(true);
    setError(null);
    try {
      const result = await normalizePoolLevelLabelsAction();
      if (!result.ok) throw new Error(result.message);
      setToast(result.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke rette niveau-navne.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Turneringsperioder</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Hver pulje tildeles én periode (fx Formiddag). Planlægningen starter i den periode; hvis banerne er
          optaget, flyttes enkelte kampe automatisk til andre perioder — medmindre puljen er sat til{" "}
          <strong className="font-medium">Hele dagen</strong>, hvor systemet kun bruger bane-tiderne fra Opsætning.
          Kapacitet nedenfor hjælper med at fordele puljer.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            OK
          </button>
        </div>
      ) : null}

      {periods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-5 py-8 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm text-gray-600 dark:text-gray-300">Ingen perioder endnu.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void ensureDefaultPeriods()}
            className="mt-4 rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d9488] disabled:opacity-50"
          >
            Opret Formiddag &amp; Eftermiddag
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {periods.map((period) => {
            const draft = drafts[period.id] ?? draftFromRow(period);
            const cap = capacityByPeriodId.get(period.id);
            const allDay = isAllDayPeriod(period);
            return (
              <li
                key={period.id}
                className="rounded-xl border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                {allDay ? (
                  <p className="mb-3 rounded-lg border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
                    <span className="font-semibold">Hele dagen</span> — planlægning følger kun Stor/Mini-banernes
                    tilgængelighed (fx 10:00–17:00), ikke Formiddag/Eftermiddag. Velegnet til niveauer der deles
                    baner med andre puljer på tværs af dagen.
                  </p>
                ) : null}
                {cap && cap.assignedPoolCount > 0 ? (
                  <div
                    className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                      cap.surplusRounds < 0
                        ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                        : "border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/35 dark:bg-emerald-950/25 dark:text-emerald-100"
                    }`}
                  >
                    <p className="font-medium">
                      Bane-kapacitet: {cap.totalSlots} runde-pladser · behov fra puljer: ~{cap.requiredRounds}{" "}
                      runder
                      {cap.surplusRounds >= 0 ? (
                        <span> · overskud {cap.surplusRounds}</span>
                      ) : (
                        <span> · mangler ca. {Math.abs(cap.surplusRounds)} (flyt puljer eller udvid perioden)</span>
                      )}
                    </p>
                    {cap.unscheduledMatches > 0 ? (
                      <p className="mt-1 text-amber-800 dark:text-amber-200">
                        {cap.unscheduledMatches} kamp(e) i periodens puljer mangler bane/tid — brug «Planlæg
                        manglende» på Turneringsplan.
                      </p>
                    ) : null}
                  </div>
                ) : cap ? (
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    {cap.totalSlots} bane-slots i perioden · ingen puljer tildelt endnu.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[10rem] flex-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Navn</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                      value={draft.name}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, name: e.target.value },
                        }))
                      }
                    />
                  </div>
                  {!allDay ? (
                    <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Start</label>
                    <input
                      type="time"
                      className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                      value={draft.start}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, start: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Slut</label>
                    <input
                      type="time"
                      className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                      value={draft.end}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [period.id]: { ...draft, end: e.target.value },
                        }))
                      }
                    />
                  </div>
                    </>
                  ) : (
                    <p className="pb-2 text-xs text-gray-500 dark:text-gray-400">
                      Klokkeslet bruges kun i oversigten — planlægning styres af bane-tider.
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void savePeriod(period.id)}
                    className="rounded-lg bg-[#14b8a6] px-3 py-2 text-sm font-medium text-white hover:bg-[#0d9488] disabled:opacity-50"
                  >
                    Gem
                  </button>
                  <button
                    type="button"
                    disabled={busy || periods.length <= 1}
                    onClick={() => void deletePeriod(period.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                    title={periods.length <= 1 ? "Mindst én periode skal findes" : undefined}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Slet
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tilføj periode</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[8rem]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Navn</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Fx Sen eftermiddag"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Start</label>
            <input
              type="time"
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Slut</label>
            <input
              type="time"
              className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addPeriod()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tilføj
          </button>
          <button
            type="button"
            disabled={busy || periods.some((p) => isAllDayPeriod(p))}
            onClick={() => void addAllDayPeriod()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60"
            title={
              periods.some((p) => isAllDayPeriod(p))
                ? "Hele dagen findes allerede"
                : "Planlæg efter bane-tilgængelighed hele dagen"
            }
          >
            Hele dagen
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Puljer → periode</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {unassignedPools > 0 ? (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                {unassignedPools} pulje(r) uden periode — kampe får ikke automatisk tid før tildeling.
              </span>
            ) : (
              "Alle puljer har en periode."
            )}
          </p>
          {legacyLevelLabels ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Nogle puljer er gemt med gamle niveau-navne (fx med stjerner). De vises nu samlet, men du kan{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void fixLegacyLevelLabels()}
                className="font-semibold underline underline-offset-2 hover:text-amber-950 disabled:opacity-50 dark:hover:text-amber-50"
              >
                ret niveau-navne i databasen
              </button>
              .
            </p>
          ) : null}
        </div>

        {pools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Ingen puljer endnu — opret puljer under Turnering → Puljer.
          </p>
        ) : (
          <div className="space-y-6">
            {poolsByLevel.map(([level, levelPools]) => (
              <div key={level}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {level}
                </h3>
                <ul className="space-y-2">
                  {levelPools.map((pool) => (
                    <li
                      key={pool.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/30"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{pool.name}</span>
                      <div className="w-full min-w-[12rem] sm:w-64">
                        <StyledSelect
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          value={pool.period_id ?? ""}
                          onChange={(e) => void assignPoolPeriod(pool.id, e.target.value)}
                          disabled={busy || periods.length === 0}
                          aria-label={`Periode for ${pool.name}`}
                        >
                          {periodOptions.map((o) => (
                            <option key={o.value || "none"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </StyledSelect>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
