/** Persistent browser fingerprint — one UUID per scanner browser/profile. */
export const GALLA_SCANNER_BROWSER_ID_KEY = "galla-scanner-browser-id-v1";

const DEVICE_SEP = " · ";

export function getOrCreateBrowserDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    const existing = localStorage.getItem(GALLA_SCANNER_BROWSER_ID_KEY)?.trim();
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(GALLA_SCANNER_BROWSER_ID_KEY, id);
    return id;
  } catch {
    return "unknown";
  }
}

export function shortDeviceId(fullId: string): string {
  const clean = fullId.trim();
  if (clean.length <= 8) return clean;
  return clean.slice(0, 8);
}

/** Stored in galla_tickets.checked_in_by — groupable by trailing short id. */
export function buildCheckedInByLabel(params: {
  browserDeviceId: string;
  ip: string;
  customName?: string;
}): string {
  const ip = params.ip.trim() || "ukendt-ip";
  const sid = shortDeviceId(params.browserDeviceId);
  const custom = params.customName?.trim();
  if (custom && custom !== "scanner") {
    return `${custom}${DEVICE_SEP}${ip}${DEVICE_SEP}${sid}`;
  }
  return `${ip}${DEVICE_SEP}${sid}`;
}

export type ParsedScannerDevice = {
  groupKey: string;
  displayName: string;
  ip: string | null;
  shortId: string | null;
  customName: string | null;
};

export function isIdentifiedBrowser(raw: string | null | undefined): boolean {
  return parseCheckedInBy(raw).shortId != null;
}

export function browserDisplayName(shortId: string, ip: string | null): string {
  return ip ? `Browser ${shortId} · ${ip}` : `Browser ${shortId}`;
}

export function parseCheckedInBy(raw: string | null | undefined): ParsedScannerDevice {
  const value = raw?.trim() || "";
  if (!value) {
    return { groupKey: "ukendt", displayName: "Ukendt enhed", ip: null, shortId: null, customName: null };
  }

  const parts = value.split(DEVICE_SEP).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const shortId = parts[parts.length - 1]!;
    const ip = parts.length >= 3 ? parts[parts.length - 2]! : parts[0]!;
    const customName = parts.length >= 3 ? parts[0]! : null;
    const groupKey = shortId;
    return {
      groupKey,
      displayName: browserDisplayName(shortId, ip),
      ip,
      shortId,
      customName,
    };
  }

  return { groupKey: value, displayName: value, ip: null, shortId: null, customName: null };
}
