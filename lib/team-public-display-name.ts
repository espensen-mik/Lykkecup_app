/** Offentligt visningsnavn i LykkeCup26: kun kaldenavn. */
export function publicTeamDisplayName(team: { name: string; nickname?: string | null }): string {
  const nick = team.nickname?.trim();
  if (nick) return nick;
  return "Hold uden kaldenavn";
}
