/**
 * LykkeCup 26 — "Mit LykkeCup" (kun localStorage, ingen login).
 */

export const LC26_SAVED_PLAYER_KEY = "lykkecup26-saved-player-v1";
export const LC26_SAVED_PROFILE_EVENT = "lc26-saved-profile-change";

export type Lc26SavedKind = "player" | "coach";

export type Lc26SavedProfile = {
  kind: Lc26SavedKind;
  id: string;
  name: string;
};

function safeTrim(s: string, max: number): string {
  return s.trim().slice(0, max);
}

export function getSavedProfile(): Lc26SavedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LC26_SAVED_PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as { kind?: unknown; id?: unknown; name?: unknown };
    const kind: Lc26SavedKind = o.kind === "coach" ? "coach" : "player";
    const id = typeof o.id === "string" ? safeTrim(o.id, 128) : "";
    const nameRaw = typeof o.name === "string" ? safeTrim(o.name, 200) : "";
    if (!id) return null;
    return { kind, id, name: nameRaw || "Mit LykkeCup" };
  } catch {
    return null;
  }
}

export function saveSavedProfile(kind: Lc26SavedKind, id: string, name: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmedId = safeTrim(id, 128);
  if (!trimmedId) return false;
  const trimmedName = safeTrim(name, 200) || "Mit LykkeCup";
  try {
    localStorage.setItem(LC26_SAVED_PLAYER_KEY, JSON.stringify({ kind, id: trimmedId, name: trimmedName }));
    window.dispatchEvent(new Event(LC26_SAVED_PROFILE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedProfile(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LC26_SAVED_PLAYER_KEY);
    window.dispatchEvent(new Event(LC26_SAVED_PROFILE_EVENT));
  } catch {
    /* ignore */
  }
}

export function getSavedProfileHref(profile: Lc26SavedProfile): string {
  return profile.kind === "coach" ? `/lykkecup26/coach/${profile.id}` : `/lykkecup26/spiller/${profile.id}`;
}
