import { formatLc26TeamName } from "@/lib/lc26-team-name";

/** Navn vist i LykkeCup 26-appen: kaldenavn hvis sat, ellers forkortet officielt navn. */
export function publicTeamDisplayName(team: { name: string; nickname?: string | null }): string {
  const nick = team.nickname?.trim();
  if (nick) return nick;
  return formatLc26TeamName(team.name);
}
