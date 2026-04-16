/**
 * LykkeCup 26 — "husk min spiller" (kun localStorage, ingen login).
 */

export const LC26_SAVED_PLAYER_KEY = "lykkecup26-saved-player-v1";

export type Lc26SavedPlayer = {
  id: string;
  name: string;
};

function safeTrim(s: string, max: number): string {
  return s.trim().slice(0, max);
}

export function getSavedPlayer(): Lc26SavedPlayer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LC26_SAVED_PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as { id?: unknown; name?: unknown };
    const id = typeof o.id === "string" ? safeTrim(o.id, 128) : "";
    const nameRaw = typeof o.name === "string" ? safeTrim(o.name, 200) : "";
    if (!id) return null;
    return { id, name: nameRaw || "Din spiller" };
  } catch {
    return null;
  }
}

export function saveSavedPlayer(id: string, name: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmedId = safeTrim(id, 128);
  if (!trimmedId) return false;
  const trimmedName = safeTrim(name, 200) || "Din spiller";
  try {
    localStorage.setItem(LC26_SAVED_PLAYER_KEY, JSON.stringify({ id: trimmedId, name: trimmedName }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedPlayer(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LC26_SAVED_PLAYER_KEY);
  } catch {
    /* ignore */
  }
}
