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
import type { HoldCoachRow, HoldPlayerRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";
import { StyledSelect } from "@/components/ui/styled-select";

type Props = {
  levelKey: string;
  initialPlayers: HoldPlayerRow[];
  initialTeams: TeamRow[];
  initialMembers: TeamMemberRow[];
  initialEventAssignedPlayerIds: string[];
  initialCoaches: HoldCoachRow[];
  initialTeamCoaches: TeamCoachRow[];
  initialActiveTeamId?: string | null;
};

const BADGE_CLASS: Record<PreferenceBadgeLabel, string> = {
  "Egen klub": "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  "Nye venner": "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  "Alt ok": "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  "Klar på alt": "bg-amber-100 text-amber-950 dark:bg-amber-950/55 dark:text-amber-100",
};

function teamIsCompleted(t: TeamRow): boolean {
  return Boolean(t.is_completed);
}

const ERR_CLOSED_TEAM_PLAYER = "Du kan ikke sætte spilleren på et hold, der er lukket.";
const ERR_CLOSED_TEAM_COACH = "Du kan ikke sætte træneren på et hold, der er lukket.";

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
  initialCoaches,
  initialTeamCoaches,
  initialActiveTeamId,
}: Props) {
  const canonical = normalizeLevelKey(levelKey);
  /** Åbne hold først (øverst), lukkede hold sidst — inden for hver gruppe nyeste `sort_order` først. */
  const sortTeamsForDisplay = useCallback((rows: TeamRow[]) => {
    const open = rows.filter((t) => !teamIsCompleted(t));
    const closed = rows.filter((t) => teamIsCompleted(t));
    const cmp = (a: TeamRow, b: TeamRow) =>
      b.sort_order - a.sort_order || b.name.localeCompare(a.name, "da");
    return [...open].sort(cmp).concat([...closed].sort(cmp));
  }, []);

  const [players] = useState<HoldPlayerRow[]>(initialPlayers);
  const [teams, setTeams] = useState<TeamRow[]>(() => sortTeamsForDisplay(initialTeams));
  const [members, setMembers] = useState<TeamMemberRow[]>(initialMembers);
  const [assignedGlobally, setAssignedGlobally] = useState<Set<string>>(
    () => new Set(initialEventAssignedPlayerIds),
  );
  const [coaches] = useState<HoldCoachRow[]>(initialCoaches);
  const [teamCoachLinks, setTeamCoachLinks] = useState<TeamCoachRow[]>(initialTeamCoaches);

  const [activeTeamId, setActiveTeamId] = useState<string | null>(
    () => initialActiveTeamId ?? initialTeams[0]?.id ?? null,
  );
  const [leftTab, setLeftTab] = useState<"spillere" | "traenere">("spillere");
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState<string>("");
  const [coachSearch, setCoachSearch] = useState("");
  const [prefFilter, setPrefFilter] = useState<string>("alle");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [onlyUnassignedCoaches, setOnlyUnassignedCoaches] = useState(true);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Sammenfoldede hold (kun UI — gemmes ikke). */
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(() => new Set());
  /** Lukkede hold: false/undefined = kompakt grøn bjælke (som håndterede kommentarer); true = udvidet kort. */
  const [closedTeamDetailOpen, setClosedTeamDetailOpen] = useState<Record<string, boolean>>({});
  /** Kladder til «Holdets kaldenavn» (nickname); nøgle = team id. */
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});

  const playerById = useMemo(() => {
    const m = new Map<string, HoldPlayerRow>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const coachById = useMemo(() => {
    const m = new Map<string, HoldCoachRow>();
    for (const c of coaches) m.set(c.id, c);
    return m;
  }, [coaches]);

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

  const openTeams = useMemo(() => teams.filter((t) => !teamIsCompleted(t)), [teams]);
  const closedTeams = useMemo(() => teams.filter((t) => teamIsCompleted(t)), [teams]);

  const activeTeamIsClosed = useMemo(() => {
    const t = teams.find((x) => x.id === activeTeamId);
    return t ? teamIsCompleted(t) : false;
  }, [teams, activeTeamId]);
  const teamNickname = useCallback(
    (team: TeamRow | null | undefined): string | null => {
      if (!team) return null;
      const draft = nicknameDrafts[team.id];
      const draftOrStored = draft !== undefined ? draft : (team.nickname ?? "");
      const nick = draftOrStored.trim();
      return nick.length > 0 ? nick : null;
    },
    [nicknameDrafts],
  );
  const activeTeam = activeTeamId ? teamById.get(activeTeamId) : null;
  const activeTeamName = activeTeam?.name ?? "—";
  const activeTeamNickname = teamNickname(activeTeam);

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

  const coachesByTeam = useMemo(() => {
    const m = new Map<string, TeamCoachRow[]>();
    for (const tc of teamCoachLinks) {
      const list = m.get(tc.team_id) ?? [];
      list.push(tc);
      m.set(tc.team_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const na = coachById.get(a.coach_id)?.name ?? "";
        const nb = coachById.get(b.coach_id)?.name ?? "";
        return na.localeCompare(nb, "da");
      });
    }
    return m;
  }, [teamCoachLinks, coachById]);

  const clubOptions = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) {
      const c = p.home_club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [players]);

  const coachClubOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of coaches) {
      const x = c.home_club?.trim();
      if (x) s.add(x);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [coaches]);

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

  /** Trænere der allerede er knyttet til mindst ét hold i eventet. */
  const coachIdsOnAnyTeamInEvent = useMemo(() => {
    const s = new Set<string>();
    for (const tc of teamCoachLinks) {
      s.add(tc.coach_id);
    }
    return s;
  }, [teamCoachLinks]);

  const filteredCoaches = useMemo(() => {
    const q = coachSearch.trim().toLowerCase();
    return coaches.filter((c) => {
      if (onlyUnassignedCoaches && coachIdsOnAnyTeamInEvent.has(c.id)) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (clubFilter) {
        const club = c.home_club?.trim() ?? "";
        if (club !== clubFilter) return false;
      }
      return true;
    });
  }, [coaches, coachSearch, clubFilter, onlyUnassignedCoaches, coachIdsOnAnyTeamInEvent]);

  const addPlayerToActiveTeam = useCallback(
    async (playerId: string) => {
      setActionError(null);
      if (!activeTeamId) {
        setActionError("Vælg et hold til højre før du tilføjer spillere.");
        return;
      }
      const targetTeam = teamById.get(activeTeamId);
      if (targetTeam && teamIsCompleted(targetTeam)) {
        setActionError(ERR_CLOSED_TEAM_PLAYER);
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
    [activeTeamId, assignedGlobally, teamById],
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

  const addCoachToActiveTeam = useCallback(
    async (coachId: string) => {
      setActionError(null);
      if (!activeTeamId) {
        setActionError("Vælg et hold til højre før du tilføjer trænere.");
        return;
      }
      const targetTeam = teamById.get(activeTeamId);
      if (targetTeam && teamIsCompleted(targetTeam)) {
        setActionError(ERR_CLOSED_TEAM_COACH);
        return;
      }
      if (teamCoachLinks.some((tc) => tc.team_id === activeTeamId && tc.coach_id === coachId)) {
        return;
      }

      setBusy(true);
      const { data, error } = await supabase
        .from("team_coaches")
        .insert({
          event_id: HOLD_EVENT_ID,
          team_id: activeTeamId,
          coach_id: coachId,
        })
        .select("id, event_id, team_id, coach_id")
        .single();

      setBusy(false);
      if (error) {
        if (error.code === "23505") {
          setActionError("Træneren er allerede på dette hold.");
        } else {
          setActionError(error.message);
        }
        return;
      }

      const row = data as TeamCoachRow;
      setTeamCoachLinks((prev) => [...prev, row]);
    },
    [activeTeamId, teamCoachLinks, teamById],
  );

  const removeTeamCoach = useCallback(async (link: TeamCoachRow) => {
    setActionError(null);
    setBusy(true);
    const { error } = await supabase.from("team_coaches").delete().eq("id", link.id);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setTeamCoachLinks((prev) => prev.filter((x) => x.id !== link.id));
  }, []);

  const toggleTeamCollapsed = useCallback((teamId: string) => {
    setCollapsedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  const saveTeamNickname = useCallback(
    async (teamId: string) => {
      const t = teams.find((x) => x.id === teamId);
      if (!t) return;
      const rawDraft = nicknameDrafts[teamId];
      const draftTrim = rawDraft !== undefined ? rawDraft.trim() : (t.nickname ?? "").trim();
      const normalizedNext = draftTrim === "" ? null : draftTrim;
      const normalizedCurrent = (t.nickname ?? "").trim() || null;
      if (normalizedCurrent === normalizedNext) return;

      setActionError(null);
      setBusy(true);
      const { error } = await supabase.from("teams").update({ nickname: normalizedNext }).eq("id", teamId);
      setBusy(false);
      if (error) {
        setActionError(
          error.message.includes("column")
            ? "Database mangler kolonnen «nickname» — kør migration i Supabase."
            : error.message,
        );
        return;
      }
      setTeams((prev) => prev.map((x) => (x.id === teamId ? { ...x, nickname: normalizedNext } : x)));
      setNicknameDrafts((prev) => {
        const copy = { ...prev };
        delete copy[teamId];
        return copy;
      });
    },
    [teams, nicknameDrafts],
  );

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
    setTeams((prev) => sortTeamsForDisplay(prev.map((x) => (x.id === team.id ? { ...x, is_completed: next } : x))));
    setCollapsedTeamIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(team.id);
      else s.delete(team.id);
      return s;
    });
    setClosedTeamDetailOpen((prev) => {
      const copy = { ...prev };
      delete copy[team.id];
      return copy;
    });
  }, []);

  const createTeam = useCallback(async () => {
    setActionError(null);
    const maxSort = teams.length ? Math.max(...teams.map((t) => t.sort_order)) : 0;
    const name = nextDefaultTeamName(canonical, teams);
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
      .select("id, event_id, pool_id, name, nickname, level, sort_order, is_completed")
      .single();
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    const t = data as TeamRow;
    setTeams((prev) => sortTeamsForDisplay([...prev, t]));
    setActiveTeamId(t.id);
  }, [teams, canonical, sortTeamsForDisplay]);

  const deleteTeam = useCallback(
    async (team: TeamRow) => {
      const tMemberRows = members.filter((m) => m.team_id === team.id);
      const tCoachRows = teamCoachLinks.filter((tc) => tc.team_id === team.id);
      const poolNote = team.pool_id
        ? "\n\nHoldet er placeret i en pulje under Turnering — det fjernes derfra."
        : "";
      const ok = window.confirm(
        `Slet «${team.name}»?${poolNote}\n\n` +
          `${tMemberRows.length} ${tMemberRows.length === 1 ? "spiller" : "spillere"} og ` +
          `${tCoachRows.length} ${tCoachRows.length === 1 ? "træner" : "trænere"} fjernes fra holdet ` +
          `(kan tildeles andre hold bagefter). Genererede kampe med holdet slettes. ` +
          `Dette kan ikke fortrydes.`,
      );
      if (!ok) return;

      setActionError(null);
      setBusy(true);

      const { error: matchErr } = await supabase
        .from("matches")
        .delete()
        .eq("event_id", HOLD_EVENT_ID)
        .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`);
      if (matchErr) {
        setBusy(false);
        setActionError(matchErr.message);
        return;
      }

      const { error: membersErr } = await supabase.from("team_members").delete().eq("team_id", team.id);
      if (membersErr) {
        setBusy(false);
        setActionError(membersErr.message);
        return;
      }

      const { error: coachesErr } = await supabase.from("team_coaches").delete().eq("team_id", team.id);
      if (coachesErr) {
        setBusy(false);
        setActionError(coachesErr.message);
        return;
      }

      const { error: teamErr } = await supabase.from("teams").delete().eq("id", team.id);
      setBusy(false);
      if (teamErr) {
        setActionError(teamErr.message);
        return;
      }

      const freedPlayerIds = tMemberRows.map((m) => m.player_id);
      setTeams((prev) => {
        const next = sortTeamsForDisplay(prev.filter((x) => x.id !== team.id));
        if (activeTeamId === team.id) {
          setActiveTeamId(next[0]?.id ?? null);
        }
        return next;
      });
      setMembers((prev) => prev.filter((m) => m.team_id !== team.id));
      setTeamCoachLinks((prev) => prev.filter((tc) => tc.team_id !== team.id));
      setAssignedGlobally((prev) => {
        const next = new Set(prev);
        for (const pid of freedPlayerIds) next.delete(pid);
        return next;
      });
      setCollapsedTeamIds((prev) => {
        const s = new Set(prev);
        s.delete(team.id);
        return s;
      });
      setClosedTeamDetailOpen((prev) => {
        const copy = { ...prev };
        delete copy[team.id];
        return copy;
      });
      setNicknameDrafts((prev) => {
        const copy = { ...prev };
        delete copy[team.id];
        return copy;
      });
    },
    [members, teamCoachLinks, activeTeamId, sortTeamsForDisplay],
  );

  type TeamListItem = { kind: "team"; team: TeamRow } | { kind: "header" };

  const teamListItems = useMemo((): TeamListItem[] => {
    const items: TeamListItem[] = openTeams.map((team) => ({ kind: "team", team }));
    if (closedTeams.length > 0) {
      items.push({ kind: "header" });
      for (const team of closedTeams) {
        items.push({ kind: "team", team });
      }
    }
    return items;
  }, [openTeams, closedTeams]);

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
          <div
            className="flex shrink-0 gap-2 border-b border-gray-200 pb-3 dark:border-gray-600"
            role="tablist"
            aria-label="Vælg liste"
          >
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === "spillere"}
              onClick={() => setLeftTab("spillere")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                leftTab === "spillere"
                  ? "bg-teal-50 text-[#0f766e] ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60"
              }`}
            >
              Spillere
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === "traenere"}
              onClick={() => setLeftTab("traenere")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                leftTab === "traenere"
                  ? "bg-teal-50 text-[#0f766e] ring-1 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60"
              }`}
            >
              Trænere
            </button>
          </div>

          {leftTab === "spillere" ? (
            <>
              <h2 className="mt-4 shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Spillere
              </h2>
              <p className="mt-1 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                Klik på en spiller for at tilføje til det aktive hold (
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {activeTeamId ? activeTeamName : "vælg hold"}
                </span>
                ).
              </p>
              {activeTeamId ? (
                <div className="mt-2 shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 shadow-sm dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100">
                  Aktivt hold: {activeTeamName} · Spillere tilføjes her
                  {activeTeamNickname ? (
                    <span className="ml-1 font-medium text-teal-800/90 dark:text-teal-200/90">
                      · Kaldenavn: {activeTeamNickname}
                    </span>
                  ) : null}
                </div>
              ) : null}

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
                      <option value="Klar på alt">Klar på alt</option>
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
                  Boolean(activeTeamId) &&
                  !assignedGlobally.has(p.id) &&
                  !busy &&
                  !activeTeamIsClosed;

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
            </>
          ) : (
            <>
              <h2 className="mt-4 shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Trænere
              </h2>
              <p className="mt-1 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                Klik på en træner for at tilføje til det aktive hold (
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {activeTeamId ? activeTeamName : "vælg hold"}
                </span>
                ).
              </p>
              {activeTeamId ? (
                <div className="mt-2 shrink-0 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 shadow-sm dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100">
                  Aktivt hold: {activeTeamName} · Trænere tilføjes her
                  {activeTeamNickname ? (
                    <span className="ml-1 font-medium text-teal-800/90 dark:text-teal-200/90">
                      · Kaldenavn: {activeTeamNickname}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 shrink-0 space-y-3">
                <div>
                  <label
                    htmlFor="holddannelse-coach-search"
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
                      id="holddannelse-coach-search"
                      type="search"
                      placeholder="Navn på træner…"
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      value={coachSearch}
                      onChange={(e) => setCoachSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="holddannelse-coach-club"
                    className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Klub
                  </label>
                  <StyledSelect
                    id="holddannelse-coach-club"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    value={clubFilter}
                    onChange={(e) => setClubFilter(e.target.value)}
                  >
                    <option value="">Alle klubber</option>
                    {coachClubOptions.map((club) => (
                      <option key={club} value={club}>
                        {club}
                      </option>
                    ))}
                  </StyledSelect>
                </div>
              </div>

              <label className="mt-3 flex shrink-0 cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  checked={onlyUnassignedCoaches}
                  onChange={(e) => setOnlyUnassignedCoaches(e.target.checked)}
                />
                Kun trænere uden hold
              </label>

              <ul className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1 max-lg:max-h-[min(520px,65vh)] lg:flex-1">
                {filteredCoaches.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                    {coaches.length === 0
                      ? "Ingen trænere registreret for dette arrangement."
                      : "Ingen trænere matcher filtrene."}
                  </li>
                ) : (
                  filteredCoaches.map((c) => {
                    const onActive =
                      Boolean(activeTeamId) &&
                      teamCoachLinks.some((tc) => tc.team_id === activeTeamId && tc.coach_id === c.id);
                    const assignedElsewhere = coachIdsOnAnyTeamInEvent.has(c.id) && !onActive;
                    const canClick =
                      Boolean(activeTeamId) &&
                      !onActive &&
                      !assignedElsewhere &&
                      !busy &&
                      !activeTeamIsClosed;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          disabled={!canClick}
                          onClick={() => void addCoachToActiveTeam(c.id)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            canClick
                              ? "cursor-pointer border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50/50 dark:border-gray-600 dark:bg-gray-900/50 dark:hover:border-teal-600 dark:hover:bg-teal-950/20"
                              : "cursor-not-allowed border-gray-100 bg-gray-50/80 opacity-80 dark:border-gray-700 dark:bg-gray-800/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                            {onActive ? (
                              <span
                                title="Træneren er allerede på dette hold."
                                className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                              >
                                På dette hold
                              </span>
                            ) : null}
                            {assignedElsewhere ? (
                              <span
                                title="Træneren er allerede tildelt et andet hold."
                                className="rounded-full bg-gray-200 px-2 py-0.5 text-[0.6875rem] font-medium text-gray-800 dark:bg-gray-600 dark:text-gray-100"
                              >
                                Tildelt andet hold
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                            <span>{c.home_club?.trim() || "—"}</span>
                            <span className="tabular-nums">
                              {c.age != null && !Number.isNaN(c.age) ? `${c.age} år` : "Alder —"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </>
          )}
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
          {activeTeamId ? (
            <div className="shrink-0 rounded-xl border-2 border-teal-400 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-900 shadow-sm dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-100">
              Valgt hold: {activeTeamName}
              {activeTeamNickname ? (
                <span className="ml-2 font-medium text-teal-800/90 dark:text-teal-200/90">
                  (Kaldenavn: {activeTeamNickname})
                </span>
              ) : null}
            </div>
          ) : null}

          {teams.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
              Ingen hold endnu. Klik &quot;Opret hold&quot; for at starte.
            </p>
          ) : (
            <ul className="space-y-3">
              {teamListItems.map((item) => {
                if (item.kind === "header") {
                  return (
                    <li key="_lukkede-hold-header" className="list-none pt-1">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Lukkede Hold
                      </p>
                    </li>
                  );
                }
                const t = item.team;
                const tMembers = membersByTeam.get(t.id) ?? [];
                const tCoaches = coachesByTeam.get(t.id) ?? [];
                const ids = tMembers.map((m) => m.player_id);
                const { avgAge, clubCount } = teamStatsForMembers(ids, playerById);
                const active = t.id === activeTeamId;
                const collapsed = collapsedTeamIds.has(t.id);
                const completed = teamIsCompleted(t);
                const closedDetailOpen = closedTeamDetailOpen[t.id] === true;

                const cardClass = completed
                  ? active
                    ? "border-emerald-200 bg-emerald-50/95 ring-2 ring-teal-500/30 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:ring-teal-500/25"
                    : "border-emerald-200 bg-emerald-50/95 dark:border-emerald-800/60 dark:bg-emerald-950/35"
                  : active
                    ? "border-teal-500 ring-2 ring-teal-500/25 dark:border-teal-500"
                    : "border-lc-border dark:border-gray-700";

                function openClosedTeamDetail() {
                  setActiveTeamId(t.id);
                  setClosedTeamDetailOpen((p) => ({ ...p, [t.id]: true }));
                  setCollapsedTeamIds((prev) => {
                    const s = new Set(prev);
                    s.delete(t.id);
                    return s;
                  });
                }

                if (completed && !closedDetailOpen) {
                  const nick = teamNickname(t);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openClosedTeamDetail()}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-left shadow-sm transition hover:bg-emerald-100/90 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/50"
                      >
                        <span className="flex min-w-0 flex-1 items-start gap-2.5">
                          <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold text-emerald-950 dark:text-emerald-50">
                              {t.name}
                            </span>
                            {nick ? (
                              <span className="mt-0.5 block truncate text-xs text-emerald-800/90 dark:text-emerald-200/90">
                                Kaldenavn: {nick}
                              </span>
                            ) : null}
                            <span className="mt-0.5 block text-xs tabular-nums text-emerald-800/90 dark:text-emerald-200/90">
                              {tMembers.length} {tMembers.length === 1 ? "spiller" : "spillere"}
                              {tCoaches.length > 0
                                ? ` · ${tCoaches.length} ${tCoaches.length === 1 ? "træner" : "trænere"}`
                                : ""}
                              {avgAge != null ? ` · snit alder ${avgAge}` : ""}
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                }

                const outerLiClass = completed
                  ? `overflow-hidden rounded-xl border shadow-sm transition-colors dark:shadow-none ${
                      active
                        ? "border-teal-500 bg-teal-50/60 ring-4 ring-teal-500/35 shadow-[0_0_0_2px_rgba(20,184,166,0.2)] dark:border-teal-500 dark:bg-teal-950/20"
                        : "border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-gray-900/35"
                    }`
                  : `rounded-xl border bg-white p-3 shadow-sm transition-colors dark:bg-gray-900/35 sm:p-4 ${cardClass} ${
                      active
                        ? "ring-4 ring-teal-500/35 shadow-[0_0_0_2px_rgba(20,184,166,0.2)]"
                        : ""
                    }`;

                return (
                  <li key={t.id} className={outerLiClass}>
                    {completed ? (
                      <button
                        type="button"
                        onClick={() => {
                          setClosedTeamDetailOpen((p) => ({ ...p, [t.id]: false }));
                        }}
                        className="flex w-full items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/90 px-4 py-2.5 text-left text-sm font-medium text-emerald-900 transition hover:bg-emerald-100/90 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/55"
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          Hold lukket · klik for at folde sammen
                        </span>
                        <ChevronDown className="h-4 w-4 rotate-180 text-emerald-700 dark:text-emerald-300" aria-hidden />
                      </button>
                    ) : null}
                    <div className={completed ? "p-3 sm:p-4" : ""}>
                      {active ? (
                        <p className="mb-3 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-teal-900 dark:border-teal-700 dark:bg-teal-950/45 dark:text-teal-100">
                          Aktivt hold · Nye spillere/trænere placeres her
                        </p>
                      ) : null}
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
                              {teamNickname(t) ? (
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                  Kaldenavn: {teamNickname(t)}
                                </p>
                              ) : null}
                              <p
                                className={`mt-1 text-xs ${
                                  completed ? "text-emerald-800/90 dark:text-emerald-200/85" : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {tMembers.length} {tMembers.length === 1 ? "spiller" : "spillere"}
                                {tCoaches.length > 0
                                  ? ` · ${tCoaches.length} ${tCoaches.length === 1 ? "træner" : "trænere"}`
                                  : ""}
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
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void deleteTeam(t)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-800 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
                              >
                                Slet
                              </button>
                            </div>
                          </div>

                          {!collapsed ? (
                            <>
                              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-800/40">
                                <label
                                  htmlFor={`hold-kaldenavn-${t.id}`}
                                  className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                                >
                                  Holdets kaldenavn
                                </label>
                                <p className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                  Vises i LykkeCup 26-appen. Oversigten her bruger stadig det automatisk genererede
                                  holdnavn ovenfor.
                                </p>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <input
                                    id={`hold-kaldenavn-${t.id}`}
                                    type="text"
                                    value={nicknameDrafts[t.id] ?? t.nickname ?? ""}
                                    onChange={(e) =>
                                      setNicknameDrafts((d) => ({ ...d, [t.id]: e.target.value }))
                                    }
                                    placeholder="Valgfrit — fx holdets eget navn"
                                    disabled={busy}
                                    autoComplete="off"
                                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void saveTeamNickname(t.id)}
                                    className="shrink-0 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-900/40"
                                  >
                                    Gem kaldenavn
                                  </button>
                                </div>
                              </div>
                              {tMembers.length === 0 ? (
                                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
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
                              )}
                              <div
                                className={
                                  completed
                                    ? "mt-4 border-t border-emerald-100 pt-4 dark:border-emerald-900/45"
                                    : "mt-4 border-t border-gray-100 pt-4 dark:border-gray-700"
                                }
                              >
                                <p
                                  className={`text-xs font-semibold uppercase tracking-wide ${
                                    completed
                                      ? "text-emerald-800/90 dark:text-emerald-200/85"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  Trænere
                                </p>
                                {tCoaches.length === 0 ? (
                                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Ingen trænere på holdet endnu.
                                  </p>
                                ) : (
                                  <ul
                                    className={`mt-2 divide-y ${
                                      completed
                                        ? "divide-emerald-100 dark:divide-emerald-900/45"
                                        : "divide-gray-100 dark:divide-gray-700"
                                    }`}
                                  >
                                    {tCoaches.map((tc) => {
                                      const c = coachById.get(tc.coach_id);
                                      return (
                                        <li
                                          key={tc.id}
                                          className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                                        >
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                              {c?.name ?? tc.coach_id}
                                            </p>
                                            {c ? (
                                              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{c.home_club?.trim() || "—"}</span>
                                                <span className="tabular-nums">
                                                  {c.age != null && !Number.isNaN(c.age) ? `${c.age} år` : "Alder —"}
                                                </span>
                                              </div>
                                            ) : null}
                                          </div>
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void removeTeamCoach(tc)}
                                            className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-200"
                                          >
                                            Fjern
                                          </button>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
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
