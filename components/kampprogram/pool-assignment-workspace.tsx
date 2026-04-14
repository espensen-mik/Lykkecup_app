"use client";

import { AlertTriangle, ChevronDown, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { StyledSelect } from "@/components/ui/styled-select";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import { supabase } from "@/lib/supabase";
import type { TeamMemberRow, TeamRow } from "@/types/teams";

type PoolRow = {
  id: string;
  event_id: string;
  level: string | null;
  name: string;
  sort_order: number;
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

type Props = {
  levelKey: string;
  initialTeams: TeamRow[];
  initialPools: PoolRow[];
  initialMembers: TeamMemberRow[];
  initialPlayers: PlayerLite[];
};

type FilterStatus = "all" | "unassigned" | "assigned";
type SortMode = "name" | "avgAge" | "playerCount";
const POOL_TEAM_CAPACITY = 6;

function fmtAge(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function PoolAssignmentWorkspace({
  levelKey,
  initialTeams,
  initialPools,
  initialMembers,
  initialPlayers,
}: Props) {
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [pools, setPools] = useState<PoolRow[]>(initialPools);
  const [members] = useState<TeamMemberRow[]>(initialMembers);
  const [players] = useState<PlayerLite[]>(initialPlayers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [busyTeamIds, setBusyTeamIds] = useState<Set<string>>(new Set());
  const [creatingPool, setCreatingPool] = useState(false);
  const [autoPoolBusy, setAutoPoolBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);
  const [collapsedPoolIds, setCollapsedPoolIds] = useState<Set<string>>(new Set());
  const [deletingPoolIds, setDeletingPoolIds] = useState<Set<string>>(new Set());

  const playerById = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const membersByTeam = useMemo(() => {
    const m = new Map<string, TeamMemberRow[]>();
    for (const member of members) {
      const list = m.get(member.team_id);
      if (list) list.push(member);
      else m.set(member.team_id, [member]);
    }
    return m;
  }, [members]);

  const playersByTeam = useMemo(() => {
    const byTeam = new Map<string, Array<{ id: string; name: string; age: number | null; club: string | null }>>();
    for (const [teamId, teamMembers] of membersByTeam.entries()) {
      const list: Array<{ id: string; name: string; age: number | null; club: string | null }> = [];
      for (const m of teamMembers) {
        const p = playerById.get(m.player_id);
        if (!p) continue;
        list.push({
          id: p.id,
          name: p.name,
          age: p.age,
          club: p.home_club?.trim() || null,
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
      byTeam.set(teamId, list);
    }
    return byTeam;
  }, [membersByTeam, playerById]);

  const teamSummaries = useMemo<TeamSummary[]>(() => {
    return teams.map((team) => {
      const tMembers = membersByTeam.get(team.id) ?? [];
      let ageSum = 0;
      let ageCount = 0;
      const clubs = new Set<string>();
      for (const m of tMembers) {
        const p = playerById.get(m.player_id);
        if (!p) continue;
        const age = p.age;
        if (typeof age === "number" && !Number.isNaN(age)) {
          ageSum += age;
          ageCount += 1;
        }
        const club = p.home_club?.trim();
        if (club) clubs.add(club);
      }
      return {
        team,
        playerCount: tMembers.length,
        avgAge: ageCount > 0 ? Math.round((ageSum / ageCount) * 10) / 10 : null,
        clubCount: clubs.size,
      };
    });
  }, [teams, membersByTeam, playerById]);

  const teamSummaryById = useMemo(() => {
    const m = new Map<string, TeamSummary>();
    for (const s of teamSummaries) m.set(s.team.id, s);
    return m;
  }, [teamSummaries]);

  const kpi = useMemo(() => {
    const totalTeams = teams.length;
    const assignedTeams = teams.filter((t) => Boolean(t.pool_id)).length;
    const unassignedTeams = totalTeams - assignedTeams;
    return {
      totalTeams,
      assignedTeams,
      unassignedTeams,
      poolCount: pools.length,
    };
  }, [teams, pools]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = teamSummaries.filter((s) => {
      if (statusFilter === "unassigned" && s.team.pool_id) return false;
      if (statusFilter === "assigned" && !s.team.pool_id) return false;
      if (!q) return true;
      return s.team.name.toLowerCase().includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (sortMode === "name") {
        if (a.team.pool_id !== b.team.pool_id) return a.team.pool_id ? 1 : -1;
        return a.team.name.localeCompare(b.team.name, "da", { sensitivity: "base" });
      }
      if (sortMode === "playerCount") {
        if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
        return a.team.name.localeCompare(b.team.name, "da", { sensitivity: "base" });
      }
      const aAge = a.avgAge ?? -1;
      const bAge = b.avgAge ?? -1;
      if (bAge !== aAge) return bAge - aAge;
      return a.team.name.localeCompare(b.team.name, "da", { sensitivity: "base" });
    });

    return rows;
  }, [teamSummaries, search, statusFilter, sortMode]);

  const poolRows = useMemo(() => {
    const byId = new Map<string, TeamSummary[]>();
    for (const p of pools) byId.set(p.id, []);
    for (const s of teamSummaries) {
      if (!s.team.pool_id) continue;
      const list = byId.get(s.team.pool_id);
      if (list) list.push(s);
    }
    for (const list of byId.values()) {
      list.sort((a, b) => a.team.sort_order - b.team.sort_order || a.team.name.localeCompare(b.team.name, "da"));
    }
    return pools.map((pool) => {
      const teamsInPool = byId.get(pool.id) ?? [];
      const avgTeamAge =
        teamsInPool.length > 0
          ? Math.round(
              (teamsInPool.reduce((sum, t) => sum + (t.avgAge ?? 0), 0) / Math.max(1, teamsInPool.length)) * 10,
            ) / 10
          : null;
      return { pool, teamsInPool, avgTeamAge };
    });
  }, [pools, teamSummaries]);

  const previewTeamSummary = useMemo(
    () => (previewTeamId ? teamSummaryById.get(previewTeamId) ?? null : null),
    [previewTeamId, teamSummaryById],
  );
  const previewPlayers = useMemo(
    () => (previewTeamId ? playersByTeam.get(previewTeamId) ?? [] : []),
    [previewTeamId, playersByTeam],
  );

  const poolAgeMean = useMemo(() => {
    const ages = poolRows.map((p) => p.avgTeamAge).filter((x): x is number => x != null);
    if (ages.length === 0) return null;
    return ages.reduce((s, a) => s + a, 0) / ages.length;
  }, [poolRows]);

  async function updateTeamPool(teamId: string, nextPoolId: string | null) {
    setBusyTeamIds((prev) => new Set(prev).add(teamId));
    setActionMsg(null);
    const { error } = await supabase.from("teams").update({ pool_id: nextPoolId }).eq("id", teamId);
    setBusyTeamIds((prev) => {
      const n = new Set(prev);
      n.delete(teamId);
      return n;
    });
    if (error) {
      setActionMsg(`Kunne ikke opdatere hold: ${error.message}`);
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, pool_id: nextPoolId } : t)));
  }

  async function createPool() {
    setCreatingPool(true);
    setActionMsg(null);
    const maxSort = pools.length > 0 ? Math.max(...pools.map((p) => p.sort_order)) : 0;
    const name = `Pulje ${pools.length + 1}`;
    const { data, error } = await supabase
      .from("pools")
      .insert({
        event_id: TURNERING_EVENT_ID,
        level: levelKey,
        name,
        sort_order: maxSort + 1,
      })
      .select("id, event_id, level, name, sort_order")
      .single();
    setCreatingPool(false);
    if (error || !data) {
      setActionMsg(`Kunne ikke oprette pulje: ${error?.message ?? "ukendt fejl"}`);
      return;
    }
    setPools((prev) =>
      [...prev, data as PoolRow].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da")),
    );
  }

  async function runAutoPool() {
    if (pools.length === 0) {
      setActionMsg("Opret mindst én pulje først før AutoPulje kan køres.");
      return;
    }
    const ok = window.confirm(
      "AutoPulje vil kun fordele hold uden pulje. Hver pulje kan maksimalt have 6 hold. Vil du fortsætte?",
    );
    if (!ok) return;

    setAutoPoolBusy(true);
    setActionMsg(null);

    const teamsSorted = [...teamSummaries]
      .filter((t) => !t.team.pool_id)
      .sort((a, b) => (b.avgAge ?? -1) - (a.avgAge ?? -1));

    if (teamsSorted.length === 0) {
      setAutoPoolBusy(false);
      setActionMsg("Alle hold er allerede placeret i en pulje.");
      return;
    }

    const poolState = new Map<string, { count: number; ageSum: number; ageKnownCount: number }>();
    for (const row of poolRows) {
      let ageSum = 0;
      let ageKnownCount = 0;
      for (const t of row.teamsInPool) {
        if (t.avgAge != null) {
          ageSum += t.avgAge;
          ageKnownCount += 1;
        }
      }
      poolState.set(row.pool.id, {
        count: row.teamsInPool.length,
        ageSum,
        ageKnownCount,
      });
    }

    const assignments: Array<{ teamId: string; poolId: string }> = [];
    let skippedForCapacity = 0;
    for (const t of teamsSorted) {
      let best: {
        poolId: string;
        count: number;
        ageDistance: number;
        ageKnownCount: number;
      } | null = null;
      for (const [poolId, st] of poolState.entries()) {
        if (st.count >= POOL_TEAM_CAPACITY) continue;
        const teamAge = t.avgAge;
        const poolAge = st.ageKnownCount > 0 ? st.ageSum / st.ageKnownCount : null;
        const ageDistance =
          teamAge == null || poolAge == null ? 0 : Math.abs(teamAge - poolAge);

        if (
          !best ||
          ageDistance < best.ageDistance ||
          (ageDistance === best.ageDistance && st.count < best.count) ||
          (ageDistance === best.ageDistance &&
            st.count === best.count &&
            st.ageKnownCount < best.ageKnownCount)
        ) {
          best = { poolId, count: st.count, ageDistance, ageKnownCount: st.ageKnownCount };
        }
      }
      if (!best) {
        skippedForCapacity += 1;
        continue;
      }
      assignments.push({ teamId: t.team.id, poolId: best.poolId });
      const st = poolState.get(best.poolId)!;
      st.count += 1;
      if (t.avgAge != null) {
        st.ageSum += t.avgAge;
        st.ageKnownCount += 1;
      }
    }

    if (assignments.length === 0) {
      setAutoPoolBusy(false);
      setActionMsg(`Ingen ledig puljekapacitet. Hver pulje har allerede ${POOL_TEAM_CAPACITY} hold.`);
      return;
    }

    const updates = await Promise.all(
      assignments.map((a) => supabase.from("teams").update({ pool_id: a.poolId }).eq("id", a.teamId)),
    );
    setAutoPoolBusy(false);
    const firstErr = updates.find((r) => r.error)?.error;
    if (firstErr) {
      setActionMsg(`AutoPulje fejlede: ${firstErr.message}`);
      return;
    }

    const assignMap = new Map(assignments.map((a) => [a.teamId, a.poolId]));
    setTeams((prev) => prev.map((t) => ({ ...t, pool_id: assignMap.get(t.id) ?? t.pool_id })));
    setActionMsg(
      skippedForCapacity > 0
        ? `AutoPulje gennemført: ${assignments.length} hold fordelt, ${skippedForCapacity} mangler plads (max ${POOL_TEAM_CAPACITY} pr. pulje).`
        : `AutoPulje gennemført: ${assignments.length} hold fordelt.`,
    );
  }

  function togglePoolCollapsed(poolId: string) {
    setCollapsedPoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(poolId)) next.delete(poolId);
      else next.add(poolId);
      return next;
    });
  }

  async function deletePool(pool: PoolRow, teamCount: number) {
    const ok = window.confirm(
      teamCount > 0
        ? `${pool.name} indeholder ${teamCount} hold. Holdene bliver sat til "Uden pulje". Vil du slette puljen?`
        : `Vil du slette ${pool.name}?`,
    );
    if (!ok) return;

    setActionMsg(null);
    setDeletingPoolIds((prev) => new Set(prev).add(pool.id));

    if (teamCount > 0) {
      const clearRes = await supabase
        .from("teams")
        .update({ pool_id: null })
        .eq("event_id", TURNERING_EVENT_ID)
        .eq("pool_id", pool.id);
      if (clearRes.error) {
        setDeletingPoolIds((prev) => {
          const next = new Set(prev);
          next.delete(pool.id);
          return next;
        });
        setActionMsg(`Kunne ikke frigøre hold fra pulje: ${clearRes.error.message}`);
        return;
      }
    }

    const delRes = await supabase.from("pools").delete().eq("id", pool.id);
    setDeletingPoolIds((prev) => {
      const next = new Set(prev);
      next.delete(pool.id);
      return next;
    });
    if (delRes.error) {
      setActionMsg(`Kunne ikke slette pulje: ${delRes.error.message}`);
      return;
    }

    setTeams((prev) => prev.map((t) => (t.pool_id === pool.id ? { ...t, pool_id: null } : t)));
    setPools((prev) => prev.filter((p) => p.id !== pool.id));
    setCollapsedPoolIds((prev) => {
      const next = new Set(prev);
      next.delete(pool.id);
      return next;
    });
    setActionMsg(`${pool.name} er slettet.`);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Hold i alt" value={kpi.totalTeams} />
        <Kpi label="Fordelt i puljer" value={kpi.assignedTeams} accent />
        <Kpi label="Uden pulje" value={kpi.unassignedTeams} />
        <Kpi label="Puljer" value={kpi.poolCount} />
      </section>

      <section className="rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Søg hold
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg efter holdnavn …"
              className="w-full rounded-lg border border-lc-border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="min-w-[12rem]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Status
            </label>
            <StyledSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              className="rounded-lg border border-lc-border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="all">Alle hold</option>
              <option value="unassigned">Kun uden pulje</option>
              <option value="assigned">Kun fordelt</option>
            </StyledSelect>
          </div>
          <div className="min-w-[12rem]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sortering
            </label>
            <StyledSelect
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg border border-lc-border bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="name">Holdnavn</option>
              <option value="avgAge">Gns. alder</option>
              <option value="playerCount">Spillerantal</option>
            </StyledSelect>
          </div>
        </div>
      </section>

      {actionMsg ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
          {actionMsg}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Hold</h2>
          {filteredTeams.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Ingen hold matcher filtrene.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredTeams.map((s) => {
                const busy = busyTeamIds.has(s.team.id);
                return (
                  <li
                    key={s.team.id}
                    className="rounded-lg border border-gray-200/90 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/70"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">{s.team.name}</p>
                      <span
                        title={s.team.pool_id ? "Holdet er placeret i en pulje." : "Holdet er endnu ikke placeret i en pulje."}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.team.pool_id
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        }`}
                      >
                        {s.team.pool_id ? "I pulje" : "Uden pulje"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {s.playerCount} spillere · gns. alder {fmtAge(s.avgAge)} · {s.clubCount} klubber
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTeamId(s.team.id)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Se spillere
                      </button>
                      <StyledSelect
                        disabled={busy}
                        value={s.team.pool_id ?? ""}
                        onChange={(e) => void updateTeamPool(s.team.id, e.target.value || null)}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="">Uden pulje</option>
                        {pools.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </StyledSelect>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Puljer</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void runAutoPool()}
                disabled={autoPoolBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-60 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200 dark:hover:bg-sky-950/50"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {autoPoolBusy ? "Kører…" : "AutoPulje"}
              </button>
              <button
                type="button"
                onClick={() => void createPool()}
                disabled={creatingPool}
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-60 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-200 dark:hover:bg-teal-950/50"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {creatingPool ? "Opretter…" : "Opret pulje"}
              </button>
            </div>
          </div>

          {poolRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Ingen puljer oprettet endnu.
            </p>
          ) : (
            <div className="space-y-3">
              {poolRows.map(({ pool, teamsInPool, avgTeamAge }) => {
                const imbalance =
                  poolAgeMean != null && avgTeamAge != null ? Math.abs(avgTeamAge - poolAgeMean) >= 2 : false;
                const collapsed = collapsedPoolIds.has(pool.id);
                const deleting = deletingPoolIds.has(pool.id);
                return (
                  <section
                    key={pool.id}
                    className="rounded-lg border border-gray-200/90 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/70"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => togglePoolCollapsed(pool.id)}
                        className="inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        aria-expanded={!collapsed}
                        aria-controls={`pool-${pool.id}`}
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${collapsed ? "-rotate-90" : ""}`}
                          aria-hidden
                        />
                        <span className="truncate font-medium text-gray-900 dark:text-white">{pool.name}</span>
                      </button>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{teamsInPool.length} hold</span>
                        <span
                          title={`Kapacitet i puljen: ${teamsInPool.length} af ${POOL_TEAM_CAPACITY} hold.`}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                            teamsInPool.length >= POOL_TEAM_CAPACITY
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {teamsInPool.length}/{POOL_TEAM_CAPACITY}
                        </span>
                        <span>· gns. holdalder {fmtAge(avgTeamAge)}</span>
                        {imbalance ? (
                          <span
                            title="Puljens gennemsnitlige holdalder afviger markant fra de andre puljer i niveauet."
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Ujævn alder
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void deletePool(pool, teamsInPool.length)}
                          disabled={deleting}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                        >
                          {deleting ? "Sletter…" : "Slet pulje"}
                        </button>
                      </div>
                    </div>

                    {collapsed ? null : teamsInPool.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ingen hold i denne pulje endnu.</p>
                    ) : (
                      <ul id={`pool-${pool.id}`} className="mt-2 space-y-2">
                        {teamsInPool.map((s) => {
                          const busy = busyTeamIds.has(s.team.id);
                          return (
                            <li key={s.team.id} className="rounded-md border border-gray-100 p-2 dark:border-gray-800">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.team.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {s.playerCount} spillere · {fmtAge(s.avgAge)} år
                                </p>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPreviewTeamId(s.team.id)}
                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  Se spillere
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void updateTeamPool(s.team.id, null)}
                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  Fjern
                                </button>
                                <StyledSelect
                                  disabled={busy}
                                  value={s.team.pool_id ?? ""}
                                  onChange={(e) => void updateTeamPool(s.team.id, e.target.value || null)}
                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                >
                                  <option value="">Uden pulje</option>
                                  {pools.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </StyledSelect>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <TeamPlayersModal
        open={Boolean(previewTeamSummary)}
        onClose={() => setPreviewTeamId(null)}
        teamName={previewTeamSummary?.team.name ?? ""}
        playerCount={previewTeamSummary?.playerCount ?? 0}
        players={previewPlayers}
      />
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${
          accent ? "text-[#0f766e] dark:text-teal-300" : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TeamPlayersModal({
  open,
  onClose,
  teamName,
  playerCount,
  players,
}: {
  open: boolean;
  onClose: () => void;
  teamName: string;
  playerCount: number;
  players: Array<{ id: string; name: string; age: number | null; club: string | null }>;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-lc-border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label={`Spillere på ${teamName}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-lc-border px-5 py-4 dark:border-gray-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-400">
              Team detaljer
            </p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{teamName}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {playerCount} {playerCount === 1 ? "spiller" : "spillere"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Luk spillerliste"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {players.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
              Ingen spillere fundet på holdet.
            </p>
          ) : (
            <ul className="space-y-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.club || "—"}</p>
                  </div>
                  <p className="shrink-0 text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
                    {p.age == null ? "— år" : `${p.age} år`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

