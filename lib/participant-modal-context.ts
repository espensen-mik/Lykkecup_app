import type { SupabaseClient } from "@supabase/supabase-js";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { kontrolCenterTeamDisplayNameFromRow } from "@/lib/team-detail";

export type ParticipantPerson = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
};

export type ParticipantCoach = {
  id: string;
  name: string;
  home_club: string | null;
};

export type ParticipantTeamSummary = {
  teamId: string;
  levelKey: string;
  displayName: string;
  officialName: string;
};

export type ParticipantScheduledMatch = {
  id: string;
  ownTeamName: string | null;
  opponentTeamName: string;
  startTime: string | null;
  courtName: string | null;
  venueName: string | null;
};

export type ParticipantTeamRoster = {
  teamId: string;
  players: ParticipantPerson[];
  coaches: ParticipantCoach[];
};

export type PlayerParticipantContext = {
  teammates: ParticipantPerson[];
  coaches: ParticipantCoach[];
  matches: ParticipantScheduledMatch[];
  error: string | null;
};

export type CoachParticipantContext = {
  teams: ParticipantTeamSummary[];
  teamRosters: ParticipantTeamRoster[];
  matches: ParticipantScheduledMatch[];
  error: string | null;
};

function teamDisplayNames(row: { name: string; nickname?: string | null }): {
  displayName: string;
  officialName: string;
} {
  const officialName = row.name?.trim() ?? "";
  const displayName = kontrolCenterTeamDisplayNameFromRow({
    name: officialName,
    nickname: row.nickname,
  });
  return { displayName, officialName };
}

async function loadCourtVenueMaps(
  supabase: SupabaseClient,
  eventId: string,
  courtIds: string[],
): Promise<Map<string, { name: string; venue_id: string }>> {
  const courtMap = new Map<string, { name: string; venue_id: string }>();
  if (courtIds.length === 0) return courtMap;

  const { data: courts, error: courtsErr } = await supabase
    .from("courts")
    .select("id, name, venue_id, event_id")
    .in("id", courtIds);
  if (courtsErr || !courts) return courtMap;

  for (const c of courts as { id: string; name: string; venue_id: string; event_id?: string | null }[]) {
    if (c.event_id && c.event_id !== eventId) continue;
    courtMap.set(c.id, { name: c.name, venue_id: c.venue_id });
  }
  return courtMap;
}

async function loadVenueMap(
  supabase: SupabaseClient,
  eventId: string,
  venueIds: string[],
): Promise<Map<string, string>> {
  const venueMap = new Map<string, string>();
  if (venueIds.length === 0) return venueMap;

  const { data: venues } = await supabase.from("venues").select("id, name").eq("event_id", eventId).in("id", venueIds);
  for (const v of (venues ?? []) as { id: string; name: string }[]) {
    venueMap.set(v.id, v.name);
  }
  return venueMap;
}

async function buildMatchesForTeamIds(
  supabase: SupabaseClient,
  eventId: string,
  teamIds: string[],
  ownTeamNameById: Map<string, string>,
): Promise<{ matches: ParticipantScheduledMatch[]; error: string | null }> {
  if (teamIds.length === 0) return { matches: [], error: null };

  const teamIdSet = new Set(teamIds);
  const orFilter = teamIds.map((id) => `team_a_id.eq.${id},team_b_id.eq.${id}`).join(",");

  const { data: matchRows, error: matchErr } = await supabase
    .from("matches")
    .select("id, team_a_id, team_b_id, court_id, start_time, end_time")
    .eq("event_id", eventId)
    .or(orFilter);

  if (matchErr) return { matches: [], error: matchErr.message };
  if (!matchRows?.length) return { matches: [], error: null };

  const allTeamIds = new Set<string>(teamIds);
  for (const row of matchRows as { team_a_id: string; team_b_id: string }[]) {
    allTeamIds.add(row.team_a_id);
    allTeamIds.add(row.team_b_id);
  }

  const nameById = new Map<string, string>(ownTeamNameById);
  const missingIds = [...allTeamIds].filter((id) => !nameById.has(id));
  if (missingIds.length > 0) {
    const { data: allTeams } = await supabase
      .from("teams")
      .select("id, name, nickname")
      .eq("event_id", eventId)
      .in("id", missingIds);
    for (const t of (allTeams ?? []) as { id: string; name: string; nickname?: string | null }[]) {
      nameById.set(t.id, teamDisplayNames(t).displayName);
    }
  }

  const courtIds = [
    ...new Set((matchRows ?? []).map((m: { court_id: string | null }) => m.court_id).filter(Boolean)),
  ] as string[];
  const courtMap = await loadCourtVenueMaps(supabase, eventId, courtIds);
  const venueIds = [...new Set([...courtMap.values()].map((c) => c.venue_id))];
  const venueMap = await loadVenueMap(supabase, eventId, venueIds);

  const matches = (matchRows as {
    id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
    end_time: string | null;
  }[])
    .map((row) => {
      const ownTeamId = teamIdSet.has(row.team_a_id)
        ? row.team_a_id
        : teamIdSet.has(row.team_b_id)
          ? row.team_b_id
          : null;
      if (!ownTeamId) return null;
      const oppId = ownTeamId === row.team_a_id ? row.team_b_id : row.team_a_id;
      const opponentTeamName = nameById.get(oppId);
      if (!opponentTeamName) return null;

      let courtName: string | null = null;
      let venueName: string | null = null;
      if (row.court_id && courtMap.has(row.court_id)) {
        const c = courtMap.get(row.court_id)!;
        courtName = c.name;
        venueName = venueMap.get(c.venue_id) ?? null;
      }

      return {
        id: row.id,
        ownTeamName: ownTeamNameById.get(ownTeamId) ?? nameById.get(ownTeamId) ?? null,
        opponentTeamName,
        startTime: row.start_time,
        courtName,
        venueName,
      } satisfies ParticipantScheduledMatch;
    })
    .filter((m): m is ParticipantScheduledMatch => m !== null)
    .sort((a, b) => {
      const ta = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return (a.ownTeamName ?? "").localeCompare(b.ownTeamName ?? "", "da", { sensitivity: "base" });
    });

  return { matches, error: null };
}

/** Holdkammerater, trænere og kampprogram for en spiller (KontrolCenter-modal). */
export async function fetchPlayerParticipantContext(
  supabase: SupabaseClient,
  playerId: string,
  teamId: string | null,
): Promise<PlayerParticipantContext> {
  if (!teamId) {
    return { teammates: [], coaches: [], matches: [], error: null };
  }

  const eventId = LYKKECUP_EVENT_ID;

  const [{ data: allMembers, error: memErr }, { data: tcRows, error: tcErr }, { data: teamRow }] = await Promise.all([
    supabase.from("team_members").select("player_id").eq("event_id", eventId).eq("team_id", teamId),
    supabase.from("team_coaches").select("coach_id").eq("event_id", eventId).eq("team_id", teamId),
    supabase.from("teams").select("id, name, nickname, level").eq("event_id", eventId).eq("id", teamId).maybeSingle(),
  ]);

  if (memErr) return { teammates: [], coaches: [], matches: [], error: memErr.message };

  const mateIds = (allMembers ?? []).map((r: { player_id: string }) => r.player_id);
  let teammates: ParticipantPerson[] = [];
  if (mateIds.length > 0) {
    const { data: matePlayers, error: mpErr } = await supabase
      .from("players")
      .select("id, name, home_club, age")
      .eq("event_id", eventId)
      .in("id", mateIds);
    if (mpErr) return { teammates: [], coaches: [], matches: [], error: mpErr.message };
    teammates = ((matePlayers ?? []) as ParticipantPerson[]).sort((a, b) =>
      a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
    );
  }

  let coaches: ParticipantCoach[] = [];
  if (!tcErr && tcRows?.length) {
    const cids = [...new Set(tcRows.map((r: { coach_id: string }) => r.coach_id))];
    const { data: coachRows, error: cErr } = await supabase
      .from("coaches")
      .select("id, name, home_club")
      .eq("event_id", eventId)
      .in("id", cids);
    if (cErr) return { teammates, coaches: [], matches: [], error: cErr.message };
    coaches = ((coachRows ?? []) as ParticipantCoach[]).sort((a, b) =>
      a.name.localeCompare(b.name, "da", { sensitivity: "base" }),
    );
  }

  const ownTeamNameById = new Map<string, string>();
  if (teamRow) {
    const names = teamDisplayNames(teamRow as { name: string; nickname?: string | null });
    ownTeamNameById.set(teamId, names.displayName);
  }

  const { matches, error: matchError } = await buildMatchesForTeamIds(supabase, eventId, [teamId], ownTeamNameById);

  return { teammates, coaches, matches, error: matchError };
}

/** Hold, spillere, trænere og kampprogram for en træner (KontrolCenter-modal). */
export async function fetchCoachParticipantContext(
  supabase: SupabaseClient,
  coachId: string,
): Promise<CoachParticipantContext> {
  const eventId = LYKKECUP_EVENT_ID;

  const { data: links, error: lErr } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("event_id", eventId)
    .eq("coach_id", coachId);

  if (lErr) return { teams: [], teamRosters: [], matches: [], error: lErr.message };

  const teamIds = [...new Set((links ?? []).map((r: { team_id: string }) => r.team_id))];
  if (teamIds.length === 0) {
    return { teams: [], teamRosters: [], matches: [], error: null };
  }

  const { data: teamRows, error: tErr } = await supabase
    .from("teams")
    .select("id, name, nickname, level, sort_order")
    .eq("event_id", eventId)
    .in("id", teamIds)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (tErr) return { teams: [], teamRosters: [], matches: [], error: tErr.message };

  const teams: ParticipantTeamSummary[] = ((teamRows ?? []) as {
    id: string;
    name: string;
    nickname?: string | null;
    level: string | null;
  }[]).map((t) => {
    const { displayName, officialName } = teamDisplayNames(t);
    return {
      teamId: t.id,
      levelKey: t.level?.trim() || "Ukendt niveau",
      displayName,
      officialName,
    };
  });

  const ownTeamNameById = new Map(teams.map((t) => [t.teamId, t.displayName] as const));

  const [{ data: memberRows, error: memberErr }, { data: teamCoachRows, error: teamCoachErr }] = await Promise.all([
    supabase.from("team_members").select("team_id, player_id").eq("event_id", eventId).in("team_id", teamIds),
    supabase.from("team_coaches").select("team_id, coach_id").eq("event_id", eventId).in("team_id", teamIds),
  ]);

  if (memberErr) return { teams, teamRosters: [], matches: [], error: memberErr.message };
  if (teamCoachErr) return { teams, teamRosters: [], matches: [], error: teamCoachErr.message };

  const memberLinks = (memberRows ?? []) as { team_id: string; player_id: string }[];
  const coachLinks = (teamCoachRows ?? []) as { team_id: string; coach_id: string }[];
  const playerIds = [...new Set(memberLinks.map((row) => row.player_id))];
  const coachIds = [...new Set(coachLinks.map((row) => row.coach_id))];

  const [playersRes, coachesRes] = await Promise.all([
    playerIds.length > 0
      ? supabase.from("players").select("id, name, home_club, age").eq("event_id", eventId).in("id", playerIds)
      : Promise.resolve({ data: [] as ParticipantPerson[], error: null }),
    coachIds.length > 0
      ? supabase.from("coaches").select("id, name, home_club").eq("event_id", eventId).in("id", coachIds)
      : Promise.resolve({ data: [] as ParticipantCoach[], error: null }),
  ]);

  if (playersRes.error) return { teams, teamRosters: [], matches: [], error: playersRes.error.message };
  if (coachesRes.error) return { teams, teamRosters: [], matches: [], error: coachesRes.error.message };

  const playerById = new Map(((playersRes.data ?? []) as ParticipantPerson[]).map((p) => [p.id, p]));
  const coachById = new Map(((coachesRes.data ?? []) as ParticipantCoach[]).map((c) => [c.id, c]));

  const teamRosters: ParticipantTeamRoster[] = teamIds.map((tid) => {
    const players = memberLinks
      .filter((row) => row.team_id === tid)
      .map((row) => playerById.get(row.player_id))
      .filter((p): p is ParticipantPerson => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    const coaches = coachLinks
      .filter((row) => row.team_id === tid)
      .map((row) => coachById.get(row.coach_id))
      .filter((c): c is ParticipantCoach => Boolean(c))
      .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
    return { teamId: tid, players, coaches };
  });

  const { matches, error: matchError } = await buildMatchesForTeamIds(
    supabase,
    eventId,
    teamIds,
    ownTeamNameById,
  );

  return { teams, teamRosters, matches, error: matchError };
}
