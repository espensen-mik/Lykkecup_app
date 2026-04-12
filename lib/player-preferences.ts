import { formatPreferences } from "@/lib/format";

export type PreferenceBadgeLabel = "Egen klub" | "Nye venner" | "Alt ok";

function haystackFromPrefs(prefs: unknown): string {
  if (prefs === null || prefs === undefined) return "";
  if (typeof prefs === "string") return prefs;
  try {
    return JSON.stringify(prefs).toLowerCase();
  } catch {
    return String(prefs).toLowerCase();
  }
}

/**
 * Forsøger at udlede en kendt præference-kategori til badge (heuristik på tekst/JSON).
 */
export function derivePreferenceBadge(prefs: unknown): PreferenceBadgeLabel | null {
  const raw =
    typeof prefs === "string"
      ? prefs.toLowerCase()
      : haystackFromPrefs(prefs);

  if (!raw.trim()) return null;

  if (
    raw.includes("egen") &&
    (raw.includes("klub") || raw.includes("club") || raw.includes("eget hold"))
  ) {
    return "Egen klub";
  }
  if (raw.includes("nye") && (raw.includes("ven") || raw.includes("friend"))) {
    return "Nye venner";
  }
  if (raw.includes("alt ok") || raw.includes("alt_ok") || raw.includes("det er ok")) {
    return "Alt ok";
  }

  if (typeof prefs === "object" && prefs !== null && !Array.isArray(prefs)) {
    const o = prefs as Record<string, unknown>;
    const v = String(o.category ?? o.type ?? o.valg ?? o.preference ?? "").toLowerCase();
    if (v.includes("egen") || v === "egen_klub" || v === "own_club") return "Egen klub";
    if (v.includes("ven") || v === "nye_venner") return "Nye venner";
    if (v.includes("alt")) return "Alt ok";
  }

  return null;
}

export function preferencesTooltipText(prefs: unknown): string {
  const t = formatPreferences(prefs);
  return t === "—" ? "Ingen præference angivet" : t;
}
