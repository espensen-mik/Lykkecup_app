import { supabase } from "@/lib/supabase";
import { formatLc26TeamName } from "@/lib/lc26-team-name";
import type { TeamRow } from "@/types/teams";

/** Offentlig LykkeCup 26-app — samme arrangement som KontrolCenter. */
export const LYKKECUP26_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

export type Lc26PlayerListRow = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
  level: string | null;
};

export type Lc26TeamOption = {
  id: string;
  name: string;
  level: string | null;
  sort_order: number;
};

export type Lc26TeamMemberLink = {
  player_id: string;
  team_id: string;
};

export type Lc26HomeBundle = {
  players: Lc26PlayerListRow[];
  coaches: Lc26HomeCoachRow[];
  teams: Lc26TeamOption[];
  members: Lc26TeamMemberLink[];
  error: string | null;
};

export type Lc26HomeCoachRow = {
  id: string;
  name: string;
  home_club: string | null;
  team_names: string[];
};

export async function fetchLykkecup26HomeData(): Promise<Lc26HomeBundle> {
  const eventId = LYKKECUP26_EVENT_ID;

  const [playersRes, teamsRes, membersRes, coachesRes, teamCoachRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, home_club, age, level")
      .eq("event_id", eventId)
      .order("name", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name, level, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("team_members").select("player_id, team_id").eq("event_id", eventId),
    supabase.from("coaches").select("id, name, home_club").eq("event_id", eventId).order("name", { ascending: true }),
    supabase.from("team_coaches").select("coach_id, team_id").eq("event_id", eventId),
  ]);

  const err =
    playersRes.error?.message ??
    teamsRes.error?.message ??
    membersRes.error?.message ??
    coachesRes.error?.message ??
    teamCoachRes.error?.message ??
    null;
  if (err) {
    return { players: [], coaches: [], teams: [], members: [], error: err };
  }

  const players = (playersRes.data ?? []) as Lc26PlayerListRow[];
  const teams = (teamsRes.data ?? []) as Lc26TeamOption[];
  const members = (membersRes.data ?? []) as Lc26TeamMemberLink[];
  const coachRows = (coachesRes.data ?? []) as { id: string; name: string; home_club: string | null }[];
  const tcRows = (teamCoachRes.data ?? []) as { coach_id: string; team_id: string }[];
  const teamNameById = new Map(teams.map((t) => [t.id, formatLc26TeamName(t.name)]));
  const teamNamesByCoach = new Map<string, Set<string>>();
  for (const link of tcRows) {
    const teamName = teamNameById.get(link.team_id);
    if (!teamName) continue;
    const set = teamNamesByCoach.get(link.coach_id) ?? new Set<string>();
    set.add(teamName);
    teamNamesByCoach.set(link.coach_id, set);
  }
  const coaches: Lc26HomeCoachRow[] = coachRows.map((c) => ({
    id: c.id,
    name: c.name,
    home_club: c.home_club,
    team_names: [...(teamNamesByCoach.get(c.id) ?? new Set<string>())].sort((a, b) =>
      a.localeCompare(b, "da", { sensitivity: "base" }),
    ),
  }));

  return { players, coaches, teams, members, error: null };
}

export type Lc26Teammate = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
};

export type Lc26Coach = {
  id: string;
  name: string;
  home_club: string | null;
};

export type Lc26PublicMatch = {
  id: string;
  opponentTeamName: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  courtName: string | null;
};

export type Lc26PlayerPageData = {
  player: Lc26PlayerListRow | null;
  team: TeamRow | null;
  teammates: Lc26Teammate[];
  coaches: Lc26Coach[];
  matches: Lc26PublicMatch[];
  error: string | null;
};

export type Lc26CoachPageData = {
  coach: Lc26Coach | null;
  teams: TeamRow[];
  error: string | null;
};

export async function fetchLykkecup26CoachPage(coachId: string): Promise<Lc26CoachPageData> {
  const eventId = LYKKECUP26_EVENT_ID;
  const { data: coachRow, error: cErr } = await supabase
    .from("coaches")
    .select("id, name, home_club")
    .eq("event_id", eventId)
    .eq("id", coachId)
    .maybeSingle();

  if (cErr) return { coach: null, teams: [], error: cErr.message };
  if (!coachRow) return { coach: null, teams: [], error: null };
  const coach = coachRow as Lc26Coach;

  const { data: links, error: lErr } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("coach_id", coachId);
  if (lErr) return { coach, teams: [], error: lErr.message };

  const teamIds = [...new Set((links ?? []).map((r: { team_id: string }) => r.team_id))];
  if (teamIds.length === 0) return { coach, teams: [], error: null };

  const { data: teamRows, error: tErr } = await supabase
    .from("teams")
    .select("id, event_id, pool_id, name, level, sort_order, is_completed")
    .eq("event_id", eventId)
    .in("id", teamIds)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (tErr) return { coach, teams: [], error: tErr.message };

  return {
    coach,
    teams: ((teamRows ?? []) as TeamRow[]).map((t) => ({ ...t, name: formatLc26TeamName(t.name) })),
    error: null,
  };
}

export async function fetchLykkecup26PlayerPage(playerId: string): Promise<Lc26PlayerPageData> {
  const eventId = LYKKECUP26_EVENT_ID;

  const { data: playerRow, error: pErr } = await supabase
    .from("players")
    .select("id, name, home_club, age, level")
    .eq("event_id", eventId)
    .eq("id", playerId)
    .maybeSingle();

  if (pErr) {
    return {
      player: null,
      team: null,
      teammates: [],
      coaches: [],
      matches: [],
      error: pErr.message,
    };
  }

  if (!playerRow) {
    return {
      player: null,
      team: null,
      teammates: [],
      coaches: [],
      matches: [],
      error: null,
    };
  }

  const player = playerRow as Lc26PlayerListRow;

  const { data: memRow, error: mErr } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (mErr || !memRow?.team_id) {
    return { player, team: null, teammates: [], coaches: [], matches: [], error: mErr?.message ?? null };
  }

  const teamId = memRow.team_id;

  const { data: teamRow, error: tErr } = await supabase
    .from("teams")
    .select("id, event_id, pool_id, name, level, sort_order, is_completed")
    .eq("id", teamId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (tErr || !teamRow) {
    return { player, team: null, teammates: [], coaches: [], matches: [], error: tErr?.message ?? null };
  }

  const team = { ...(teamRow as TeamRow), name: formatLc26TeamName((teamRow as TeamRow).name) };

  const { data: allMembers, error: memErr } = await supabase
    .from("team_members")
    .select("player_id")
    .eq("event_id", eventId)
    .eq("team_id", teamId);

  if (memErr) {
    return { player, team, teammates: [], coaches: [], matches: [], error: memErr.message };
  }

  const mateIds = (allMembers ?? []).map((r: { player_id: string }) => r.player_id);
  let teammates: Lc26Teammate[] = [];
  if (mateIds.length > 0) {
    const { data: matePlayers, error: mpErr } = await supabase
      .from("players")
      .select("id, name, home_club, age")
      .eq("event_id", eventId)
      .in("id", mateIds);

    if (!mpErr && matePlayers) {
      teammates = (matePlayers as { id: string; name: string; home_club: string | null; age: number | null }[])
        .map((p) => ({
          id: p.id,
          name: p.name,
          home_club: p.home_club,
          age: p.age,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    }
  }

  const { data: tcRows, error: tcErr } = await supabase
    .from("team_coaches")
    .select("coach_id")
    .eq("event_id", eventId)
    .eq("team_id", teamId);

  let coaches: Lc26Coach[] = [];
  if (!tcErr && tcRows?.length) {
    const cids = [...new Set(tcRows.map((r: { coach_id: string }) => r.coach_id))];
    const { data: coachRows } = await supabase
      .from("coaches")
      .select("id, name, home_club")
      .eq("event_id", eventId)
      .in("id", cids);
    if (coachRows) {
      coaches = (coachRows as Lc26Coach[])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    }
  }

  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, court_id, start_time, end_time")
    .eq("event_id", eventId)
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  let matches: Lc26PublicMatch[] = [];
  if (!matchErr && matchRows?.length) {
    const { data: allTeams } = await supabase.from("teams").select("id, name").eq("event_id", eventId);
    const nameById = new Map<string, string>();
    for (const t of (allTeams ?? []) as { id: string; name: string }[]) {
      nameById.set(t.id, formatLc26TeamName(t.name));
    }

    const courtIds = [...new Set(matchRows.map((m: { court_id: string | null }) => m.court_id).filter(Boolean))] as string[];

    const courtMap = new Map<string, { name: string; venue_id: string }>();
    const venueMap = new Map<string, string>();

    if (courtIds.length > 0) {
      const { data: courts } = await supabase.from("courts").select("id, name, venue_id").in("id", courtIds);
      const vids = [...new Set((courts ?? []).map((c: { venue_id: string }) => c.venue_id))];
      for (const c of (courts ?? []) as { id: string; name: string; venue_id: string }[]) {
        courtMap.set(c.id, { name: c.name, venue_id: c.venue_id });
      }
      if (vids.length > 0) {
        const { data: venues } = await supabase.from("venues").select("id, name").eq("event_id", eventId).in("id", vids);
        for (const v of (venues ?? []) as { id: string; name: string }[]) {
          venueMap.set(v.id, v.name);
        }
      }
    }

    matches = (matchRows as {
      id: string;
      team_a_id: string;
      team_b_id: string;
      court_id: string | null;
      start_time: string | null;
      end_time: string | null;
    }[]).map((row) => {
      const oppId = row.team_a_id === teamId ? row.team_b_id : row.team_a_id;
      const opponentTeamName = nameById.get(oppId) ?? "Hold";
      let courtName: string | null = null;
      let venueName: string | null = null;
      if (row.court_id && courtMap.has(row.court_id)) {
        const c = courtMap.get(row.court_id)!;
        courtName = c.name;
        venueName = venueMap.get(c.venue_id) ?? null;
      }
      return {
        id: row.id,
        opponentTeamName,
        startTime: row.start_time,
        endTime: row.end_time,
        venueName,
        courtName,
      };
    });

    matches.sort((a, b) => {
      const ta = a.startTime ? new Date(a.startTime).getTime() : 0;
      const tb = b.startTime ? new Date(b.startTime).getTime() : 0;
      return ta - tb;
    });
  }

  return { player, team, teammates, coaches, matches, error: null };
}
