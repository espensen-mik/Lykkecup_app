const SHORT_NAMES = [
  "COOLSTARS",
  "SUPERSTARS",
  "POWERSTARS",
  "TURBOSTARS",
  "JAZZ",
  "FUNK",
  "ROCK",
] as const;

type ShortName = (typeof SHORT_NAMES)[number];

const BRAND_LABELS: Record<ShortName, string> = {
  COOLSTARS: "CoolStars",
  SUPERSTARS: "SuperStars",
  POWERSTARS: "PowerStars",
  TURBOSTARS: "TurboStars",
  JAZZ: "Jazz",
  FUNK: "Funk",
  ROCK: "Rock",
};

/**
 * Eksempler:
 * - "FUNK (18-25 år)** Hold 4" -> "Funk 4"
 * - "TurboStars (4-17 år) * Hold 3" -> "TurboStars 3"
 * - "ROCK" -> "Rock"
 */
export function formatLc26TeamName(name: string): string {
  const raw = name.trim();
  if (!raw) return name;
  const upper = raw.toUpperCase();

  const base = SHORT_NAMES.find((n) => upper.includes(n));
  if (!base) return raw;

  const label = BRAND_LABELS[base];
  const holdNum = raw.match(/(?:HOLD|TEAM)\s*(\d+)/i)?.[1] ?? raw.match(/\b(\d+)\b/)?.[1] ?? "";
  return holdNum ? `${label} ${holdNum}` : label;
}
