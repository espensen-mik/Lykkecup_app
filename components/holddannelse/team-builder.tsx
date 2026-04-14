"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Plus, Search } from "lucide-react";
import { HOLD_EVENT_ID, nextDefaultTeamName, normalizeLevelKey } from "@/lib/holddannelse";
import {
  derivePreferenceBadge,
  preferencesTooltipText,
  type PreferenceBadgeLabel,
} from "@/lib/player-preferences";
import { supabase } from "@/lib/supabase";
import type { HoldPlayerRow, TeamMemberRow, TeamRow } from "@/types/teams";
import { StyledSelect } from "@/components/ui/styled-select";

type Props = {
  levelKey: string;
  initialPlayers: HoldPlayerRow[];
  initialTeams: TeamRow[];
  initialMembers: TeamMemberRow[];
  initialEventAssignedPlayerIds: string[];
};

const BADGE_CLASS: Record<PreferenceBadgeLabel, string> = {
  "Egen klub": "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  "Nye venner": "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  "Alt ok": "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
};

function teamIsCompleted(t: TeamRow): boolean {
  return Boolean(t.is_completed);
}

function teamStatsForMembers(
  memberPlayerIds: string[],
  playerById: Map<string, HoldPlayerRow>,
): { avgAge: number | null; clubCount: number } {
  const ages: number[] = [];
  const clubs = new Set<string>();
  for (const id of memberPlayerIds) {
    const p = playerById.get(id);
    if (!p) continue;
    if (typeof p.age === "number" && !Number.isNaN(p.age)) ages.push(p.age);
    const c = p.home_club?.trim();
    if (c) clubs.add(c);
  }
  const avgAge =
    ages.length > 0 ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null;
  return { avgAge, clubCount: clubs.size };
}

export function TeamBuilder({
  levelKey,
  initialPlayers,
  initialTeams,
  initialMembers,
  initialEventAssignedPlayerIds,
}: Props) {
  const canonical = normalizeLevelKey(levelKey);

  const [players] = useState<HoldPlayerRow[]>(initialPlayers);
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [members, setMembers] = useState<TeamMemberRow[]>(initialMembers);
  const [assignedGlobally, setAssignedGlobally] = useState<Set<string>>(
    () => new Set(initialEventAssignedPlayerIds),
  );

  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => initialTeams[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState<string>("");
  const [prefFilter, setPrefFilter] = useState<string>("alle");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Sammenfoldede hold (kun UI — gemmes ikke). */
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(() => new Set());

  const playerById = useMemo(() => {
    const m = new Map<string, HoldPlayerRow>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const playerToTeamInLevel = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) {
      m.set(mem.player_id, mem.team_id);
    }
    return m;
  }, [members]);

  const teamById = useMemo(() => {
    const m = new Map<string, TeamRow>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const membersByTeam = useMemo(() => {
    const m = new Map<string, TeamMemberRow[]>();
    for (const mem of members) {
      const list = m.get(mem.team_id) ?? [];
      list.push(mem);
      m.set(mem.team_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const na = playerById.get(a.player_id)?.name ?? "";
        const nb = playerById.get(b.player_id)?.name ?? "";
        return na.localeCompare(nb, "da");
      });
    }
    return m;
  }, [members, playerById]);

  const clubOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) {
      const c = p.home_club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [players]);

  const kpis = useMemo(() => {
    const total = players.length;
    let assignedHere = 0;
    for (const p of players) {
      if (playerToTeamInLevel.has(p.id)) assignedHere += 1;
    }
    return {
      total,
      assigned: assignedHere,
      unassigned: total - assignedHere,
      teamCount: teams.length,
    };
  }, [players, playerToTeamInLevel, teams.length]);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (onlyUnassigned && playerToTeamInLevel.has(p.id)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (clubFilter) {
        const c = p.home_club?.trim() ?? "";
        if (c !== clubFilter) return false;
      }
      if (prefFilter !== "alle") {
        if (prefFilter === "uden") {
          if (derivePreferenceBadge(p.preferences) != null) return false;
        } else {
          const b = derivePreferenceBadge(p.preferences);
          if (b !== prefFilter) return false;
        }
      }
      return true;
    });
  }, [players, search, clubFilter, prefFilter, onlyUnassigned, playerToTeamInLevel]);

  const addPlayerToActiveTeam = useCallback(
    async (playerId: string) => {
      setActionError(null);
      if (!activeTeamId) {
        setActionError("Vælg et hold til højre før du tilføjer spillere.");
        return;
      }
      if (assignedGlobally.has(playerId)) {
        setActionError("Spilleren er allerede tildelt et hold.");
        return;
      }

      setBusy(true);
      const { data, error } = await supabase
        .from("team_members")
        .insert({
          event_id: HOLD_EVENT_ID,
          player_id: playerId,
          team_id: activeTeamId,
        })
        .select("id, event_id, player_id, team_id")
        .single();

      setBusy(false);
      if (error) {
        setActionError(error.message);
        return;
      }

      const row = data as TeamMemberRow;
      setMembers((prev) => [...prev, row]);
      setAssignedGlobally((prev) => new Set(prev).add(playerId));
    },
    [activeTeamId, assignedGlobally],
  );

  const removeMember = useCallback(async (member: TeamMemberRow) => {
    setActionError(null);
    setBusy(true);
    const { error } = await supabase.from("team_members").delete().eq("id", member.id);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    setAssignedGlobally((prev) => {
      const next = new Set(prev);
      next.delete(member.player_id);
      return next;
    });
  }, []);

  const toggleTeamCollapsed = useCallback((teamId: string) => {
    setCollapsedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const toggleTeamCompleted = useCallback(async (team: TeamRow) => {
    setActionError(null);
    const next = !teamIsCompleted(team);
    setBusy(true);
    const { error } = await supabase.from("teams").update({ is_completed: next }).eq("id", team.id);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setTeams((prev) =>
      prev.map((x) => (x.id === team.id ? { ...x, is_completed: next } : x)),
    );
    setCollapsedTeamIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(team.id);
      else s.delete(team.id);
      return s;
    });
  }, []);

  const createTeam = useCallback(async () => {
    setActionError(null);
    const maxSort = teams.length ? Math.max(...teams.map((t) => t.sort_order)) : 0;
    const name = nextDefaultTeamName(canonical, teams.length);
    setBusy(true);
    const { data, error } = await supabase
      .from("teams")
      .insert({
        event_id: HOLD_EVENT_ID,
        pool_id: null,
        name,
        level: canonical,
        sort_order: maxSort + 1,
      })
      .select("id, event_id, pool_id, name, level, sort_order, is_completed")
      .single();
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    const t = data as TeamRow;
    setTeams((prev) => [...prev, t].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "da")));
    setActiveTeamId(t.id);
  }, [teams, canonical]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Spillere i niveau" value={kpis.total} accent="teal" />
        <Kpi label="Fordelt på hold" value={kpis.assigned} accent="blue" />
        <Kpi label="Ikke fordelt" value={kpis.unassigned} accent="slate" />
        <Kpi label="Oprettede hold" value={kpis.teamCount} accent="teal" />
      </div>

      {actionError ? (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        <section className="flex min-h-0 min-w-0 flex-col rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none sm:p-5 lg:min-h-0 lg:flex-1">
          <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tilgængelige spillere
          </h2>
          <p className="mt-1 shrink-0 text-xs text-gray-500 dark:text-gray-400">
            Klik på en spiller for at tilføje til det aktive hold (
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {activeTeamId ? teamById.get(activeTeamId)?.name ?? "—" : "vælg hold"}
            </span>
            ).
          </p>

          <div className="mt-4 shrink-0 space-y-3">
            <div>
              <label
                htmlFor="holddannelse-search"
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
                  id="holddannelse-search"
                  type="search"
                  placeholder="Navn på spiller…"
                  autoComplete="off"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="holddannelse-club"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  Klub
                </label>
                <StyledSelect
                  id="holddannelse-club"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={clubFilter}
                  onChange={(e) => setClubFilter(e.target.value)}
                >
                  <option value="">Alle klubber</option>
                  {clubOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </StyledSelect>
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="holddannelse-pref"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  Præference
                </label>
                <StyledSelect
                  id="holddannelse-pref"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  value={prefFilter}
                  onChange={(e) => setPrefFilter(e.target.value)}
                >
                  <option value="alle">Alle præferencer</option>
                  <option value="Egen klub">Egen klub</option>
                  <option value="Nye venner">Nye venner</option>
                  <option value="Alt ok">Alt ok</option>
                  <option value="uden">Uden badge</option>
                </StyledSelect>
              </div>
            </div>
          </div>

          <label className="mt-3 flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />
            Vis kun spillere uden hold
          </label>

          <ul className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1 max-lg:max-h-[min(520px,65vh)] lg:flex-1">
            {filteredPlayers.length === 0 ? (
              <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                Ingen spillere matcher filtrene.
              </li>
            ) : (
              filteredPlayers.map((p) => {
                const teamIdHere = playerToTeamInLevel.get(p.id);
                const assignedOther =
                  assignedGlobally.has(p.id) && !teamIdHere ? true : false;
                const assignedHere = Boolean(teamIdHere);
                const badge = derivePreferenceBadge(p.preferences);
                const tip = preferencesTooltipText(p.preferences);
                const canClick =
                  Boolean(activeTeamId) && !assignedGlobally.has(p.id) && !busy;

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      title={tip}
                      disabled={!canClick}
                      onClick={() => void addPlayerToActiveTeam(p.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        canClick
                          ? "cursor-pointer border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50/50 dark:border-gray-600 dark:bg-gray-900/50 dark:hover:border-teal-600 dark:hover:bg-teal-950/20"
                          : "cursor-not-allowed border-gray-100 bg-gray-50/80 opacity-80 dark:border-gray-700 dark:bg-gray-800/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {badge ? (
                            <span
                              title={`Status: ${badge}`}
                              className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${BADGE_CLASS[badge]}`}
                            >
                              {badge}
                            </span>
                          ) : null}
                          {assignedHere ? (
                            <span
                              title={`Spilleren er allerede på ${teamById.get(teamIdHere!)?.name ?? "dette hold"}.`}
                              className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                            >
                              På {teamById.get(teamIdHere!)?.name ?? "hold"}
                            </span>
                          ) : null}
                          {assignedOther ? (
                            <span
                              title="Spilleren er tildelt et andet hold."
                              className="rounded-full bg-gray-200 px-2 py-0.5 text-[0.6875rem] font-medium text-gray-800 dark:bg-gray-600 dark:text-gray-100"
                            >
                              Tildelt andet hold
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{p.home_club?.trim() || "—"}</span>
                        <span className="tabular-nums">
                          {p.age != null ? `${p.age} år` : "Alder —"}
                        </span>
                        <span>{p.gender?.trim() || "Køn —"}</span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Hold
            </h2>
            <button
              type="button"
              onClick={() => void createTeam()}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e] disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              Opret hold
            </button>
          </div>

          {teams.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
              Ingen hold endnu. Klik &quot;Opret hold&quot; for at starte.
            </p>
          ) : (
            <ul className="space-y-3">
              {teams.map((t) => {
                const tMembers = membersByTeam.get(t.id) ?? [];
                const ids = tMembers.map((m) => m.player_id);
                const { avgAge, clubCount } = teamStatsForMembers(ids, playerById);
                const active = t.id === activeTeamId;
                const collapsed = collapsedTeamIds.has(t.id);
                const completed = teamIsCompleted(t);
                const cardClass = completed
                  ? active
                    ? "border-emerald-200 bg-emerald-50/95 ring-2 ring-teal-500/30 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:ring-teal-500/25"
                    : "border-emerald-200 bg-emerald-50/95 dark:border-emerald-800/60 dark:bg-emerald-950/35"
                  : active
                    ? "border-teal-500 ring-2 ring-teal-500/25 dark:border-teal-500"
                    : "border-lc-border dark:border-gray-700";
                return (
                  <li
                    key={t.id}
                    className={`rounded-xl border bg-white p-3 shadow-sm transition-colors dark:bg-gray-900/35 sm:p-4 ${cardClass}`}
                  >
                    <div className="flex gap-1 sm:gap-2">
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Udvid hold" : "Sammenfold hold"}
                        onClick={() => toggleTeamCollapsed(t.id)}
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          completed
                            ? "text-emerald-700 hover:bg-emerald-100/90 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""} ${completed ? "text-emerald-700 dark:text-emerald-300" : ""}`}
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTeamId(t.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              {completed ? (
                                <span className="inline-flex shrink-0" title="Hold lukket">
                                  <CheckCircle2
                                    className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </span>
                              ) : null}
                              <h3
                                className={`text-base font-semibold ${
                                  completed ? "text-emerald-950 dark:text-emerald-50" : "text-gray-900 dark:text-white"
                                }`}
                              >
                                {t.name}
                              </h3>
                            </div>
                            <p
                              className={`mt-1 text-xs ${
                                completed ? "text-emerald-800/90 dark:text-emerald-200/85" : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {tMembers.length} {tMembers.length === 1 ? "spiller" : "spillere"}
                              {avgAge != null ? ` · snit alder ${avgAge}` : ""}
                              {clubCount > 0
                                ? ` · ${clubCount} ${clubCount === 1 ? "klub" : "klubber"}`
                                : ""}
                            </p>
                          </button>
                          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void toggleTeamCompleted(t)}
                              className={
                                completed
                                  ? "rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                  : "rounded-lg border border-emerald-600/90 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70"
                              }
                            >
                              {completed ? "Åbn igen" : "Luk hold"}
                            </button>
                            {active ? (
                              <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-center text-xs font-semibold text-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
                                Aktivt
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setActiveTeamId(t.id)}
                                className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-center text-xs font-medium text-gray-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-[#0f766e] disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:border-teal-600 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
                              >
                                Vælg
                              </button>
                            )}
                          </div>
                        </div>

                        {!collapsed ? (
                          tMembers.length === 0 ? (
                            <p className="mt-3 text-xs text-gray-500">
                              Ingen spillere på holdet endnu.
                            </p>
                          ) : (
                            <ul
                              className={`mt-3 divide-y ${
                                completed
                                  ? "divide-emerald-100 dark:divide-emerald-900/45"
                                  : "divide-gray-100 dark:divide-gray-700"
                              }`}
                            >
                              {tMembers.map((m) => {
                                const pl = playerById.get(m.player_id);
                                return (
                                  <li
                                    key={m.id}
                                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {pl?.name ?? m.player_id}
                                      </p>
                                      {pl ? (
                                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                                          <span>{pl.home_club?.trim() || "—"}</span>
                                          <span className="tabular-nums">
                                            {pl.age != null && !Number.isNaN(pl.age)
                                              ? `${pl.age} år`
                                              : "Alder —"}
                                          </span>
                                          <span>{pl.gender?.trim() || "Køn —"}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void removeMember(m)}
                                      className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-200"
                                    >
                                      Fjern
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "teal" | "blue" | "slate";
}) {
  const ring =
    accent === "teal"
      ? "border-teal-200/80 dark:border-teal-800/60"
      : accent === "blue"
        ? "border-blue-200/80 dark:border-blue-800/60"
        : "border-gray-200 dark:border-gray-600";
  const num =
    accent === "teal"
      ? "text-[#0f766e] dark:text-teal-300"
      : accent === "blue"
        ? "text-blue-700 dark:text-blue-300"
        : "text-gray-800 dark:text-gray-200";
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-gray-900/35 ${ring}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${num}`}>{value}</p>
    </div>
  );
}
