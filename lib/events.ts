export const LYKKECUP_2026_EVENT_ID = "ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf";

/** Arrangement KontrolCenter viser, når brugeren ikke har valgt et andet. */
export const DEFAULT_EVENT_ID = LYKKECUP_2026_EVENT_ID;

export const ACTIVE_EVENT_COOKIE = "lc_active_event";

export const EVENT_PICKER_PATH = "/vaelg-aar";

export type EventSummary = {
  id: string;
  name: string;
  startsOn: string | null;
  location: string | null;
  status: "active" | "archived";
};

export function eventYearLabel(event: Pick<EventSummary, "name" | "startsOn">): string {
  return event.startsOn?.slice(0, 4) ?? event.name;
}

/** Kun interne stier; forhindrer åbne redirects via `next`. */
export function safeInternalPath(path: string | null | undefined, fallback = "/admin"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path === "/" || path.startsWith(EVENT_PICKER_PATH)) return fallback;
  return path;
}
