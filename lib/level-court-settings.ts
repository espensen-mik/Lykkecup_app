import type { CourtType, LevelCourtSettingLike } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel, levelSlugForPalette, rankLevelKeyForSorting } from "@/lib/holddannelse";

function rowMap(rows: readonly LevelCourtSettingLike[]): Map<string, CourtType> {
  const m = new Map<string, CourtType>();
  for (const r of rows) {
    m.set(canonicalBanerLevelLabel(r.level), r.court_type);
  }
  return m;
}

/**
 * LykkeCup 2026-style defaults when der ikke findes en DB-række:
 * lavere niveauer → mini, mellem → kort, seniorklasser → stor; ukendt → kort.
 */
export function defaultCourtTypeForLevel(levelKey: string): CourtType {
  const r = rankLevelKeyForSorting(levelKey);
  if (r === 10_000) return "kort";
  if (r >= 1000) return "kort";
  if (r <= 1) return "mini";
  if (r <= 3) return "kort";
  return "stor";
}

/** Resolved banetype for Regnemaskine og scheduler: eksplicit indstilling ellers default. */
export function courtTypeForLevel(levelKey: string, rows: readonly LevelCourtSettingLike[]): CourtType {
  const hit = rowMap(rows).get(canonicalBanerLevelLabel(levelKey));
  return hit ?? defaultCourtTypeForLevel(levelKey);
}

/** Standard runder pr. kamp: ROCK spiller to halvlege (2× runde à kampvarighed+pause). */
export function defaultRoundsPerMatchForLevel(levelKey: string): number {
  if (levelSlugForPalette(levelKey) === "rock") return 2;
  return 1;
}
