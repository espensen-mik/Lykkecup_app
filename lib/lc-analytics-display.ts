const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseAnalyticsDayParam(raw: string | undefined): string | null {
  if (!raw || !DAY_RE.test(raw)) return null;
  return raw;
}

/** I dag som YYYY-MM-DD i Europe/Copenhagen. */
export function todayIsoInCopenhagen(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatAnalyticsDayTitle(isoDay: string): string {
  const parts = isoDay.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return isoDay;
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(anchor);
}

export function addCalendarDaysIso(isoDay: string, deltaDays: number): string {
  const parts = isoDay.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return isoDay;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

export type HourlyViewPoint = { hour: number; views: number };

export function parseHourlyViewsPayload(raw: unknown): HourlyViewPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: HourlyViewPoint[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const hour = typeof o.hour === "number" ? o.hour : Number(o.hour);
    const views = typeof o.views === "number" ? o.views : Number(o.views);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23 && Number.isFinite(views)) {
      out.push({ hour, views: Math.max(0, views) });
    }
  }
  return out.sort((a, b) => a.hour - b.hour);
}

/** Altid 0–23 så Nivo får et stabilt datasæt. */
export function normalizeHourlyPoints(points: HourlyViewPoint[]): HourlyViewPoint[] {
  const byHour = new Map(points.map((p) => [p.hour, p.views]));
  return Array.from({ length: 24 }, (_, hr) => ({
    hour: hr,
    views: byHour.get(hr) ?? 0,
  }));
}
