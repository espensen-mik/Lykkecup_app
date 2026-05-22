"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BanerTiderBundle, CourtType, LevelScheduleRow } from "@/lib/baner-tider";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { canonicalBanerLevelLabel, formatLevelShortLabel } from "@/lib/holddannelse";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  buildRegnemaskineLevelPlans,
  computePoolDemandSnapshot,
  computeRegnemaskineSnapshot,
  conservativeRoundTimingFromSchedule,
  courtsRowsToRegnemaskineCourts,
  DEFAULT_PLAN_MATCHES_PER_TEAM,
} from "@/lib/lykkecup-regnemaskine";
import { BaneStatusPanel } from "@/components/turnering/bane-status-panel";
import { insertLevelSchedulePlanning, writeLevelSchedulePlanning } from "@/lib/level-schedule-settings";
import { revalidateAfterKampeSettingsAction } from "@/lib/turnering-actions";
import { findLevelScheduleRow, poolPlanningHint } from "@/lib/puljer";
import { TURNERING_EVENT_ID } from "@/lib/turnering";

export type RegnemaskineLevelInput = {
  levelKey: string;
  playerCount: number;
  teamCount: number;
};

export type RegnemaskinePoolInput = { id: string; level: string | null };
export type RegnemaskineTeamPoolInput = { pool_id: string | null };

function courtTypeLabel(t: CourtType): string {
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

function planningSig(rows: LevelScheduleRow[]): string {
  return rows
    .map(
      (r) =>
        `${canonicalBanerLevelLabel(r.level)}:${r.plan_matches_per_team ?? ""}:${r.plan_target_teams_per_pool ?? ""}:${r.plan_max_teams_per_pool ?? ""}`,
    )
    .sort()
    .join("|");
}

function matchesDraftFromServer(levels: RegnemaskineLevelInput[], scheduleRows: LevelScheduleRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of levels) {
    const row = findLevelScheduleRow(l.levelKey, scheduleRows);
    const m = row?.plan_matches_per_team ?? DEFAULT_PLAN_MATCHES_PER_TEAM;
    out[l.levelKey] = String(m);
  }
  return out;
}

function poolTargetDraftFromServer(
  levels: RegnemaskineLevelInput[],
  scheduleRows: LevelScheduleRow[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of levels) {
    const row = findLevelScheduleRow(l.levelKey, scheduleRows);
    const t = row?.plan_target_teams_per_pool;
    out[l.levelKey] = t != null ? String(t) : "";
  }
  return out;
}

function poolMaxDraftFromServer(
  levels: RegnemaskineLevelInput[],
  scheduleRows: LevelScheduleRow[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of levels) {
    const row = findLevelScheduleRow(l.levelKey, scheduleRows);
    const m = row?.plan_max_teams_per_pool;
    out[l.levelKey] = m != null ? String(m) : "";
  }
  return out;
}

function parseOptionalPoolField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 2 || n > 99) return null;
  return n;
}

type OpsætningTabId = "haller" | "niveau";

export function LykkecupRegnemaskine({
  levels,
  baner,
  pools = [],
  teams = [],
  embedded = false,
  onOpenTab,
}: {
  levels: RegnemaskineLevelInput[];
  baner: BanerTiderBundle;
  pools?: readonly RegnemaskinePoolInput[];
  teams?: readonly RegnemaskineTeamPoolInput[];
  embedded?: boolean;
  onOpenTab?: (tab: OpsætningTabId) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getAuthBrowserClient(), []);
  const eventId = TURNERING_EVENT_ID;

  const [matchesDrafts, setMatchesDrafts] = useState<Record<string, string>>(() =>
    matchesDraftFromServer(levels, baner.levelSettings),
  );
  const [poolTargetDrafts, setPoolTargetDrafts] = useState<Record<string, string>>(() =>
    poolTargetDraftFromServer(levels, baner.levelSettings),
  );
  const [poolMaxDrafts, setPoolMaxDrafts] = useState<Record<string, string>>(() =>
    poolMaxDraftFromServer(levels, baner.levelSettings),
  );
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const serverSig = useMemo(() => planningSig(baner.levelSettings), [baner.levelSettings]);

  const levelsRef = useRef(levels);
  const scheduleRef = useRef(baner.levelSettings);
  levelsRef.current = levels;
  scheduleRef.current = baner.levelSettings;

  const levelKeysSig = useMemo(() => levels.map((l) => `${l.levelKey}:${l.teamCount}:${l.playerCount}`).sort().join("|"), [levels]);

  useEffect(() => {
    setMatchesDrafts(matchesDraftFromServer(levelsRef.current, scheduleRef.current));
    setPoolTargetDrafts(poolTargetDraftFromServer(levelsRef.current, scheduleRef.current));
    setPoolMaxDrafts(poolMaxDraftFromServer(levelsRef.current, scheduleRef.current));
  }, [serverSig, levelKeysSig]);

  const roundTiming = useMemo(() => conservativeRoundTimingFromSchedule(baner.levelSettings), [baner.levelSettings]);

  const levelPlans = useMemo(() => {
    const withMatches = levels.map((l) => ({
      levelKey: l.levelKey,
      playerCount: l.playerCount,
      teamCount: l.teamCount,
      matchesPerTeam: Math.max(0, Number.parseInt(matchesDrafts[l.levelKey] ?? "", 10) || DEFAULT_PLAN_MATCHES_PER_TEAM),
    }));
    const persisted = baner.levelSettings.map((r) => ({
      level: r.level,
      plan_matches_per_team: r.plan_matches_per_team,
      rounds_per_match: r.rounds_per_match,
    }));
    return buildRegnemaskineLevelPlans(withMatches, persisted, DEFAULT_PLAN_MATCHES_PER_TEAM, baner.levelCourtSettings);
  }, [levels, matchesDrafts, baner.levelSettings, baner.levelCourtSettings]);

  const snapshot = useMemo(() => {
    if (baner.error) {
      return null;
    }
    const courts = courtsRowsToRegnemaskineCourts(baner.courts);
    const availability = availabilityRowsToRegnemaskineAvailability(baner.availability);
    const breaks = breakRowsToRegnemaskineBreaks(baner.breaks);
    return computeRegnemaskineSnapshot(
      courts,
      availability,
      breaks,
      roundTiming,
      levelPlans,
      baner.scheduledSlotsByCourtId,
    );
  }, [baner.error, baner.courts, baner.availability, baner.breaks, baner.scheduledSlotsByCourtId, roundTiming, levelPlans]);

  const demandRows = snapshot?.levels ?? [];
  const balanceRows = snapshot?.byCourtType ?? [];

  const poolDemand = useMemo(
    () => computePoolDemandSnapshot(pools, teams, levelPlans),
    [pools, teams, levelPlans],
  );

  const setMatchesDraft = useCallback((levelKey: string, matches: string) => {
    setMatchesDrafts((prev) => ({ ...prev, [levelKey]: matches }));
  }, []);

  const setPoolTargetDraft = useCallback((levelKey: string, value: string) => {
    setPoolTargetDrafts((prev) => ({ ...prev, [levelKey]: value }));
  }, []);

  const setPoolMaxDraft = useCallback((levelKey: string, value: string) => {
    setPoolMaxDrafts((prev) => ({ ...prev, [levelKey]: value }));
  }, []);

  const saveLevel = useCallback(
    async (levelKey: string) => {
      setLocalError(null);
      const matches = Number.parseInt(matchesDrafts[levelKey] ?? "", 10);
      if (!Number.isFinite(matches) || matches < 0 || matches > 99) {
        setLocalError("Kampe pr. hold skal være mellem 0 og 99.");
        return;
      }

      const targetRaw = poolTargetDrafts[levelKey] ?? "";
      const maxRaw = poolMaxDrafts[levelKey] ?? "";
      if (targetRaw.trim() && parseOptionalPoolField(targetRaw) == null) {
        setLocalError("Mål hold/pulje skal være tom eller et tal mellem 2 og 99.");
        return;
      }
      if (maxRaw.trim() && parseOptionalPoolField(maxRaw) == null) {
        setLocalError("Maks hold/pulje skal være tom eller et tal mellem 2 og 99.");
        return;
      }
      const planTargetTeamsPerPool = parseOptionalPoolField(targetRaw);
      const planMaxTeamsPerPool = parseOptionalPoolField(maxRaw);
      if (
        planTargetTeamsPerPool != null &&
        planMaxTeamsPerPool != null &&
        planMaxTeamsPerPool < planTargetTeamsPerPool
      ) {
        setLocalError("Maks hold/pulje kan ikke være lavere end mål hold/pulje.");
        return;
      }

      const canon = canonicalBanerLevelLabel(levelKey);
      const short = formatLevelShortLabel(levelKey).toLowerCase();
      const matching = baner.levelSettings.filter(
        (r) => formatLevelShortLabel(r.level).toLowerCase() === short,
      );
      setSavingLevel(levelKey);
      try {
        const payload = {
          plan_matches_per_team: matches,
          plan_target_teams_per_pool: planTargetTeamsPerPool,
          plan_max_teams_per_pool: planMaxTeamsPerPool,
        };
        if (matching.length > 0) {
          const ids = matching.map((r) => r.id);
          const writeRes = await writeLevelSchedulePlanning(supabase, ids, payload);
          if (writeRes.error) {
            setLocalError(writeRes.error);
            return;
          }
          if (!writeRes.poolColumnsAvailable && (planTargetTeamsPerPool != null || planMaxTeamsPerPool != null)) {
            setLocalError(
              "Kampe/hold gemt. Puljestørrelse kræver migration — kør supabase/migrations/20260520130000_level_schedule_pool_settings.sql i Supabase.",
            );
            await revalidateAfterKampeSettingsAction(levelKey);
            router.refresh();
            return;
          }
        } else {
          const insRes = await insertLevelSchedulePlanning(supabase, {
            event_id: eventId,
            level: canon,
            match_duration_minutes: 60,
            break_between_matches_minutes: 5,
            ...payload,
          });
          if (insRes.error) {
            setLocalError(insRes.error);
            return;
          }
          if (!insRes.poolColumnsAvailable && (planTargetTeamsPerPool != null || planMaxTeamsPerPool != null)) {
            setLocalError(
              "Kampe/hold gemt. Puljestørrelse kræver migration — kør supabase/migrations/20260520130000_level_schedule_pool_settings.sql i Supabase.",
            );
            await revalidateAfterKampeSettingsAction(levelKey);
            router.refresh();
            return;
          }
        }
        await revalidateAfterKampeSettingsAction(levelKey);
        router.refresh();
      } finally {
        setSavingLevel(null);
      }
    },
    [matchesDrafts, poolTargetDrafts, poolMaxDrafts, baner.levelSettings, supabase, eventId, router],
  );

  const totalRequiredMatches = demandRows.reduce((s, r) => s + r.totalMatches, 0);
  const totalRequiredRounds = demandRows.reduce((s, r) => s + r.requiredRounds, 0);
  const totalCapacity = balanceRows.reduce((s, r) => s + r.capacityRounds, 0);
  const totalUsed = balanceRows.reduce((s, r) => s + r.usedRounds, 0);

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded
    ? "space-y-4"
    : "space-y-4 rounded-xl border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none";

  return (
    <Wrapper className={wrapperClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {!embedded ? <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampe</h2> : null}
          <p className={`max-w-3xl text-sm text-gray-500 dark:text-gray-400 ${embedded ? "" : "mt-1"}`}>
            Overblik over kampebehov (hold fra Holddannelse × kampe/hold) vs. runder på banerne
            {embedded && onOpenTab ? (
              <>
                {" "}
                fra{" "}
                <button
                  type="button"
                  onClick={() => onOpenTab("haller")}
                  className="font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
                >
                  Haller &amp; baner
                </button>{" "}
                og{" "}
                <button
                  type="button"
                  onClick={() => onOpenTab("niveau")}
                  className="font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
                >
                  Niveau indstillinger
                </button>
              </>
            ) : (
              <>
                {" "}
                fra{" "}
                <Link href="/turnering/baner" className="font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400">
                  Opsætning
                </Link>
              </>
            )}
            . Én kamp bruger én runde på én bane. Standard er {DEFAULT_PLAN_MATCHES_PER_TEAM} kampe/hold indtil du gemmer andet.
            Puljestørrelse (mål/maks hold pr. pulje) bruges i Puljer og Turneringsplan — tom mål = kampe/hold + 1.
          </p>
          {baner.error ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Banedata kunne ikke indlæses ({baner.error}) — efterspørgsel vises, men ikke kapacitet.
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Rundelængde:{" "}
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                {roundTiming.matchDurationMinutes + roundTiming.breakBetweenMatchesMinutes} min
              </span>{" "}
              (kamp {roundTiming.matchDurationMinutes} min + pause {roundTiming.breakBetweenMatchesMinutes} min). I alt{" "}
              <span className="font-semibold tabular-nums">{totalRequiredMatches}</span> kampe /{" "}
              <span className="font-semibold tabular-nums">{totalRequiredRounds}</span> runder behov,{" "}
              <span className="font-semibold tabular-nums">{totalCapacity}</span> runder kapacitet (
              <span className="font-semibold tabular-nums">{totalUsed}</span> brugt).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Opdatér data
        </button>
      </div>

      {localError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {localError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
              <th className="px-3 py-2">Niveau</th>
              <th className="px-3 py-2">Spillere</th>
              <th className="px-3 py-2">Hold</th>
              <th className="px-3 py-2">Kampe/hold</th>
              <th className="px-3 py-2" title="Mål hold pr. pulje (AutoPulje). Tom = kampe/hold + 1">
                Mål/pulje
              </th>
              <th className="px-3 py-2" title="Valgfri hård grænse. Tom = kun systemloft">
                Maks/pulje
              </th>
              <th className="px-3 py-2">Bane</th>
              <th className="px-3 py-2">Kampe</th>
              <th className="px-3 py-2">Runder</th>
              <th className="px-3 py-2 w-28" />
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                  Ingen niveauer endnu — opret hold i Holddannelse for at se regnestykket.
                </td>
              </tr>
            ) : (
              demandRows.map((row) => {
                const matchesVal = matchesDrafts[row.level] ?? String(DEFAULT_PLAN_MATCHES_PER_TEAM);
                const levelInput = levels.find((l) => l.levelKey === row.level);
                const poolHintRow = levelInput
                  ? poolPlanningHint(levelInput.levelKey, [
                      {
                        level: levelInput.levelKey,
                        plan_matches_per_team: Number.parseInt(matchesVal, 10) || DEFAULT_PLAN_MATCHES_PER_TEAM,
                        plan_target_teams_per_pool: parseOptionalPoolField(poolTargetDrafts[row.level] ?? ""),
                        plan_max_teams_per_pool: parseOptionalPoolField(poolMaxDrafts[row.level] ?? ""),
                      },
                    ])
                  : null;
                return (
                  <tr key={row.level} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{row.level}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{row.playerCount}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{row.teamCount}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={matchesVal}
                        onChange={(e) => setMatchesDraft(row.level, e.target.value)}
                        className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm tabular-nums dark:border-gray-600 dark:bg-gray-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={2}
                        max={99}
                        placeholder={poolHintRow ? String(poolHintRow.recommendedTeamCount) : "auto"}
                        value={poolTargetDrafts[row.level] ?? ""}
                        onChange={(e) => setPoolTargetDraft(row.level, e.target.value)}
                        className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm tabular-nums placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={2}
                        max={99}
                        placeholder="—"
                        value={poolMaxDrafts[row.level] ?? ""}
                        onChange={(e) => setPoolMaxDraft(row.level, e.target.value)}
                        className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm tabular-nums placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{courtTypeLabel(row.courtType as CourtType)}</td>
                    <td
                      className="px-3 py-2"
                      title={
                        !row.parityOk && row.teamCount > 0
                          ? "Hold × kampe/hold er ulige — alle hold kan ikke få præcis samme antal kampe; tallet er et planlægningsskøn"
                          : undefined
                      }
                    >
                      <span className="tabular-nums text-gray-900 dark:text-white">{row.totalMatches}</span>
                      {!row.parityOk && row.teamCount > 0 ? (
                        <span className="ml-1 text-xs text-amber-700 dark:text-amber-300" aria-hidden>
                          *
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                      {row.requiredRounds}
                      {row.roundsPerMatch > 1 ? (
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({row.roundsPerMatch}×)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={savingLevel === row.level}
                        onClick={() => void saveLevel(row.level)}
                        className="rounded-md bg-[#14b8a6] px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-[#0d9488] disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
                      >
                        {savingLevel === row.level ? "Gemmer…" : "Gem"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {balanceRows.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Runder pr. banetype</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-[560px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                  <th className="px-3 py-2">Banetype</th>
                  <th className="px-3 py-2">Runder (kapacitet)</th>
                  <th className="px-3 py-2">Brugt</th>
                  <th className="px-3 py-2">Tilbage</th>
                  <th className="px-3 py-2">Krævede kampe</th>
                  <th className="px-3 py-2">Krævede runder</th>
                  <th className="px-3 py-2">Kapacitet vs. plan</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map((r) => (
                  <tr key={r.courtType} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      {courtTypeLabel(r.courtType as CourtType)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{r.capacityRounds}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{r.usedRounds}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-gray-900 dark:text-white">{r.remainingRounds}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{r.requiredMatches}</td>
                    <td className="px-3 py-2 tabular-nums font-medium text-gray-900 dark:text-white">{r.requiredRounds}</td>
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
            Kapacitet kommer fra baner, åbningstider og pauser under Haller &amp; baner. Niveau med 2 runder pr. kamp (fx ROCK)
            tæller dobbelt i krævede og brugte runder. Kapacitet vs. plan = runder tilgængelige minus krævede runder.
          </p>
        </div>
      ) : null}

      <BaneStatusPanel baner={baner} snapshot={snapshot} poolDemand={poolDemand} />
    </Wrapper>
  );
}
