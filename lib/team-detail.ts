import type { HoldCoachRow, TeamCoachRow, TeamMemberRow, TeamRow } from "@/types/teams";

export type TeamPlayerLite = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
};

export type TeamPlayerView = {
  id: string;
  name: string;
  age: number | null;
  club: string | null;
};

export type TeamCoachView = {
  id: string;
  name: string;
  homeClub: string | null;
};

export type TeamDetailView = {
  teamName: string;
  nickname: string | null;
  players: TeamPlayerView[];
  coaches: TeamCoachView[];
};

export function playersForTeam(
  teamId: string,
  membersByTeam: Map<string, TeamMemberRow[]>,
  playerById: Map<string, TeamPlayerLite>,
): TeamPlayerView[] {
  const list: TeamPlayerView[] = [];
  for (const m of membersByTeam.get(teamId) ?? []) {
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
  return list;
}

export function coachesForTeam(
  teamId: string,
  teamCoaches: readonly TeamCoachRow[],
  coachById: Map<string, HoldCoachRow>,
): TeamCoachView[] {
  const list: TeamCoachView[] = [];
  for (const link of teamCoaches) {
    if (link.team_id !== teamId) continue;
    const c = coachById.get(link.coach_id);
    if (!c) continue;
    list.push({
      id: c.id,
      name: c.name,
      homeClub: c.home_club?.trim() || null,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
  return list;
}

export function buildTeamDetail(
  team: TeamRow,
  membersByTeam: Map<string, TeamMemberRow[]>,
  playerById: Map<string, TeamPlayerLite>,
  teamCoaches: readonly TeamCoachRow[],
  coachById: Map<string, HoldCoachRow>,
): TeamDetailView {
  const nick = team.nickname?.trim();
  return {
    teamName: team.name,
    nickname: nick && nick.length > 0 ? nick : null,
    players: playersForTeam(team.id, membersByTeam, playerById),
    coaches: coachesForTeam(team.id, teamCoaches, coachById),
  };
}

export function teamDetailHasContent(detail: TeamDetailView): boolean {
  return detail.nickname != null || detail.players.length > 0 || detail.coaches.length > 0;
}

/** Fjern stjerner og alders-parentes fra autogenererede holdnavne (fx «CoolStars (4-17 år) * Hold 2»). */
export function stripParentheticalAgeRange(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/\s*\(\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*år\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Visningsnavn fra hold-række (kaldenavn ellers officielt navn uden stjerner/alders-parentes). */
export function kontrolCenterTeamDisplayNameFromRow(team: {
  name: string;
  nickname?: string | null;
}): string {
  const nick = team.nickname?.trim();
  if (nick) return nick;
  const official = team.name?.trim() ?? "";
  return stripParentheticalAgeRange(official) || official;
}

/** Primært visningsnavn i KontrolCenter: kaldenavn ellers officielt navn uden alders-parentes. */
export function kontrolCenterTeamDisplayName(detail: TeamDetailView): string {
  return kontrolCenterTeamDisplayNameFromRow({ name: detail.teamName, nickname: detail.nickname });
}

export function buildMembersByTeam(members: readonly TeamMemberRow[]): Map<string, TeamMemberRow[]> {
  const m = new Map<string, TeamMemberRow[]>();
  for (const member of members) {
    const list = m.get(member.team_id) ?? [];
    list.push(member);
    m.set(member.team_id, list);
  }
  return m;
}

export function buildPlayerById(players: readonly TeamPlayerLite[]): Map<string, TeamPlayerLite> {
  const m = new Map<string, TeamPlayerLite>();
  for (const p of players) m.set(p.id, p);
  return m;
}

export function buildCoachById(coaches: readonly HoldCoachRow[]): Map<string, HoldCoachRow> {
  const m = new Map<string, HoldCoachRow>();
  for (const c of coaches) m.set(c.id, c);
  return m;
}

export function buildTeamDetailsById(
  teams: readonly TeamRow[],
  members: readonly TeamMemberRow[],
  players: readonly TeamPlayerLite[],
  teamCoaches: readonly TeamCoachRow[],
  coaches: readonly HoldCoachRow[],
): Map<string, TeamDetailView> {
  const membersByTeam = buildMembersByTeam(members);
  const playerById = buildPlayerById(players);
  const coachById = buildCoachById(coaches);
  const m = new Map<string, TeamDetailView>();
  for (const t of teams) {
    m.set(t.id, buildTeamDetail(t, membersByTeam, playerById, teamCoaches, coachById));
  }
  return m;
}
