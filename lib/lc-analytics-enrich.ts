import type { SupabaseClient } from "@supabase/supabase-js";
import { LYKKECUP_EVENT_ID } from "@/lib/players";

/** Matcher navigation i `public-header.tsx` (LykkeCup 26). */
export const LC26_STATIC_PAGE_TITLES: Record<string, string> = {
  "/lykkecup26": "Forside",
  "/lykkecup26/side-1": "Dagens program",
  "/lykkecup26/side-2": "Find rundt i MCH",
  "/lykkecup26/side-3": "Praktisk info",
  "/lykkecup26/nyt-fra-lykkeliga": "Nyt fra LykkeLiga",
  "/lykkecup26/beskeder": "Beskeder",
  "/lykkecup26/mit": "Mit LykkeCup",
};

export type AnalyticsPathKind = "player" | "coach" | "app" | "other";

export type EnrichedPathRow = {
  path: string;
  views: number;
  title: string;
  kind: AnalyticsPathKind;
};

function normalizePathKey(raw: string): string {
  let p = raw.split("?")[0]?.split("#")[0] ?? raw;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function matchRouteUuid(path: string, segment: "spiller" | "coach"): string | null {
  const key = normalizePathKey(path);
  const re = new RegExp(`^/lykkecup26/${segment}/([0-9a-f-]{36})$`, "i");
  const m = key.match(re);
  return m?.[1] ?? null;
}

export async function enrichLc26AnalyticsPaths(
  rows: { path: string; views: number }[],
  supabase: SupabaseClient,
  eventId: string = LYKKECUP_EVENT_ID,
): Promise<EnrichedPathRow[]> {
  const playerIds = new Set<string>();
  const coachIds = new Set<string>();

  for (const row of rows) {
    const pid = matchRouteUuid(row.path, "spiller");
    if (pid) playerIds.add(pid);
    const cid = matchRouteUuid(row.path, "coach");
    if (cid) coachIds.add(cid);
  }

  const playerNames = new Map<string, string>();
  const coachNames = new Map<string, string>();

  if (playerIds.size > 0) {
    const { data } = await supabase
      .from("players")
      .select("id, name")
      .eq("event_id", eventId)
      .in("id", [...playerIds]);
    for (const p of (data ?? []) as { id: string; name: string | null }[]) {
      playerNames.set(p.id, p.name?.trim() || "Ukendt navn");
    }
  }

  if (coachIds.size > 0) {
    const { data } = await supabase
      .from("coaches")
      .select("id, name")
      .eq("event_id", eventId)
      .in("id", [...coachIds]);
    for (const c of (data ?? []) as { id: string; name: string | null }[]) {
      coachNames.set(c.id, c.name?.trim() || "Ukendt navn");
    }
  }

  return rows.map((row): EnrichedPathRow => {
    const key = normalizePathKey(row.path);
    const sp = matchRouteUuid(row.path, "spiller");
    if (sp) {
      const name = playerNames.get(sp);
      return {
        path: row.path,
        views: row.views,
        title: name ? name : "Spiller (ikke fundet i databasen)",
        kind: "player",
      };
    }
    const co = matchRouteUuid(row.path, "coach");
    if (co) {
      const name = coachNames.get(co);
      return {
        path: row.path,
        views: row.views,
        title: name ? name : "Træner (ikke fundet i databasen)",
        kind: "coach",
      };
    }

    const staticTitle = LC26_STATIC_PAGE_TITLES[key];
    if (staticTitle) {
      return { path: row.path, views: row.views, title: staticTitle, kind: "app" };
    }

    if (key.startsWith("/lykkecup26")) {
      const tail = key.slice("/lykkecup26".length) || "/";
      return {
        path: row.path,
        views: row.views,
        title: tail === "/" ? "Forside" : `LykkeCup 26 · ${tail}`,
        kind: "app",
      };
    }

    return { path: row.path, views: row.views, title: row.path, kind: "other" };
  });
}

export function aggregatePathKindViews(rows: EnrichedPathRow[]): Record<AnalyticsPathKind, number> {
  const out: Record<AnalyticsPathKind, number> = {
    player: 0,
    coach: 0,
    app: 0,
    other: 0,
  };
  for (const r of rows) {
    out[r.kind] += r.views;
  }
  return out;
}

export type PathKindPieDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export function buildPathKindPieData(sums: Record<AnalyticsPathKind, number>): PathKindPieDatum[] {
  const defs: PathKindPieDatum[] = [
    { id: "app", label: "Faste sider", value: sums.app, color: "#14b8a6" },
    { id: "player", label: "Spillerprofiler", value: sums.player, color: "#3b82f6" },
    { id: "coach", label: "Trænerprofiler", value: sums.coach, color: "#a855f7" },
    { id: "other", label: "Andet", value: sums.other, color: "#94a3b8" },
  ];
  return defs.filter((d) => d.value > 0);
}
