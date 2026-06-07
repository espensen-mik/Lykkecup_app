/** WordPress Event Tickets event_id for LykkeCup Galla. */
export const GALLA_EVENT_ID = 16899;

/** Session key efter korrekt adgangskode (valgfri UI-gate; login kræves ikke). */
export const GALLA_SCANNER_ACCESS_SESSION_KEY = "galla-scanner-access-v1";

/** localStorage-nøgle til enhedsnavn (vises i Scanalytics som checked_in_by). */
export const GALLA_SCANNER_DEVICE_KEY = "galla-scanner-device-v1";

export function getStoredScannerDeviceName(): string {
  if (typeof window === "undefined") return "scanner";
  try {
    return localStorage.getItem(GALLA_SCANNER_DEVICE_KEY)?.trim() || "scanner";
  } catch {
    return "scanner";
  }
}

export function setStoredScannerDeviceName(name: string): void {
  try {
    localStorage.setItem(GALLA_SCANNER_DEVICE_KEY, name.trim() || "scanner");
  } catch {
    /* ignore */
  }
}

/** Sekunder før næste scan efter resultatskærm. */
export const GALLA_SCANNER_RESET_MS = 1750;

/** Undgå dobbelt-scan af samme QR inden for dette vindue. */
export const GALLA_SCANNER_DEDUPE_MS = 2500;

export function getGallaScannerAccessCode(): string {
  return (process.env.NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE ?? "").trim();
}

export function isGallaScannerAccessCodeRequired(): boolean {
  return getGallaScannerAccessCode().length > 0;
}
