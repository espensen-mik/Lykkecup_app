import type { SupabaseClient } from "@supabase/supabase-js";

export type GallaScanalyticsSummary = {
  total: number;
  checkedIn: number;
  remaining: number;
  checkedInPct: number;
  deviceCount: number;
};

export type MinuteViewPoint = {
  minuteOfDay: number;
  label: string;
  count: number;
};

export type ScanPeakMinute = {
  minuteOfDay: number;
  label: string;
  count: number;
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
  devicesForDay: GallaDeviceScanCount[];
  deviceCountForDay: number;
  minuteForDay: MinuteViewPoint[];
  peakMinute: ScanPeakMinute | null;
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

function cphMinuteOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CPH,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function rowsForDay(rows: CheckedInRow[], day: string): CheckedInRow[] {
  return rows.filter((row) => row.checked_in_at && cphDayIso(row.checked_in_at) === day);
}

function aggregateMinutelyForDay(rows: CheckedInRow[], day: string): MinuteViewPoint[] {
  const byMinute = new Map<number, number>();
  for (const row of rowsForDay(rows, day)) {
    if (!row.checked_in_at) continue;
    const minuteOfDay = cphMinuteOfDay(row.checked_in_at);
    if (!Number.isFinite(minuteOfDay) || minuteOfDay < 0 || minuteOfDay > 1439) continue;
    byMinute.set(minuteOfDay, (byMinute.get(minuteOfDay) ?? 0) + 1);
  }

  if (byMinute.size === 0) return [];

  const sortedMinutes = [...byMinute.keys()].sort((a, b) => a - b);
  const start = sortedMinutes[0]!;
  const end = sortedMinutes[sortedMinutes.length - 1]!;
  const points: MinuteViewPoint[] = [];

  for (let minuteOfDay = start; minuteOfDay <= end; minuteOfDay += 1) {
    points.push({
      minuteOfDay,
      label: formatMinuteOfDay(minuteOfDay),
      count: byMinute.get(minuteOfDay) ?? 0,
    });
  }

  return points;
}

function findPeakMinute(points: MinuteViewPoint[]): ScanPeakMinute | null {
  let peak: ScanPeakMinute | null = null;
  for (const point of points) {
    if (!peak || point.count > peak.count) {
      peak = { minuteOfDay: point.minuteOfDay, label: point.label, count: point.count };
    }
  }
  return peak && peak.count > 0 ? peak : null;
}

export function pickMinuteAxisTicks(points: MinuteViewPoint[]): string[] {
  if (points.length === 0) return [];
  const start = points[0]!.minuteOfDay;
  const end = points[points.length - 1]!.minuteOfDay;
  const span = end - start + 1;
  const step = span <= 30 ? 5 : span <= 90 ? 10 : span <= 240 ? 15 : span <= 480 ? 30 : 60;
  const ticks: string[] = [];
  for (let minuteOfDay = start; minuteOfDay <= end; minuteOfDay += step) {
    ticks.push(formatMinuteOfDay(minuteOfDay));
  }
  const lastLabel = formatMinuteOfDay(end);
  if (ticks[ticks.length - 1] !== lastLabel) ticks.push(lastLabel);
  return ticks;
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
  const byDevice = aggregateByDevice(checkedInRows);
  const devicesForDay = aggregateByDevice(rowsForDay(checkedInRows, day));
  const minuteForDay = aggregateMinutelyForDay(checkedInRows, day);
  const peakMinute = findPeakMinute(minuteForDay);

  return {
    summary: {
      total,
      checkedIn,
      remaining,
      checkedInPct,
      deviceCount: byDevice.length,
    },
    byDevice,
    devicesForDay,
    deviceCountForDay: devicesForDay.length,
    minuteForDay,
    peakMinute,
    scanDays,
    selectedDay: day,
  };
}
