"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TeamDetailModal, TeamRowWithPlayers } from "@/components/teams/team-detail-ui";
import { buildTeamDetailsById, type TeamDetailView } from "@/lib/team-detail";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Plus, Search, Sparkles, Users, X } from "lucide-react";
import {
  effectivePoolMaxTeams,
  formatPoolSizePlanLabel,
  poolTeamCountStatus,
  type PoolPlanningHint,
} from "@/lib/puljer";
import {
  autoAssignPoolsAction,
  createPoolAction,
  releaseOrphanedPoolTeamsAction,
} from "@/lib/turnering-actions";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

type PoolRow = {
  id: string;
  event_id: string;
  level: string | null;
  name: string;
  sort_order: number;
  is_closed: boolean;
  period_id?: string | null;
};

type PlayerLite = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
};

type TeamSummary = {
  team: TeamRow;
  playerCount: number;
  avgAge: number | null;
  clubCount: number;
};

export type { TeamDetailView } from "@/lib/team-detail";

type Props = {
  levelKey: string;
  initialTeams: TeamRow[];
  initialPools: PoolRow[];
  initialMembers: TeamMemberRow[];
  initialPlayers: PlayerLite[];
  initialCoaches: HoldCoachRow[];
  initialTeamCoaches: TeamCoachRow[];
  poolHint: PoolPlanningHint;
  /** False when DB migration for pool size columns is missing. */
  poolColumnsAvailable?: boolean;
};

function fmtAge(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function poolIsClosed(p: PoolRow): boolean {
  return Boolean(p.is_closed);
}

function sortPoolsForDisplay(rows: PoolRow[]): PoolRow[] {
  const open = rows.filter((p) => !poolIsClosed(p));
  const closed = rows.filter((p) => poolIsClosed(p));
  const cmp = (a: PoolRow, b: PoolRow) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da");
  return [...open].sort(cmp).concat([...closed].sort(cmp));
}

function teamStats(
  teamId: string,
  membersByTeam: Map<string, TeamMemberRow[]>,
  playerById: Map<string, PlayerLite>,
): { playerCount: number; avgAge: number | null; clubCount: number } {
  const tMembers = membersByTeam.get(teamId) ?? [];
  let ageSum = 0;
  let ageCount = 0;
  const clubs = new Set<string>();
  for (const m of tMembers) {
    const p = playerById.get(m.player_id);
    if (!p) continue;
    if (typeof p.age === "number" && !Number.isNaN(p.age)) {
      ageSum += p.age;
      ageCount += 1;
    }
    const club = p.home_club?.trim();
    if (club) clubs.add(club);
  }
  return {
    playerCount: tMembers.length,
    avgAge: ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : null,
    clubCount: clubs.size,
  };
}

function PoolCapacityHint({ teamCount, hint }: { teamCount: number; hint: PoolPlanningHint }) {
  const status = poolTeamCountStatus(teamCount, hint);
  const cap = effectivePoolMaxTeams(hint);
  const planLabel = formatPoolSizePlanLabel(hint);
  const matchesPerTeam = hint.matchesPerTeam;
  const labels: Record<typeof status, string> = {
    empty: "Tom pulje",
    too_few: "Tilføj flere hold",
    good: "Passer til plan",
    high: "Over mål",
    full: hint.maxTeamsPerPool != null ? `Fuld (${hint.maxTeamsPerPool})` : `Fuld (${cap})`,
  };
  const colors: Record<typeof status, string> = {
    empty: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    too_few: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    high: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    full: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  };

  return (
    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
      <p className="text-[0.6875rem] text-gray-500 dark:text-gray-500">{planLabel} · min. 2 hold</p>
      <p>
        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${colors[status]}`}>{labels[status]}</span>
        <span className="ml-2 tabular-nums">
          {teamCount} hold i puljen
          {hint.maxTeamsPerPool != null ? ` (maks ${hint.maxTeamsPerPool})` : null}
        </span>
      </p>
      {teamCount >= 2 ? (
        <p>
          Fra Opsætning → Kampe: hvert hold spiller{" "}
          <strong className="font-semibold tabular-nums">{matchesPerTeam}</strong> kampe i puljen (uafhængigt af
          puljens størrelse).
        </p>
      ) : null}
    </div>
  );
}

export function PoolAssignmentWorkspace({
  levelKey,
  initialTeams,
  initialPools,
  initialMembers,
  initialPlayers,
  initialCoaches,
  initialTeamCoaches,
  poolHint,
  poolColumnsAvailable = true,
}: Props) {
  const router = useRouter();
  const supabase = getAuthBrowserClient();
  const hint = poolHint;

  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [pools, setPools] = useState<PoolRow[]>(() => sortPoolsForDisplay(initialPools));
  const [members] = useState<TeamMemberRow[]>(initialMembers);
  const [activePoolId, setActivePoolId] = useState<string | null>(
    () => initialPools.find((p) => !poolIsClosed(p))?.id ?? initialPools[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyTeamIds, setBusyTeamIds] = useState<Set<string>>(new Set());
  const [creatingPool, setCreatingPool] = useState(false);
  const [autoPoolBusy, setAutoPoolBusy] = useState(false);
  const [releasingOrphans, setReleasingOrphans] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [collapsedPoolIds, setCollapsedPoolIds] = useState<Set<string>>(() => new Set());
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);

  useEffect(() => {
    setPools(sortPoolsForDisplay(initialPools));
  }, [initialPools]);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const playerById = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    for (const p of initialPlayers) m.set(p.id, p);
    return m;
  }, [initialPlayers]);

  const membersByTeam = useMemo(() => {
    const m = new Map<string, TeamMemberRow[]>();
    for (const member of members) {
      const list = m.get(member.team_id) ?? [];
      list.push(member);
      m.set(member.team_id, list);
    }
    return m;
  }, [members]);

  const teamDetailsById = useMemo(
    () =>
      buildTeamDetailsById(teams, members, initialPlayers, initialTeamCoaches, initialCoaches),
    [teams, members, initialPlayers, initialTeamCoaches, initialCoaches],
  );

  const previewDetail = useMemo(() => {
    if (!previewTeamId) return null;
    const team = teams.find((t) => t.id === previewTeamId);
    if (!team) return null;
    const detail = teamDetailsById.get(team.id);
    if (!detail) return null;
    const stats = teamStats(team.id, membersByTeam, playerById);
    return { ...detail, ...stats };
  }, [previewTeamId, teams, teamDetailsById, membersByTeam, playerById]);

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    return teams.map((team) => {
      const stats = teamStats(team.id, membersByTeam, playerById);
      return { team, ...stats };
    });
  }, [teams, membersByTeam, playerById]);

  const poolById = useMemo(() => new Map(pools.map((p) => [p.id, p])), [pools]);

  const orphanedTeams = useMemo(
    () => teams.filter((t) => t.pool_id && !poolById.has(t.pool_id)),
    [teams, poolById],
  );

  const activePool = activePoolId ? poolById.get(activePoolId) : null;
  const activePoolClosed = activePool ? poolIsClosed(activePool) : false;

  const unassignedTeams = useMemo(
    () => teamSummaries.filter((s) => !s.team.pool_id),
    [teamSummaries],
  );

  const kpi = useMemo(() => {
    const assignedInPools = teams.filter((t) => t.pool_id && poolById.has(t.pool_id)).length;
    return {
      totalTeams: teams.length,
      assignedTeams: assignedInPools,
      orphanedAssignments: orphanedTeams.length,
      unassignedTeams: teams.length - assignedInPools - orphanedTeams.length,
      poolCount: pools.length,
      openPools: pools.filter((p) => !poolIsClosed(p)).length,
    };
  }, [teams, pools, poolById, orphanedTeams.length]);

  const releaseOrphanedTeams = useCallback(async () => {
    if (orphanedTeams.length === 0) return;
    const ok = window.confirm(
      `${orphanedTeams.length} hold peger på en pulje der ikke findes. Frigør dem så de kan fordeles igen?`,
    );
    if (!ok) return;
    setReleasingOrphans(true);
    setActionError(null);
    const result = await releaseOrphanedPoolTeamsAction(levelKey);
    setReleasingOrphans(false);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    const orphanIds = new Set(orphanedTeams.map((t) => t.id));
    setTeams((prev) => prev.map((t) => (orphanIds.has(t.id) ? { ...t, pool_id: null } : t)));
    setActionMsg(result.message);
    router.refresh();
  }, [levelKey, orphanedTeams, router]);

  const filteredUnassigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = unassignedTeams;
    if (onlyUnassigned) rows = rows.filter((s) => !s.team.pool_id);
    if (q) rows = rows.filter((s) => s.team.name.toLowerCase().includes(q));
    return [...rows].sort((a, b) => a.team.name.localeCompare(b.team.name, "da", { sensitivity: "base" }));
  }, [unassignedTeams, search, onlyUnassigned]);

  const poolRows = useMemo(() => {
    const byId = new Map<string, TeamSummary[]>();
    for (const p of pools) byId.set(p.id, []);
    for (const s of teamSummaries) {
      if (!s.team.pool_id) continue;
      byId.get(s.team.pool_id)?.push(s);
    }
    for (const list of byId.values()) {
      list.sort((a, b) => a.team.sort_order - b.team.sort_order || a.team.name.localeCompare(b.team.name, "da"));
    }
    return pools.map((pool) => ({
      pool,
      teamsInPool: byId.get(pool.id) ?? [],
    }));
  }, [pools, teamSummaries]);

  const openPools = useMemo(() => pools.filter((p) => !poolIsClosed(p)), [pools]);
  const closedPools = useMemo(() => pools.filter((p) => poolIsClosed(p)), [pools]);

  type PoolListItem = { kind: "pool"; pool: PoolRow; teamsInPool: TeamSummary[] } | { kind: "header" };

  const poolListItems = useMemo((): PoolListItem[] => {
    const items: PoolListItem[] = [];
    for (const row of poolRows.filter((r) => !poolIsClosed(r.pool))) {
      items.push({ kind: "pool", pool: row.pool, teamsInPool: row.teamsInPool });
    }
    if (closedPools.length > 0) {
      items.push({ kind: "header" });
      for (const row of poolRows.filter((r) => poolIsClosed(r.pool))) {
        items.push({ kind: "pool", pool: row.pool, teamsInPool: row.teamsInPool });
      }
    }
    return items;
  }, [poolRows, closedPools.length]);

  const updateTeamPool = useCallback(async (teamId: string, nextPoolId: string | null) => {
    if (nextPoolId) {
      const pool = poolById.get(nextPoolId);
      if (pool && poolIsClosed(pool)) {
        setActionError("Puljen er lukket — åbn den igen for at tilføje hold.");
        return;
      }
      const countInPool = teams.filter((t) => t.pool_id === nextPoolId).length;
      const cap = effectivePoolMaxTeams(hint);
      if (countInPool >= cap) {
        setActionError(
          hint.maxTeamsPerPool != null
            ? `Puljen har allerede ${hint.maxTeamsPerPool} hold (maksimum for niveauet).`
            : `Puljen har allerede ${cap} hold (systemloft).`,
        );
        return;
      }
    }

    setBusyTeamIds((prev) => new Set(prev).add(teamId));
    setActionError(null);
    const { error } = await supabase.from("teams").update({ pool_id: nextPoolId }).eq("id", teamId);
    setBusyTeamIds((prev) => {
      const n = new Set(prev);
      n.delete(teamId);
      return n;
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, pool_id: nextPoolId } : t)));
  }, [hint, poolById, teams]);

  const addTeamToActivePool = useCallback(
    (teamId: string) => {
      if (!activePoolId || activePoolClosed) return;
      void updateTeamPool(teamId, activePoolId);
    },
    [activePoolId, activePoolClosed, updateTeamPool],
  );

  const createPool = useCallback(async () => {
    setCreatingPool(true);
    setActionError(null);
    const result = await createPoolAction(levelKey);
    setCreatingPool(false);
    if (!result.ok || !result.pool) {
      setActionError(result.message);
      return;
    }
    const row: PoolRow = {
      id: result.pool.id,
      event_id: result.pool.event_id,
      level: result.pool.level,
      name: result.pool.name,
      sort_order: result.pool.sort_order,
      is_closed: result.pool.is_closed ?? false,
      period_id: result.pool.period_id,
    };
    setPools((prev) => sortPoolsForDisplay([...prev, row]));
    setActivePoolId(row.id);
  }, [levelKey]);

  const togglePoolClosed = useCallback(async (pool: PoolRow) => {
    setActionError(null);
    const next = !poolIsClosed(pool);
    setBusy(true);
    const { error } = await supabase.from("pools").update({ is_closed: next }).eq("id", pool.id);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setPools((prev) =>
      sortPoolsForDisplay(prev.map((p) => (p.id === pool.id ? { ...p, is_closed: next } : p))),
    );
    if (next) {
      setCollapsedPoolIds((prev) => new Set(prev).add(pool.id));
    } else {
      setCollapsedPoolIds((prev) => {
        const s = new Set(prev);
        s.delete(pool.id);
        return s;
      });
    }
  }, []);

  const deletePool = useCallback(
    async (pool: PoolRow, teamCount: number) => {
      const ok = window.confirm(
        teamCount > 0
          ? `${pool.name}: ${teamCount} hold flyttes til listen til venstre. Slet puljen?`
          : `Slet ${pool.name}?`,
      );
      if (!ok) return;
      setBusy(true);
      setActionError(null);
      if (teamCount > 0) {
        const clearRes = await supabase
          .from("teams")
          .update({ pool_id: null })
          .eq("pool_id", pool.id);
        if (clearRes.error) {
          setBusy(false);
          setActionError(clearRes.error.message);
          return;
        }
        setTeams((prev) => prev.map((t) => (t.pool_id === pool.id ? { ...t, pool_id: null } : t)));
      }
      const delRes = await supabase.from("pools").delete().eq("id", pool.id);
      setBusy(false);
      if (delRes.error) {
        setActionError(delRes.error.message);
        return;
      }
      setPools((prev) => prev.filter((p) => p.id !== pool.id));
      if (activePoolId === pool.id) {
        setActivePoolId(openPools.find((p) => p.id !== pool.id)?.id ?? null);
      }
    },
    [activePoolId, openPools],
  );

  const runAutoPool = useCallback(async () => {
    const targetPerPool = hint.recommendedTeamCount;
    if (unassignedTeams.length === 0) {
      setActionError("Ingen hold uden pulje at fordele.");
      return;
    }
    if (
      !window.confirm(
        `AutoPulje fordeler hold uden pulje på åbne puljer (op til ${targetPerPool} hold pr. pulje fra Opsætning → Kampe). Nye puljer oprettes ved behov. Fortsæt?`,
      )
    ) {
      return;
    }
    setAutoPoolBusy(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const result = await autoAssignPoolsAction(levelKey);
      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      const createdRows: PoolRow[] = (result.newPools ?? []).map((p) => ({
        id: p.id,
        event_id: p.event_id,
        level: p.level,
        name: p.name,
        sort_order: p.sort_order,
        is_closed: p.is_closed ?? false,
        period_id: p.period_id,
      }));

      if (createdRows.length > 0) {
        setPools((prev) => sortPoolsForDisplay([...prev, ...createdRows]));
        setActivePoolId((current) => current ?? createdRows[0]?.id ?? null);
      }

      const map = new Map((result.assignments ?? []).map((a) => [a.teamId, a.poolId]));
      setTeams((prev) => prev.map((t) => ({ ...t, pool_id: map.get(t.id) ?? t.pool_id })));
      setActionMsg(result.message);
      router.refresh();
    } finally {
      setAutoPoolBusy(false);
    }
  }, [hint.recommendedTeamCount, levelKey, router, unassignedTeams.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <section className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Hold i niveau" value={kpi.totalTeams} accent="teal" />
        <Kpi label="I puljer" value={kpi.assignedTeams} accent="blue" />
        <Kpi label="Uden pulje" value={kpi.unassignedTeams} accent="slate" />
        <Kpi label="Puljer (åbne)" value={`${kpi.openPools}/${kpi.poolCount}`} accent="teal" />
      </section>

      {!poolColumnsAvailable ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <p>
            Puljestørrelse fra Opsætning kan ikke læses — kør migration{" "}
            <code className="text-xs">20260520130000_level_schedule_pool_settings.sql</code> i Supabase. Indtil da
            bruges standard (mål = kampe/hold + 1, maks = 64).
          </p>
        </div>
      ) : null}

      <div className="shrink-0 rounded-lg border border-teal-200/80 bg-teal-50/60 px-4 py-3 text-sm text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/25 dark:text-teal-100">
        <p>
          Fra{" "}
          <Link href="/turnering/baner" className="font-semibold underline-offset-2 hover:underline">
            Opsætning → Kampe
          </Link>
          : <strong className="tabular-nums">{hint.matchesPerTeam}</strong> kampe/hold ·{" "}
          <strong>{formatPoolSizePlanLabel(hint)}</strong> · mindst <strong>2</strong> hold pr. pulje. Kampe genereres
          efter <strong className="tabular-nums">{hint.matchesPerTeam}</strong> kampe/hold — ikke automatisk n−1 i
          puljen. Tilføjelse blokeres ved maks; AutoPulje fylder op til mål.
        </p>
      </div>

      {orphanedTeams.length > 0 ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <p>
            <strong className="tabular-nums">{orphanedTeams.length}</strong> hold er markeret som placeret i en pulje,
            men puljen vises ikke (slettet eller gammel data).
          </p>
          <button
            type="button"
            disabled={releasingOrphans || busy}
            onClick={() => void releaseOrphanedTeams()}
            className="mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          >
            {releasingOrphans ? "Frigør…" : `Frigør ${orphanedTeams.length} hold`}
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {actionError}
        </div>
      ) : null}
      {actionMsg ? (
        <div className="shrink-0 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
          {actionMsg}
          <button type="button" className="ml-2 underline" onClick={() => setActionMsg(null)}>
            OK
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        {/* Venstre: hold uden pulje */}
        <section className="flex min-h-0 min-w-0 flex-col rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none sm:p-5 lg:min-h-0 lg:flex-1">
          <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Hold uden pulje
          </h2>
          <p className="mt-1 shrink-0 text-xs text-gray-500 dark:text-gray-400">
            Vælg en aktiv pulje til højre og klik på et hold for at tilføje det.
            {activePool ? (
              <>
                {" "}
                Aktiv pulje:{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">{activePool.name}</span>
              </>
            ) : (
              " Opret eller vælg en pulje først."
            )}
          </p>

          {activePoolId && !activePoolClosed ? (
            <div className="mt-2 shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 shadow-sm dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100">
              Aktiv pulje: {activePool?.name} · Hold tilføjes her
            </div>
          ) : activePoolClosed ? (
            <p className="mt-2 shrink-0 text-xs text-amber-800 dark:text-amber-200">
              {activePool?.name} er lukket — vælg en åben pulje eller genåbn den.
            </p>
          ) : null}

          <div className="mt-4 shrink-0">
            <label
              htmlFor="puljer-search"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              Søg
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                strokeWidth={2}
                aria-hidden
              />
              <input
                id="puljer-search"
                type="search"
                placeholder="Holdnavn…"
                autoComplete="off"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <label className="mt-3 flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />
            Vis kun hold uden pulje
          </label>

          <ul className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1 max-lg:max-h-[min(520px,65vh)] lg:flex-1">
            {filteredUnassigned.length === 0 ? (
              <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                {unassignedTeams.length === 0
                  ? orphanedTeams.length > 0
                    ? "Ingen hold i listen til venstre — men nogle hold mangler en synlig pulje (se advarsel ovenfor)."
                    : "Alle hold er placeret i puljer."
                  : "Ingen hold matcher søgningen."}
              </li>
            ) : (
              filteredUnassigned.map((s) => {
                const canClick = Boolean(activePoolId) && !activePoolClosed && !busyTeamIds.has(s.team.id);
                const detail = teamDetailsById.get(s.team.id);
                return (
                  <li key={s.team.id}>
                    <TeamRowWithPlayers
                      detail={detail ?? { teamName: s.team.name, nickname: null, players: [], coaches: [] }}
                      onShowDetail={() => setPreviewTeamId(s.team.id)}
                    >
                      <button
                        type="button"
                        disabled={!canClick}
                        onClick={() => addTeamToActivePool(s.team.id)}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                          canClick
                            ? "cursor-pointer hover:bg-teal-50/60 dark:hover:bg-teal-950/25"
                            : "cursor-not-allowed bg-gray-50/80 opacity-80 dark:bg-gray-800/40"
                        }`}
                      >
                        <p className="font-medium text-gray-900 dark:text-white">{s.team.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {s.playerCount} spillere · gns. {fmtAge(s.avgAge)} år · {s.clubCount} klubber
                        </p>
                      </button>
                    </TeamRowWithPlayers>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {/* Højre: puljer */}
        <section className="flex min-h-0 min-w-0 flex-col space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Puljer</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runAutoPool()}
                disabled={autoPoolBusy || busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {autoPoolBusy ? "Kører…" : "AutoPulje"}
              </button>
              <button
                type="button"
                onClick={() => void createPool()}
                disabled={creatingPool || busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0f766e] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                {creatingPool ? "Opretter…" : "Opret pulje"}
              </button>
            </div>
          </div>

          {activePoolId ? (
            <div className="shrink-0 rounded-xl border-2 border-teal-400 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-900 shadow-sm dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-100">
              Valgt pulje: {activePool?.name}
            </div>
          ) : null}

          {pools.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
              Ingen puljer endnu. Klik &quot;Opret pulje&quot; for at starte.
            </p>
          ) : (
            <ul className="space-y-3">
              {poolListItems.map((item) => {
                if (item.kind === "header") {
                  return (
                    <li key="_lukkede" className="list-none pt-1">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Lukkede puljer
                      </p>
                    </li>
                  );
                }

                const { pool, teamsInPool } = item;
                const closed = poolIsClosed(pool);
                const collapsed = collapsedPoolIds.has(pool.id);
                const active = pool.id === activePoolId;

                return (
                  <li
                    key={pool.id}
                    className={`overflow-visible rounded-xl border bg-white shadow-sm transition-colors dark:bg-gray-900/35 dark:shadow-none ${
                      closed
                        ? active
                          ? "border-teal-500 ring-2 ring-teal-500/25"
                          : "border-emerald-200 dark:border-emerald-900/40"
                        : active
                          ? "border-teal-500 ring-4 ring-teal-500/35"
                          : "border-lc-border dark:border-gray-700"
                    }`}
                  >
                    {closed ? (
                      <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                        Pulje lukket — genåbn for at tilføje eller fjerne hold
                      </p>
                    ) : null}

                    <div className="p-3 sm:p-4">
                      {active && !closed ? (
                        <p className="mb-3 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-teal-900 dark:border-teal-700 dark:bg-teal-950/45 dark:text-teal-100">
                          Aktiv pulje · Klik hold til venstre for at tilføje
                        </p>
                      ) : null}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-expanded={!collapsed}
                          onClick={() =>
                            setCollapsedPoolIds((prev) => {
                              const s = new Set(prev);
                              if (s.has(pool.id)) s.delete(pool.id);
                              else s.add(pool.id);
                              return s;
                            })
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                            aria-hidden
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setActivePoolId(pool.id)} className="w-full text-left">
                            <h3
                              className={`text-base font-semibold ${closed ? "text-emerald-950 dark:text-emerald-50" : "text-gray-900 dark:text-white"}`}
                            >
                              {pool.name}
                            </h3>
                          </button>
                          <PoolCapacityHint teamCount={teamsInPool.length} hint={hint} />
                        </div>
                      </div>

                      {!collapsed ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void togglePoolClosed(pool)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                                closed
                                  ? "border border-gray-200 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                              }`}
                            >
                              {closed ? "Genåbn pulje" : "Luk pulje"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deletePool(pool, teamsInPool.length)}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                            >
                              Slet pulje
                            </button>
                          </div>

                          {teamsInPool.length === 0 ? (
                            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Ingen hold i puljen endnu.</p>
                          ) : (
                            <ul className="mt-3 space-y-2">
                              {teamsInPool.map((s) => {
                                const teamBusy = busyTeamIds.has(s.team.id);
                                const detail = teamDetailsById.get(s.team.id);
                                return (
                                  <li key={s.team.id}>
                                    <TeamRowWithPlayers
                                      detail={
                                        detail ?? {
                                          teamName: s.team.name,
                                          nickname: null,
                                          players: [],
                                          coaches: [],
                                        }
                                      }
                                      onShowDetail={() => setPreviewTeamId(s.team.id)}
                                    >
                                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {s.team.name}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {s.playerCount} spillere · {fmtAge(s.avgAge)} år
                                          </p>
                                        </div>
                                        {!closed ? (
                                          <button
                                            type="button"
                                            disabled={teamBusy}
                                            onClick={() => void updateTeamPool(s.team.id, null)}
                                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                                          >
                                            <X className="h-3 w-3" aria-hidden />
                                            Fjern
                                          </button>
                                        ) : null}
                                      </div>
                                    </TeamRowWithPlayers>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <TeamDetailModal
        open={Boolean(previewDetail)}
        onClose={() => setPreviewTeamId(null)}
        detail={
          previewDetail ?? { teamName: "", nickname: null, players: [], coaches: [] }
        }
        playerCount={previewDetail?.playerCount ?? 0}
      />
    </div>
  );
}


function Kpi({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: number | string;
  accent?: "teal" | "blue" | "slate";
}) {
  const valueClass =
    accent === "teal"
      ? "text-[#0f766e] dark:text-teal-300"
      : accent === "blue"
        ? "text-[#1d4ed8] dark:text-blue-300"
        : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}
