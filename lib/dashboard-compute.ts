import type { DashboardPlayer } from "@/types/player";

export type KpiStats = {
  totalPlayers: number;
  uniqueClubs: number;
  levelCount: number;
  averageAge: number | null;
};

export function computeKpis(players: DashboardPlayer[]): KpiStats {
  const totalPlayers = players.length;

  const clubSet = new Set<string>();
  for (const p of players) {
    const c = p.home_club?.trim();
    if (c) clubSet.add(c);
  }

  const levelSet = new Set<string>();
  for (const p of players) {
    if (p.level != null && String(p.level).trim() !== "") {
      levelSet.add(String(p.level));
    }
  }

  const ages = players
    .map((p) => p.age)
    .filter((a): a is number => typeof a === "number" && !Number.isNaN(a));
  const averageAge =
    ages.length > 0
      ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10
      : null;

  return {
    totalPlayers,
    uniqueClubs: clubSet.size,
    levelCount: levelSet.size,
    averageAge,
  };
}

export type LevelCountRow = { name: string; count: number };
export type ClubCountRow = { club: string; count: number };
export type GenderSlice = { name: string; value: number };

export function playersPerLevel(players: DashboardPlayer[]): LevelCountRow[] {
  const map = new Map<string, number>();
  for (const p of players) {
    const key =
      p.level != null && String(p.level).trim() !== ""
        ? String(p.level)
        : "Ukendt";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "da", { numeric: true }));
}

export function topClubs(players: DashboardPlayer[], n: number): ClubCountRow[] {
  const map = new Map<string, number>();
  for (const p of players) {
    const c = p.home_club?.trim();
    if (!c) continue;
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([club, count]) => ({ club, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function genderDistribution(players: DashboardPlayer[]): GenderSlice[] {
  const map = new Map<string, number>();
  for (const p of players) {
    const g = p.gender?.trim();
    const key = g && g.length > 0 ? g : "Ikke angivet";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export function recentPlayers(
  players: DashboardPlayer[],
  limit: number,
): DashboardPlayer[] {
  return [...players]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.id.localeCompare(a.id);
    })
    .slice(0, limit);
}
