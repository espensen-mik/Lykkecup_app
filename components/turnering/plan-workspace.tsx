"use client";

import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { generateRoundRobinMatches, TURNERING_EVENT_ID, type MatchRow } from "@/lib/turnering";
import { supabase } from "@/lib/supabase";
import type { TeamRow } from "@/types/teams";

type PoolRow = {
  id: string;
  event_id: string;
  level: string | null;
  name: string;
  sort_order: number;
};

type Props = {
  levelKey: string;
  initialPools: PoolRow[];
  initialTeams: TeamRow[];
  initialMatches: MatchRow[];
};

function fmtTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function estimatedMatchCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  return (teamCount * (teamCount - 1)) / 2;
}

export function TurneringPlanWorkspace({ levelKey, initialPools, initialTeams, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
  const [busyPoolIds, setBusyPoolIds] = useState<Set<string>>(new Set());
  const [confirmRegeneratePoolId, setConfirmRegeneratePoolId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const teamsByPool = useMemo(() => {
    const byPool = new Map<string, TeamRow[]>();
    for (const pool of initialPools) byPool.set(pool.id, []);
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
  }, [initialPools, initialTeams]);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of initialTeams) map.set(team.id, team.name);
    return map;
  }, [initialTeams]);

  const matchesByPool = useMemo(() => {
    const byPool = new Map<string, MatchRow[]>();
    for (const pool of initialPools) byPool.set(pool.id, []);
    for (const match of matches) {
      const list = byPool.get(match.pool_id);
      if (list) list.push(match);
    }
    return byPool;
  }, [initialPools, matches]);

  const poolsWithEnoughTeams = useMemo(
    () => initialPools.filter((p) => (teamsByPool.get(p.id)?.length ?? 0) >= 2).length,
    [initialPools, teamsByPool],
  );

  const poolsInSync = useMemo(() => {
    let synced = 0;
    for (const pool of initialPools) {
      const teams = teamsByPool.get(pool.id) ?? [];
      const teamIds = new Set(teams.map((t) => t.id));
      const expected = new Set(
        generateRoundRobinMatches(teams).map((m) => pairKey(m.teamAId, m.teamBId)),
      );
      const actualMap = new Map<string, number>();
      for (const match of matchesByPool.get(pool.id) ?? []) {
        if (!teamIds.has(match.team_a_id) || !teamIds.has(match.team_b_id) || match.team_a_id === match.team_b_id) {
          continue;
        }
        const key = pairKey(match.team_a_id, match.team_b_id);
        actualMap.set(key, (actualMap.get(key) ?? 0) + 1);
      }
      const duplicates = [...actualMap.values()].some((count) => count > 1);
      const missing = [...expected].some((key) => !actualMap.has(key));
      const unexpected = [...actualMap.keys()].some((key) => !expected.has(key));
      const noTeamsToSchedule = teams.length < 2;
      const hasMatches = (matchesByPool.get(pool.id) ?? []).length > 0;
      const isSynced = noTeamsToSchedule ? !hasMatches : !duplicates && !missing && !unexpected;
      if (isSynced) synced += 1;
    }
    return synced;
  }, [initialPools, teamsByPool, matchesByPool]);

  const estimatedTotalMatches = useMemo(
    () =>
      initialPools.reduce((sum, p) => sum + estimatedMatchCount(teamsByPool.get(p.id)?.length ?? 0), 0),
    [initialPools, teamsByPool],
  );

  async function refreshMatches() {
    const poolIds = initialPools.map((p) => p.id);
    if (poolIds.length === 0) {
      setMatches([]);
      return;
    }
    const matchesRes = await supabase
      .from("matches")
      .select("id, event_id, pool_id, team_a_id, team_b_id, court_id, start_time, end_time, status, created_at")
      .eq("event_id", TURNERING_EVENT_ID)
      .in("pool_id", poolIds)
      .order("created_at", { ascending: true });
    if (matchesRes.error) throw new Error(matchesRes.error.message);
    setMatches((matchesRes.data ?? []) as MatchRow[]);
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

    try {
      if (regenerate) {
        const delRes = await supabase.from("matches").delete().eq("event_id", TURNERING_EVENT_ID).eq("pool_id", pool.id);
        if (delRes.error) throw new Error(delRes.error.message);
      }

      const pairings = generateRoundRobinMatches(teams);
      if (pairings.length === 0) {
        setActionMsg(`${pool.name}: ingen kampe blev genereret.`);
        return;
      }

      const payload: Array<{
        event_id: string;
        pool_id: string;
        team_a_id: string;
        team_b_id: string;
        court_id: null;
        start_time: null;
        end_time: null;
        status: string;
      }> = pairings.map((match) => ({
        event_id: TURNERING_EVENT_ID,
        pool_id: pool.id,
        team_a_id: match.teamAId,
        team_b_id: match.teamBId,
        court_id: null,
        start_time: null,
        end_time: null,
        status: "scheduled",
      }));

      const insRes = await supabase.from("matches").insert(payload);
      if (insRes.error) throw new Error(insRes.error.message);

      await refreshMatches();
      setActionMsg(
        regenerate
          ? `${pool.name}: kampe regenereret (${payload.length}).`
          : `${pool.name}: kampe genereret (${payload.length}).`,
      );
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

  async function onClickGenerate(pool: PoolRow) {
    const poolMatches = matchesByPool.get(pool.id) ?? [];
    if (poolMatches.length > 0) {
      setConfirmRegeneratePoolId(pool.id);
      return;
    }
    await generateMatchesForPool(pool, false);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Puljer" value={initialPools.length} />
        <Kpi label="Hold" value={initialTeams.length} />
        <Kpi label="Genererede kampe" value={matches.length} />
        <Kpi label="Puljer i sync" value={poolsInSync} />
      </section>

      <section className="rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampgenerering</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Generering sker nu per pulje i niveauet {levelKey}. Baner og tider tilføjes i næste version.
          </p>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Puljer klar til kampe: <span className="font-semibold">{poolsWithEnoughTeams}</span> · Estimeret antal kampe:{" "}
          <span className="font-semibold">{estimatedTotalMatches}</span>
        </p>

        {actionMsg ? (
          <p className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
            {actionMsg}
          </p>
        ) : null}

      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Puljer</h2>
        {initialPools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            Ingen puljer i dette niveau endnu.
          </p>
        ) : (
          initialPools.map((pool) => {
            const teams = teamsByPool.get(pool.id) ?? [];
            const estimated = estimatedMatchCount(teams.length);
            const poolMatches = matchesByPool.get(pool.id) ?? [];
            const teamIds = new Set(teams.map((t) => t.id));
            const expectedPairs = new Set(
              generateRoundRobinMatches(teams).map((m) => pairKey(m.teamAId, m.teamBId)),
            );
            const actualPairCounts = new Map<string, number>();
            let invalidMatches = 0;
            for (const match of poolMatches) {
              if (!teamIds.has(match.team_a_id) || !teamIds.has(match.team_b_id) || match.team_a_id === match.team_b_id) {
                invalidMatches += 1;
                continue;
              }
              const key = pairKey(match.team_a_id, match.team_b_id);
              actualPairCounts.set(key, (actualPairCounts.get(key) ?? 0) + 1);
            }
            let duplicateMatches = 0;
            for (const count of actualPairCounts.values()) {
              if (count > 1) duplicateMatches += count - 1;
            }
            const missingMatches = [...expectedPairs].filter((key) => !actualPairCounts.has(key)).length;
            const unexpectedMatches = [...actualPairCounts.keys()].filter((key) => !expectedPairs.has(key)).length;
            const hasEnoughTeams = teams.length >= 2;
            const isSynced = hasEnoughTeams
              ? missingMatches === 0 && unexpectedMatches === 0 && duplicateMatches === 0 && invalidMatches === 0
              : poolMatches.length === 0;
            const hasIssues = !isSynced;
            const isBusy = busyPoolIds.has(pool.id);
            const showPoolPrompt = confirmRegeneratePoolId === pool.id;
            return (
              <article
                key={pool.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{pool.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {teams.length} hold · estimeret {estimated} kampe · genereret {poolMatches.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasIssues ? (
                      <HoverInfoPill
                        text="Der er uoverensstemmelse mellem puljens hold og de genererede kampe. Generér kampe igen!"
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

                {hasIssues ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Der er uoverensstemmelse mellem puljens hold og de genererede kampe. Generér kampe igen!
                  </p>
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
                    {teams.map((team) => (
                      <li key={team.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                        <span className="font-medium text-gray-900 dark:text-white">{team.name}</span>
                      </li>
                    ))}
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
          initialPools.map((pool) => {
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
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Oprettet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolMatches.map((match) => (
                        <tr key={match.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                          <td className="px-2 py-2 text-gray-900 dark:text-white">
                            {teamNameById.get(match.team_a_id) ?? "Ukendt hold"}
                          </td>
                          <td className="px-2 py-2 text-gray-900 dark:text-white">
                            {teamNameById.get(match.team_b_id) ?? "Ukendt hold"}
                          </td>
                          <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{match.status}</td>
                          <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{fmtTimestamp(match.created_at)}</td>
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
    </div>
  );
}

function pairKey(teamAId: string, teamBId: string): string {
  return teamAId < teamBId ? `${teamAId}::${teamBId}` : `${teamBId}::${teamAId}`;
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
