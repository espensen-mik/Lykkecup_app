/** WordPress Event Tickets event_id for LykkeCup Galla. */
export const GALLA_EVENT_ID = 16899;

/** Session key efter korrekt adgangskode (kun UI-gate; Supabase kræver stadig login). */
export const GALLA_SCANNER_ACCESS_SESSION_KEY = "galla-scanner-access-v1";

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
