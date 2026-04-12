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
export type AgeCountRow = { label: string; count: number };

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

/**
 * Aldersfordeling til diagram: ét trin pr. heltalsalder under 25, alle 25+ i én søjle.
 * Manglende eller ugyldig alder tælles som "Ukendt".
 */
export function playersByAgeBucket(players: DashboardPlayer[]): AgeCountRow[] {
  type Acc = { count: number; sortKey: number };
  const map = new Map<string, Acc>();

  function add(label: string, sortKey: number) {
    const cur = map.get(label);
    if (cur) cur.count += 1;
    else map.set(label, { count: 1, sortKey });
  }

  for (const p of players) {
    const raw = p.age;
    if (raw == null || Number.isNaN(Number(raw))) {
      add("Ukendt", 10_000);
      continue;
    }
    const age = Math.floor(Number(raw));
    if (age < 0 || age > 120) {
      add("Ukendt", 10_000);
      continue;
    }
    if (age >= 25) {
      add("25+", 25);
    } else {
      add(String(age), age);
    }
  }

  return Array.from(map.entries())
    .map(([label, { count, sortKey }]) => ({ label, count, sortKey }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ label, count }) => ({ label, count }));
}
