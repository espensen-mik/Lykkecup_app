import { normalizeLevelKey, rankLevelKeyForSorting } from "@/lib/holddannelse";
import type { Player } from "@/types/player";

export const UNKNOWN_CLUB_LABEL = "Uden klub";

export type ClubGroup = {
  /** Vist navn (trimmet klub eller UNKNOWN_CLUB_LABEL) */
  name: string;
  players: Player[];
};

/**
 * Grupperer spillere efter home_club (samme event som fetch).
 * Klubber sorteres A–Å; "Uden klub" til sidst.
 */
export function groupPlayersByClub(players: Player[]): ClubGroup[] {
  const map = new Map<string, Player[]>();

  for (const p of players) {
    const raw = p.home_club?.trim();
    const key = raw && raw.length > 0 ? raw : UNKNOWN_CLUB_LABEL;
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const ra = rankLevelKeyForSorting(normalizeLevelKey(a.level));
      const rb = rankLevelKeyForSorting(normalizeLevelKey(b.level));
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "da", { sensitivity: "base" });
    });
  }

  const groups = Array.from(map.entries()).map(([name, groupPlayers]) => ({
    name,
    players: groupPlayers,
  }));

  groups.sort((a, b) => {
    if (a.name === UNKNOWN_CLUB_LABEL) return 1;
    if (b.name === UNKNOWN_CLUB_LABEL) return -1;
    return a.name.localeCompare(b.name, "da");
  });

  return groups;
}
