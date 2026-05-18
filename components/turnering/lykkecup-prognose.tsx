"use client";

import { useCallback, useMemo, useState } from "react";
import type { BanerTiderBundle, CourtType } from "@/lib/baner-tider";
import { compareCourtNamesForSchedule } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel, formatLevelShortLabel, sortLevelKeysForNav } from "@/lib/holddannelse";
import { courtTypeForLevel, defaultRoundsPerMatchForLevel } from "@/lib/level-court-settings";
import { findLevelScheduleRow } from "@/lib/puljer";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  computeRegnemaskineSnapshot,
  conservativeRoundTimingFromSchedule,
  courtsRowsToRegnemaskineCourts,
  DEFAULT_PLAN_MATCHES_PER_TEAM,
  type RegnemaskineLevelPlan,
} from "@/lib/lykkecup-regnemaskine";

type PrognoseLevelDraft = {
  id: string;
  levelKey: string;
  teamCount: string;
  matchesPerTeam: string;
};

function courtTypeLabel(t: CourtType | string): string {
  switch (t) {
    case "mini":
      return "Mini";
    case "kort":
      return "Kort";
    case "stor":
      return "Stor";
    default:
      return String(t);
  }
}

function matchesPerTeamFromSettings(levelKey: string, baner: BanerTiderBundle): number {
  const row = findLevelScheduleRow(levelKey, baner.levelSettings);
  const m = row?.plan_matches_per_team;
  if (m != null && Number.isFinite(m) && m >= 0) return Math.floor(m);
  return DEFAULT_PLAN_MATCHES_PER_TEAM;
}

function roundsPerMatchFromSettings(levelKey: string, baner: BanerTiderBundle): number {
  const row = findLevelScheduleRow(levelKey, baner.levelSettings);
  const rpm = row?.rounds_per_match;
  if (rpm != null && Number.isFinite(rpm) && rpm >= 1) return Math.min(4, Math.floor(rpm));
  return defaultRoundsPerMatchForLevel(levelKey);
}

function levelKeysFromSettings(baner: BanerTiderBundle): string[] {
  const keys = new Set<string>();
  for (const r of baner.levelSettings) keys.add(canonicalBanerLevelLabel(r.level));
  for (const r of baner.levelCourtSettings) keys.add(canonicalBanerLevelLabel(r.level));
  return sortLevelKeysForNav([...keys]);
}

function initialDrafts(baner: BanerTiderBundle): PrognoseLevelDraft[] {
  const keys = levelKeysFromSettings(baner);
  if (keys.length === 0) {
    return [{ id: newDraftId(), levelKey: "", teamCount: "0", matchesPerTeam: String(DEFAULT_PLAN_MATCHES_PER_TEAM) }];
  }
  return keys.map((levelKey) => ({
    id: newDraftId(),
    levelKey,
    teamCount: "0",
    matchesPerTeam: String(matchesPerTeamFromSettings(levelKey, baner)),
  }));
}

function buildPrognoseLevelPlans(
  drafts: readonly PrognoseLevelDraft[],
  baner: BanerTiderBundle,
): RegnemaskineLevelPlan[] {
  const plans: RegnemaskineLevelPlan[] = [];
  for (const draft of drafts) {
    const levelKey = draft.levelKey.trim();
    if (!levelKey) continue;
    const teamCount = Math.max(0, Math.floor(Number.parseInt(draft.teamCount, 10) || 0));
    const parsedMatches = Number.parseInt(draft.matchesPerTeam, 10);
    const matchesPerTeam =
      Number.isFinite(parsedMatches) && parsedMatches >= 0
        ? Math.floor(parsedMatches)
        : matchesPerTeamFromSettings(levelKey, baner);
    plans.push({
      level: canonicalBanerLevelLabel(levelKey),
      playerCount: 0,
      teamCount,
      matchesPerTeam,
      roundsPerMatch: roundsPerMatchFromSettings(levelKey, baner),
      courtType: courtTypeForLevel(levelKey, baner.levelCourtSettings),
    });
  }
  return plans;
}

let draftIdCounter = 0;
function newDraftId(): string {
  draftIdCounter += 1;
  return `prognose-${draftIdCounter}`;
}

export function LykkecupPrognose({ baner }: { baner: BanerTiderBundle }) {
  const [drafts, setDrafts] = useState<PrognoseLevelDraft[]>(() => initialDrafts(baner));

  const resetFromSettings = useCallback(() => {
    setDrafts(initialDrafts(baner));
  }, [baner]);

  const roundTiming = useMemo(
    () => conservativeRoundTimingFromSchedule(baner.levelSettings),
    [baner.levelSettings],
  );

  const levelPlans = useMemo(() => buildPrognoseLevelPlans(drafts, baner), [drafts, baner]);

  const snapshot = useMemo(() => {
    if (baner.error) return null;
    const courts = courtsRowsToRegnemaskineCourts(baner.courts);
    const availability = availabilityRowsToRegnemaskineAvailability(baner.availability);
    const breaks = breakRowsToRegnemaskineBreaks(baner.breaks);
    return computeRegnemaskineSnapshot(courts, availability, breaks, roundTiming, levelPlans, {});
  }, [baner, roundTiming, levelPlans]);

  const demandRows = snapshot?.levels ?? [];
  const balanceRows = snapshot?.byCourtType ?? [];

  const totalRequiredMatches = demandRows.reduce((s, r) => s + r.totalMatches, 0);
  const totalRequiredRounds = demandRows.reduce((s, r) => s + r.requiredRounds, 0);
  const totalCapacity = balanceRows.reduce((s, r) => s + r.capacityRounds, 0);
  const totalSurplus = balanceRows.reduce((s, r) => s + r.surplus, 0);
  const hasDeficit = balanceRows.some((r) => r.surplus < 0);

  const venueNameById = useMemo(() => new Map(baner.venues.map((v) => [v.id, v.name])), [baner.venues]);

  const courtCapacityRows = useMemo(() => {
    if (!snapshot) return [];
    const capById = new Map(snapshot.courts.map((c) => [c.courtId, c.slots]));
    return baner.courts
      .filter((c) => c.is_active)
      .map((c) => ({
        courtId: c.id,
        courtName: c.name,
        venueName: venueNameById.get(c.venue_id) ?? "—",
        courtType: c.court_type,
        capacity: capById.get(c.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.venueName.localeCompare(b.venueName, "da") ||
          compareCourtNamesForSchedule(a.courtName, b.courtName),
      );
  }, [baner.courts, snapshot, venueNameById]);

  function updateDraft(id: string, patch: Partial<Pick<PrognoseLevelDraft, "levelKey" | "teamCount" | "matchesPerTeam">>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: string) {
    setDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      {
        id: newDraftId(),
        levelKey: "",
        teamCount: "0",
        matchesPerTeam: String(DEFAULT_PLAN_MATCHES_PER_TEAM),
      },
    ]);
  }

  return (
    <section className="space-y-6 rounded-xl border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Prognose</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            Leg med antal hold pr. niveau og se om der er nok runder på banerne. Baner, åbningstider, kampvarighed,
            pauser og runder pr. kamp hentes fra Opsætning — intet gemmes her.
          </p>
          {baner.error ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Banedata kunne ikke indlæses ({baner.error}) — kapacitet vises ikke.
            </p>
          ) : snapshot ? (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Rundelængde (konservativ):{" "}
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                {roundTiming.matchDurationMinutes + roundTiming.breakBetweenMatchesMinutes} min
              </span>{" "}
              (kamp {roundTiming.matchDurationMinutes} min + pause {roundTiming.breakBetweenMatchesMinutes} min).{" "}
              <span className="font-semibold tabular-nums">{totalRequiredMatches}</span> kampe /{" "}
              <span className="font-semibold tabular-nums">{totalRequiredRounds}</span> runder behov mod{" "}
              <span className="font-semibold tabular-nums">{totalCapacity}</span> runder kapacitet
              {hasDeficit ? (
                <span className="font-semibold text-red-700 dark:text-red-400"> — mangler kapacitet</span>
              ) : totalSurplus > 0 ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {" "}
                  (+{totalSurplus} runder i alt)
                </span>
              ) : null}
              .
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={resetFromSettings}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Nulstil niveauer
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="min-w-[640px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
              <th className="px-3 py-2">Niveau</th>
              <th className="px-3 py-2">Hold</th>
              <th className="px-3 py-2">Kampe/hold</th>
              <th className="px-3 py-2">Bane</th>
              <th className="px-3 py-2">Runder/kamp</th>
              <th className="px-3 py-2">Kampe</th>
              <th className="px-3 py-2">Runder</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => {
              const canon = draft.levelKey.trim() ? canonicalBanerLevelLabel(draft.levelKey) : "";
              const plan = canon ? demandRows.find((r) => r.level === canon) : undefined;
              const rpm = canon ? roundsPerMatchFromSettings(canon, baner) : "—";
              const courtType = canon ? courtTypeForLevel(canon, baner.levelCourtSettings) : null;
              return (
                <tr key={draft.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list="prognose-level-options"
                      value={draft.levelKey}
                      onChange={(e) => updateDraft(draft.id, { levelKey: e.target.value })}
                      placeholder="Fx ROCK"
                      className="min-w-[8rem] rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={draft.teamCount}
                      onChange={(e) => updateDraft(draft.id, { teamCount: e.target.value })}
                      className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm tabular-nums dark:border-gray-600 dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.matchesPerTeam}
                      onChange={(e) => updateDraft(draft.id, { matchesPerTeam: e.target.value })}
                      className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm tabular-nums dark:border-gray-600 dark:bg-gray-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                    {courtType ? courtTypeLabel(courtType) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-400">{rpm}</td>
                  <td
                    className="px-3 py-2 tabular-nums text-gray-900 dark:text-white"
                    title={
                      plan && !plan.parityOk && plan.teamCount > 0
                        ? "Hold × kampe/hold er ulige — planlægningsskøn"
                        : undefined
                    }
                  >
                    {plan?.totalMatches ?? "—"}
                    {plan && !plan.parityOk && plan.teamCount > 0 ? (
                      <span className="ml-1 text-xs text-amber-700 dark:text-amber-300" aria-hidden>
                        *
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{plan?.requiredRounds ?? "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeDraft(draft.id)}
                      className="text-xs font-medium text-gray-500 hover:text-red-700 dark:text-gray-400 dark:hover:text-red-400"
                      title="Fjern række"
                    >
                      Fjern
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="prognose-level-options">
          {levelKeysFromSettings(baner).map((k) => (
            <option key={k} value={formatLevelShortLabel(k)} />
          ))}
          {levelKeysFromSettings(baner).map((k) => (
            <option key={`${k}-full`} value={k} />
          ))}
        </datalist>
      </div>

      <button
        type="button"
        onClick={addDraft}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-[#14b8a6] hover:text-[#0f766e] dark:border-gray-600 dark:text-gray-300 dark:hover:border-teal-600 dark:hover:text-teal-300"
      >
        + Tilføj niveau
      </button>

      {balanceRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Runder pr. banetype</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-[560px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                  <th className="px-3 py-2">Banetype</th>
                  <th className="px-3 py-2">Runder (kapacitet)</th>
                  <th className="px-3 py-2">Krævede kampe</th>
                  <th className="px-3 py-2">Krævede runder</th>
                  <th className="px-3 py-2">Kapacitet vs. prognose</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map((r) => (
                  <tr key={r.courtType} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      {courtTypeLabel(r.courtType)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{r.capacityRounds}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{r.requiredMatches}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-gray-900 dark:text-white">
                      {r.requiredRounds}
                    </td>
                    <td
                      className={`px-3 py-2 font-semibold tabular-nums ${
                        r.surplus >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {r.surplus >= 0 ? "+" : ""}
                      {r.surplus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Kapacitet fra aktive baner, åbningstider og pauser under Haller &amp; baner. Negativ værdi = for få
            runde-pladser til prognosen.
          </p>
        </div>
      ) : null}

      {courtCapacityRows.length > 0 ? (
        <div className="space-y-2 border-t border-gray-200 pt-6 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Banekapacitet (fra opsætning)</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Antal runder hver aktiv bane kan tage med nuværende tider — uden planlagte kampe.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-[400px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                  <th className="px-3 py-2">Bane</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Runder</th>
                </tr>
              </thead>
              <tbody>
                {courtCapacityRows.map((c) => (
                  <tr key={c.courtId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 text-gray-900 dark:text-white">
                      <span className="font-medium">{c.courtName}</span>
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({c.venueName})</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{courtTypeLabel(c.courtType)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                      {c.capacity > 0 ? c.capacity : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
