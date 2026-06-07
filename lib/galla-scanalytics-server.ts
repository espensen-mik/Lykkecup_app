import type { SupabaseClient } from "@supabase/supabase-js";
import type { HourlyViewPoint } from "@/lib/lc-analytics-display";

export type GallaScanalyticsSummary = {
  total: number;
  checkedIn: number;
  remaining: number;
  checkedInPct: number;
};

export type GallaDeviceScanCount = {
  device: string;
  count: number;
};

export type GallaScanDayOption = {
  day: string;
  count: number;
};

export type GallaScanalyticsPayload = {
  summary: GallaScanalyticsSummary;
  byDevice: GallaDeviceScanCount[];
  hourlyForDay: HourlyViewPoint[];
  peakHour: { hour: number; count: number } | null;
  scanDays: GallaScanDayOption[];
  selectedDay: string;
};

type CheckedInRow = {
  checked_in_at: string | null;
  checked_in_by: string | null;
};

const CPH = "Europe/Copenhagen";

function cphDayIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CPH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function cphHour(iso: string): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: CPH,
    hour: "numeric",
    hour12: false,
  }).format(new Date(iso));
  return Number.parseInt(h, 10);
}

async function fetchAllCheckedInRows(supabase: SupabaseClient): Promise<CheckedInRow[]> {
  const pageSize = 1000;
  const rows: CheckedInRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("galla_tickets")
      .select("checked_in_at, checked_in_by")
      .eq("checked_in", true)
      .not("checked_in_at", "is", null)
      .order("checked_in_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as CheckedInRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function aggregateByDevice(rows: CheckedInRow[]): GallaDeviceScanCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const device = row.checked_in_by?.trim() || "Ukendt enhed";
    counts.set(device, (counts.get(device) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count || a.device.localeCompare(b.device, "da"));
}

function aggregateScanDays(rows: CheckedInRow[]): GallaScanDayOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.checked_in_at) continue;
    const day = cphDayIso(row.checked_in_at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

function aggregateHourlyForDay(rows: CheckedInRow[], day: string): HourlyViewPoint[] {
  const byHour = new Map<number, number>();
  for (const row of rows) {
    if (!row.checked_in_at) continue;
    if (cphDayIso(row.checked_in_at) !== day) continue;
    const hour = cphHour(row.checked_in_at);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    views: byHour.get(hour) ?? 0,
  }));
}

function findPeakHour(hourly: HourlyViewPoint[]): { hour: number; count: number } | null {
  let peak: { hour: number; count: number } | null = null;
  for (const point of hourly) {
    if (!peak || point.views > peak.count) {
      peak = { hour: point.hour, count: point.views };
    }
  }
  return peak && peak.count > 0 ? peak : null;
}

export function pickDefaultScanDay(scanDays: GallaScanDayOption[], todayCph: string): string {
  if (scanDays.some((d) => d.day === todayCph)) return todayCph;
  return scanDays[0]?.day ?? todayCph;
}

export async function fetchGallaScanalytics(
  supabase: SupabaseClient,
  selectedDay: string,
): Promise<GallaScanalyticsPayload> {
  const [totalRes, checkedRes, checkedInRows] = await Promise.all([
    supabase.from("galla_tickets").select("*", { count: "exact", head: true }),
    supabase.from("galla_tickets").select("*", { count: "exact", head: true }).eq("checked_in", true),
    fetchAllCheckedInRows(supabase),
  ]);

  if (totalRes.error) throw new Error(totalRes.error.message);
  if (checkedRes.error) throw new Error(checkedRes.error.message);

  const total = totalRes.count ?? 0;
  const checkedIn = checkedRes.count ?? 0;
  const remaining = Math.max(0, total - checkedIn);
  const checkedInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  const scanDays = aggregateScanDays(checkedInRows);
  const day = scanDays.some((d) => d.day === selectedDay) ? selectedDay : pickDefaultScanDay(scanDays, selectedDay);
  const hourlyForDay = aggregateHourlyForDay(checkedInRows, day);
  const peakHour = findPeakHour(hourlyForDay);

  return {
    summary: { total, checkedIn, remaining, checkedInPct },
    byDevice: aggregateByDevice(checkedInRows),
    hourlyForDay,
    peakHour,
    scanDays,
    selectedDay: day,
  };
}

export function formatScanPeakLabel(hour: number): string {
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String((hour + 1) % 24).padStart(2, "0")}:00`;
  return `${start}–${end}`;
}
