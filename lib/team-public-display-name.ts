import { formatLc26TeamName } from "@/lib/lc26-team-name";
import { stripParentheticalAgeRange } from "@/lib/team-detail";

/** Offentligt visningsnavn i LykkeCup26: kaldenavn, ellers forkortet autogenereret navn (fx «TurboStars 3»). */
export function publicTeamDisplayName(team: { name: string; nickname?: string | null }): string {
  const nick = team.nickname?.trim();
  if (nick) return nick;

  const official = team.name?.trim() ?? "";
  if (!official) return "Hold";

  const shortened = formatLc26TeamName(official);
  if (shortened !== official) return shortened;

  return stripParentheticalAgeRange(official) || official;
}
