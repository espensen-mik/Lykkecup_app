/**
 * Presentation-only helpers for dashboard charts (no data fetching changes).
 */

/** Strip typical age-range parentheticals so X-axis stays short and horizontal. */
export function formatLevelChartLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return raw;
  let out = s.replace(/\s*\(\s*\d{1,2}\s*[-–]\s*\d{1,2}\s*år\s*\)/gi, "");
  out = out.replace(/\s*\([^)]*\d[^)]*år[^)]*\)/gi, "");
  out = out.replace(/\s+/g, " ").trim();
  return out || s;
}

/** Word-wrap for SVG multi-line Y-axis labels (full text preserved, no truncation). */
export function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const max = Math.max(8, maxCharsPerLine);
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > max) {
      if (current) {
        lines.push(current);
        current = "";
      }
      let rest = word;
      while (rest.length > max) {
        lines.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
      current = rest;
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= max) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
