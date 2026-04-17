const SHORT_NAMES = [
  "COOLSTARS",
  "SUPERSTARS",
  "POWERSTARS",
  "TURBOSTARS",
  "JAZZ",
  "FUNK",
  "ROCK",
] as const;

/**
 * Eksempler:
 * - "FUNK (18-25 år)** Hold 4" -> "FUNK 4"
 * - "SUPERSTARS Hold 2" -> "SUPERSTARS 2"
 * - "ROCK" -> "ROCK"
 */
export function formatLc26TeamName(name: string): string {
  const raw = name.trim();
  if (!raw) return name;
  const upper = raw.toUpperCase();

  const base = SHORT_NAMES.find((n) => upper.includes(n));
  if (!base) return raw;

  const holdNum = raw.match(/(?:HOLD|TEAM)\s*(\d+)/i)?.[1] ?? raw.match(/\b(\d+)\b/)?.[1] ?? "";
  return holdNum ? `${base} ${holdNum}` : base;
}
