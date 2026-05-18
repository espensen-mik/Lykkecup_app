"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { ManualScheduleDialog } from "@/components/turnering/manual-schedule-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TeamDetailModal, TeamNameWithHover, TeamRowWithPlayers } from "@/components/teams/team-detail-ui";
import { StyledSelect } from "@/components/ui/styled-select";
import { formatTimeForInput, timeInputToTimestamptz } from "@/lib/baner-tider";
import { buildTeamDetailsById, type TeamDetailView, type TeamPlayerLite } from "@/lib/team-detail";
import { levelPathSegment } from "@/lib/holddannelse";
import {
  generateAllPoolMatchesForLevelAction,
  generatePoolMatchesAction,
  renumberPoolNamesForLevelAction,
  schedulePoolMatchesAction,
  updateMatchScheduleAction,
} from "@/lib/turnering-actions";
import { poolPlanningHint, poolTeamCountStatus } from "@/lib/puljer";
import {
  analyzePoolMatchSync,
  MATCH_RELAXED_TEAM_REST_NOTICE,
  MATCH_UNSCHEDULED_NOTICE,
  plannedPoolMatchCount,
  type MatchRow,
} from "@/lib/turnering";
import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

type PoolRow = {
  id: string;
  event_id: string;
  level: string | null;
  name: string;
  sort_order: number;
  period_id: string | null;
};

type CourtOption = { id: string; name: string };
type PeriodOption = { id: string; name: string };

type Props = {
  levelKey: string;
  planMatchesPerTeam: number;
  initialPools: PoolRow[];
  initialTeams: TeamRow[];
  initialMembers: TeamMemberRow[];
  initialPlayers: TeamPlayerLite[];
  initialCoaches: HoldCoachRow[];
  initialTeamCoaches: TeamCoachRow[];
  initialMatches: MatchRow[];
  courts: CourtOption[];
  periods: PeriodOption[];
};

function fmtTime(ts: string | null): string {
  const t = formatTimeForInput(ts);
  return t || "—";
}

export function TurneringPlanWorkspace({
  levelKey,
  planMatchesPerTeam,
  initialPools,
  initialTeams,
  initialMembers,
  initialPlayers,
  initialCoaches,
  initialTeamCoaches,
  initialMatches,
  courts,
  periods,
}: Props) {
  const router = useRouter();
  const [pools, setPools] = useState(initialPools);
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const [busyPoolIds, setBusyPoolIds] = useState<Set<string>>(new Set());
  const [confirmRegeneratePoolId, setConfirmRegeneratePoolId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [schedulingFailures, setSchedulingFailures] = useState<
    Array<{ matchId: string; label: string; reason: string }>
  >([]);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchRow | null>(null);
  const [editCourtId, setEditCourtId] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [manualScheduleMatch, setManualScheduleMatch] = useState<MatchRow | null>(null);

  useEffect(() => {
    setPools(initialPools);
  }, [initialPools]);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const courtNameById = useMemo(() => new Map(courts.map((c) => [c.id, c.name])), [courts]);
  const periodNameById = useMemo(() => new Map(periods.map((p) => [p.id, p.name])), [periods]);
  const failureReasonByMatchId = useMemo(
    () => new Map(schedulingFailures.map((f) => [f.matchId, f.reason])),
    [schedulingFailures],
  );
  const unscheduledMatchCount = useMemo(
    () => matches.filter((m) => !m.court_id || !m.start_time).length,
    [matches],
  );

  const teamsByPool = useMemo(() => {
    const byPool = new Map<string, TeamRow[]>();
    for (const pool of pools) byPool.set(pool.id, []);
    for (const team of initialTeams) {
      if (!team.pool_id) continue;
      const list = byPool.get(team.pool_id);
      if (!list) continue;
      list.push(team);
    }
    for (const [poolId, list] of byPool.entries()) {
      byPool.set(
        poolId,
        [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da")),
      );
    }
    return byPool;
  }, [pools, initialTeams]);

  const teamDetailsById = useMemo(
    () =>
      buildTeamDetailsById(
        initialTeams,
        initialMembers,
        initialPlayers,
        initialTeamCoaches,
        initialCoaches,
      ),
    [initialTeams, initialMembers, initialPlayers, initialTeamCoaches, initialCoaches],
  );

  const previewDetail = useMemo(() => {
    if (!previewTeamId) return null;
    const detail = teamDetailsById.get(previewTeamId);
    if (!detail) return null;
    const playerCount = initialMembers.filter((m) => m.team_id === previewTeamId).length;
    return { ...detail, playerCount };
  }, [previewTeamId, teamDetailsById, initialMembers]);

  const teamDetailOrFallback = useCallback(
    (teamId: string): TeamDetailView => {
      const team = initialTeams.find((t) => t.id === teamId);
      return (
        teamDetailsById.get(teamId) ?? {
          teamName: team?.name ?? "Ukendt hold",
          nickname: null,
          players: [],
          coaches: [],
        }
      );
    },
    [initialTeams, teamDetailsById],
  );

  const matchesByPool = useMemo(() => {
    const byPool = new Map<string, MatchRow[]>();
    for (const pool of pools) byPool.set(pool.id, []);
    for (const match of matches) {
      const list = byPool.get(match.pool_id);
      if (list) list.push(match);
    }
    return byPool;
  }, [pools, matches]);

  const poolsWithEnoughTeams = useMemo(
    () => pools.filter((p) => (teamsByPool.get(p.id)?.length ?? 0) >= 2).length,
    [pools, teamsByPool],
  );

  const poolHint = useMemo(
    () => poolPlanningHint(levelKey, [{ level: levelKey, plan_matches_per_team: planMatchesPerTeam }]),
    [levelKey, planMatchesPerTeam],
  );

  const poolsInSync = useMemo(() => {
    let synced = 0;
    for (const pool of pools) {
      const teams = teamsByPool.get(pool.id) ?? [];
      const analysis = analyzePoolMatchSync(teams, matchesByPool.get(pool.id) ?? [], planMatchesPerTeam);
      if (analysis.isSynced) synced += 1;
    }
    return synced;
  }, [pools, teamsByPool, matchesByPool, planMatchesPerTeam]);

  const estimatedTotalMatches = useMemo(
    () =>
      pools.reduce(
        (sum, p) => sum + plannedPoolMatchCount(teamsByPool.get(p.id)?.length ?? 0, planMatchesPerTeam),
        0,
      ),
    [pools, teamsByPool, planMatchesPerTeam],
  );

  const hasDuplicatePoolNames = useMemo(() => {
    const seen = new Set<string>();
    for (const p of pools) {
      if (seen.has(p.name)) return true;
      seen.add(p.name);
    }
    return false;
  }, [pools]);

  const [renumberingPools, setRenumberingPools] = useState(false);
  const [generatingAllPools, setGeneratingAllPools] = useState(false);
  const [confirmRegenerateAllPools, setConfirmRegenerateAllPools] = useState(false);

  async function fixDuplicatePoolNames() {
    setRenumberingPools(true);
    setActionMsg(null);
    try {
      const result = await renumberPoolNamesForLevelAction(levelKey);
      setActionMsg(result.message);
      if (result.ok) router.refresh();
    } finally {
      setRenumberingPools(false);
    }
  }

  async function generateMatchesForPool(pool: PoolRow, regenerate: boolean) {
    const teams = teamsByPool.get(pool.id) ?? [];
    if (teams.length < 2) {
      setActionMsg(`${pool.name}: mindst 2 hold kræves for at generere kampe.`);
      return;
    }

    setBusyPoolIds((prev) => {
      const next = new Set(prev);
      next.add(pool.id);
      return next;
    });
    setActionMsg(null);
    setConfirmRegeneratePoolId(null);

    setSchedulingFailures([]);
    try {
      const result = await generatePoolMatchesAction(pool.id, levelKey, regenerate);
      setActionMsg(result.message);
      setSchedulingFailures(result.schedulingFailures ?? []);
      if (result.ok || (result.scheduled ?? 0) > 0) router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      setActionMsg(`Kunne ikke generere kampe: ${message}`);
    } finally {
      setBusyPoolIds((prev) => {
        const next = new Set(prev);
        next.delete(pool.id);
        return next;
      });
    }
  }

  async function scheduleUnscheduledForPool(pool: PoolRow) {
    setBusyPoolIds((prev) => {
      const next = new Set(prev);
      next.add(pool.id);
      return next;
    });
    setActionMsg(null);
    setSchedulingFailures([]);
    try {
      const result = await schedulePoolMatchesAction(pool.id, levelKey);
      setActionMsg(result.message);
      setSchedulingFailures(result.schedulingFailures ?? []);
      if (result.ok || (result.scheduled ?? 0) > 0) router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      setActionMsg(`Kunne ikke planlægge kampe: ${message}`);
    } finally {
      setBusyPoolIds((prev) => {
        const next = new Set(prev);
        next.delete(pool.id);
        return next;
      });
    }
  }

  async function onClickGenerate(pool: PoolRow) {
    const poolMatches = matchesByPool.get(pool.id) ?? [];
    if (poolMatches.length > 0) {
      setConfirmRegeneratePoolId(pool.id);
      return;
    }
    await generateMatchesForPool(pool, false);
  }

  async function generateAllPoolsForLevel(regenerate: boolean) {
    if (pools.length === 0) {
      setActionMsg(`${levelKey}: ingen puljer — opret puljer under Puljer.`);
      return;
    }

    setGeneratingAllPools(true);
    setConfirmRegenerateAllPools(false);
    setActionMsg(null);
    setSchedulingFailures([]);

    try {
      const result = await generateAllPoolMatchesForLevelAction(levelKey, regenerate);
      setActionMsg(result.message);
      setSchedulingFailures(result.schedulingFailures ?? []);
      if (result.ok || (result.scheduled ?? 0) > 0) router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      setActionMsg(`Kunne ikke generere kampe for alle puljer: ${message}`);
    } finally {
      setGeneratingAllPools(false);
    }
  }

  function onClickGenerateAllPools() {
    if (matches.length > 0) {
      setConfirmRegenerateAllPools(true);
      return;
    }
    void generateAllPoolsForLevel(false);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Puljer" value={pools.length} />
        <Kpi label="Hold" value={initialTeams.length} />
        <Kpi label="Genererede kampe" value={matches.length} />
        <Kpi label="Puljer i sync" value={poolsInSync} />
      </section>

      <section className="rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampgenerering</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Puljer oprettes og redigeres under{" "}
            <Link href={`/turnering/puljer/${levelPathSegment(levelKey)}`} className="font-medium text-[#0d9488] hover:underline dark:text-teal-400">
              Puljer
            </Link>
            . Her genererer du kampe per pulje — med automatisk bane og tid (Opsætning → Perioder). Hold over musen for
            spillere og trænere.
          </p>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Puljer klar til kampe: <span className="font-semibold">{poolsWithEnoughTeams}</span> · Estimeret antal kampe:{" "}
          <span className="font-semibold">{estimatedTotalMatches}</span>
        </p>

        {pools.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {confirmRegenerateAllPools ? (
              <>
                <p className="w-full text-sm text-amber-800 dark:text-amber-200">
                  Erstat alle eksisterende kampe på {levelKey} med nye kampe og tider?
                </p>
                <button
                  type="button"
                  disabled={generatingAllPools}
                  onClick={() => void generateAllPoolsForLevel(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {generatingAllPools ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  Ja, regenerer alle puljer
                </button>
                <button
                  type="button"
                  disabled={generatingAllPools}
                  onClick={() => setConfirmRegenerateAllPools(false)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                >
                  Annuller
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={generatingAllPools || poolsWithEnoughTeams === 0}
                onClick={() => onClickGenerateAllPools()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
                title={
                  poolsWithEnoughTeams === 0
                    ? "Mindst én pulje med 2 hold kræves"
                    : matches.length > 0
                      ? "Sletter og opretter kampe for alle puljer på ny"
                      : "Opretter kampe for alle puljer med bane og tid"
                }
              >
                {generatingAllPools ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
                {matches.length > 0 ? "Regenerer kampe for alle puljer" : "Generer kampe for alle puljer"}
              </button>
            )}
          </div>
        ) : null}

        {actionMsg || schedulingFailures.length > 0 ? (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
            {actionMsg ? <p>{actionMsg}</p> : null}
            {schedulingFailures.length > 0 ? (
              <div className={actionMsg ? "mt-2 border-t border-gray-200 pt-2 dark:border-gray-600" : ""}>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Hvorfor mangler bane/tid?</p>
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs">
                  {schedulingFailures.slice(0, 20).map((row) => (
                    <li key={row.matchId}>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{row.label}</span>
                      <span className="text-amber-800 dark:text-amber-300"> — {row.reason}</span>
                    </li>
                  ))}
                  {schedulingFailures.length > 20 ? (
                    <li className="text-gray-500 dark:text-gray-400">
                      … og {schedulingFailures.length - 20} kampe mere
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {unscheduledMatchCount > 0 && schedulingFailures.length === 0 ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            {unscheduledMatchCount} kamp(e) mangler bane/tid. Brug «Planlæg manglende» på puljen eller «Generer kampe for alle
            puljer» igen — derefter vises årsag pr. kamp her.
          </p>
        ) : null}

        {hasDuplicatePoolNames ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
            <p>
              Flere puljer har samme navn (fx to «Pulje 2») — det skete ofte ved AutoPulje før en rettelse. De er{" "}
              <strong>to separate puljer</strong> i databasen med forskellige hold.
            </p>
            <button
              type="button"
              disabled={renumberingPools}
              onClick={() => void fixDuplicatePoolNames()}
              className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
            >
              {renumberingPools ? "Omdøber…" : "Omdøb til Pulje 1, 2, 3 …"}
            </button>
          </div>
        ) : null}

      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Puljer</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/turnering/puljer/${levelPathSegment(levelKey)}`}
              className="text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
            >
              Rediger puljer →
            </Link>
          </div>
        </div>
        {pools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            Ingen puljer i dette niveau.{" "}
            <Link href={`/turnering/puljer/${levelPathSegment(levelKey)}`} className="font-medium text-[#0d9488] hover:underline dark:text-teal-400">
              Opret og fordel puljer under Puljer
            </Link>{" "}
            før du genererer kampe.
          </p>
        ) : (
          pools.map((pool) => {
            const teams = teamsByPool.get(pool.id) ?? [];
            const estimated = plannedPoolMatchCount(teams.length, planMatchesPerTeam);
            const poolMatches = matchesByPool.get(pool.id) ?? [];
            const unscheduledCount = poolMatches.filter((m) => !m.court_id || !m.start_time).length;
            const sync = analyzePoolMatchSync(teams, poolMatches, planMatchesPerTeam);
            const teamCountStatus = poolTeamCountStatus(teams.length, poolHint);
            const hasEnoughTeams = teams.length >= 2;
            const isSynced = sync.isSynced;
            const hasIssues = !isSynced;
            const mismatchMessage = sync.message;
            const isBusy = busyPoolIds.has(pool.id);
            const showPoolPrompt = confirmRegeneratePoolId === pool.id;
            return (
              <article
                key={pool.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {pool.name}
                      {pools.filter((p) => p.name === pool.name).length > 1 ? (
                        <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                          (dublet-navn)
                        </span>
                      ) : null}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {teams.length} hold
                      {teamCountStatus === "high" ? (
                        <span className="text-amber-700 dark:text-amber-300">
                          {" "}
                          (anbefalet max {poolHint.recommendedTeamCount} for {planMatchesPerTeam} kampe/hold)
                        </span>
                      ) : null}{" "}
                      · estimeret {estimated} kampe · genereret {poolMatches.length}
                      {pool.period_id ? (
                        <> · {periodNameById.get(pool.period_id) ?? "Periode"}</>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300"> · ingen periode</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasIssues ? (
                      <HoverInfoPill
                        text={mismatchMessage ?? "Der er uoverensstemmelse mellem puljens hold og de genererede kampe. Generér kampe igen!"}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                        Uoverensstemmelse
                      </HoverInfoPill>
                    ) : (
                      <HoverInfoPill
                        text="Synkroniseret: de genererede kampe matcher puljens nuværende hold (ingen manglende, ekstra, dubletter eller ugyldige kampe)."
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Synkroniseret
                      </HoverInfoPill>
                    )}
                    {unscheduledCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void scheduleUnscheduledForPool(pool)}
                        disabled={isBusy || !pool.period_id}
                        title={!pool.period_id ? "Tildel periode under Opsætning → Perioder" : undefined}
                        className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-900 transition-colors hover:bg-violet-100 disabled:opacity-60 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-200 dark:hover:bg-violet-950/50"
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Planlæg {unscheduledCount} manglende
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void onClickGenerate(pool)}
                      disabled={isBusy || teams.length < 2}
                      className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-60 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50"
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                      {isBusy ? "Genererer..." : "Generer kampe"}
                    </button>
                  </div>
                </div>

                {hasIssues && mismatchMessage ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{mismatchMessage}</p>
                ) : null}

                {showPoolPrompt ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-900 dark:text-amber-100">
                      {pool.name} har allerede kampe. Vil du slette dem og regenerere kun denne pulje?
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmRegeneratePoolId(null)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Annuller
                      </button>
                      <button
                        type="button"
                        onClick={() => void generateMatchesForPool(pool, true)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Slet og regenerer pulje
                      </button>
                    </div>
                  </div>
                ) : null}

                {teams.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Ingen hold i puljen endnu.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {teams.map((team) => {
                      const detail = teamDetailOrFallback(team.id);
                      return (
                        <li key={team.id}>
                          <TeamRowWithPlayers
                            detail={detail}
                            onShowDetail={() => setPreviewTeamId(team.id)}
                          >
                            <div className="px-3 py-2 text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{team.name}</p>
                            </div>
                          </TeamRowWithPlayers>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Genererede kampe</h2>
        {matches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            Ingen kampe er genereret endnu.
          </p>
        ) : (
          pools.map((pool) => {
            const poolMatches = matchesByPool.get(pool.id) ?? [];
            if (poolMatches.length === 0) return null;
            return (
              <article
                key={pool.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{pool.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{poolMatches.length} kampe</p>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        <th className="px-2 py-2 font-medium">Hold A</th>
                        <th className="px-2 py-2 font-medium">Hold B</th>
                        <th className="px-2 py-2 font-medium">Tid</th>
                        <th className="px-2 py-2 font-medium">Bane</th>
                        <th className="px-2 py-2 font-medium">Note</th>
                        <th className="px-2 py-2 font-medium w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {poolMatches.map((match) => (
                        <tr key={match.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                          <td className="px-2 py-2 text-gray-900 dark:text-white">
                            <TeamNameWithHover
                              detail={teamDetailOrFallback(match.team_a_id)}
                              onOpenDetail={() => setPreviewTeamId(match.team_a_id)}
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-900 dark:text-white">
                            <TeamNameWithHover
                              detail={teamDetailOrFallback(match.team_b_id)}
                              onOpenDetail={() => setPreviewTeamId(match.team_b_id)}
                            />
                          </td>
                          <td className="px-2 py-2 tabular-nums text-gray-600 dark:text-gray-300">
                            {match.start_time ? `${fmtTime(match.start_time)}–${fmtTime(match.end_time)}` : "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-600 dark:text-gray-300">
                            {match.court_id ? courtNameById.get(match.court_id) ?? "Bane" : "—"}
                          </td>
                          <td className="px-2 py-2">
                            {failureReasonByMatchId.get(match.id) ? (
                              <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                {failureReasonByMatchId.get(match.id)}
                              </span>
                            ) : match.schedule_relaxed_team_rest ? (
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                {MATCH_RELAXED_TEAM_REST_NOTICE}
                              </span>
                            ) : !match.court_id || !match.start_time ? (
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                {MATCH_UNSCHEDULED_NOTICE}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              {!match.court_id || !match.start_time ? (
                                <button
                                  type="button"
                                  onClick={() => setManualScheduleMatch(match)}
                                  className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50/80 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
                                >
                                  <CalendarClock className="h-3 w-3" aria-hidden />
                                  Planlæg manuelt
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMatch(match);
                                  setEditCourtId(match.court_id ?? "");
                                  setEditStart(formatTimeForInput(match.start_time));
                                  setEditEnd(formatTimeForInput(match.end_time));
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <Pencil className="h-3 w-3" aria-hidden />
                                {match.court_id && match.start_time ? "Flyt" : "Angiv tid"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })
        )}
      </section>

      <TeamDetailModal
        open={Boolean(previewDetail)}
        onClose={() => setPreviewTeamId(null)}
        detail={previewDetail ?? { teamName: "", nickname: null, players: [], coaches: [] }}
        playerCount={previewDetail?.playerCount ?? 0}
      />

      {editingMatch ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Luk"
            onClick={() => setEditingMatch(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-lc-border bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Flyt kamp</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {teamDetailOrFallback(editingMatch.team_a_id).teamName} vs{" "}
              {teamDetailOrFallback(editingMatch.team_b_id).teamName}
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  setSavingMatch(true);
                  try {
                    const start_time = timeInputToTimestamptz(editStart);
                    const end_time = timeInputToTimestamptz(editEnd);
                    if (!start_time || !end_time) throw new Error("Angiv gyldige tider.");
                    const result = await updateMatchScheduleAction(
                      editingMatch.id,
                      levelKey,
                      editCourtId || null,
                      start_time,
                      end_time,
                    );
                    if (!result.ok) throw new Error(result.message);
                    router.refresh();
                    setEditingMatch(null);
                    setActionMsg(result.message);
                  } catch (err) {
                    setActionMsg(err instanceof Error ? err.message : "Kunne ikke gemme.");
                  } finally {
                    setSavingMatch(false);
                  }
                })();
              }}
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Bane</label>
                <StyledSelect
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={editCourtId}
                  onChange={(e) => setEditCourtId(e.target.value)}
                >
                  <option value="">Ingen bane</option>
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Start</label>
                  <input
                    type="time"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Slut</label>
                  <input
                    type="time"
                    required
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium dark:border-gray-600"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={savingMatch}
                  className="rounded-lg bg-[#14b8a6] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingMatch ? "Gemmer…" : "Gem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {manualScheduleMatch ? (
        <ManualScheduleDialog
          open
          onClose={() => setManualScheduleMatch(null)}
          matchId={manualScheduleMatch.id}
          levelKey={levelKey}
          teamALabel={teamDetailOrFallback(manualScheduleMatch.team_a_id).teamName}
          teamBLabel={teamDetailOrFallback(manualScheduleMatch.team_b_id).teamName}
          onSuccess={(msg) => setActionMsg(msg)}
        />
      ) : null}
    </div>
  );
}

function HoverInfoPill({
  text,
  className,
  children,
}: {
  text: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} className={className} aria-label={text}>
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-max max-w-[22rem] -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-normal text-gray-700 opacity-0 shadow-sm transition-opacity duration-75 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {text}
      </span>
    </span>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">{value}</p>
    </div>
  );
}
