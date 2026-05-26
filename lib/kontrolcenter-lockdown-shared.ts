export const PLANNING_LOCKDOWN_MESSAGE =
  "Planlægning er låst (Lockdown). En administrator skal slå Lockdown fra, før der kan redigeres.";

/** LykkeCup 26 brand coral — samme som public app (#df6763). */
export const LC26_BRAND_CORAL = "#df6763";
export const LC26_BRAND_CORAL_HOVER = "#d75a56";
export const LC26_BRAND_CORAL_TEXT = "#b84e4a";

/** Header bar når Lockdown er aktiv. */
export const LOCKDOWN_HEADER_CLASS =
  "border-[rgb(223_103_99/0.55)] bg-[#df6763] shadow-[0_4px_18px_rgb(223_103_99/0.45)] dark:border-[rgb(223_103_99/0.45)] dark:bg-[#d75a56] dark:shadow-[0_4px_18px_rgb(223_103_99/0.35)]";

/** Tekst på hvide header-knapper under Lockdown. */
export const LOCKDOWN_ACCENT_TEXT_CLASS = "text-[#b84e4a]";

/** Ring-offset på header-knapper under Lockdown. */
export const LOCKDOWN_RING_OFFSET_CLASS = "ring-offset-[#df6763] dark:ring-offset-[#d75a56]";

/** Toggle-knop når Lockdown er slået til. */
export const LOCKDOWN_TOGGLE_KNOB_CLASS =
  "translate-x-[1.2rem] bg-[#df6763] ring-[#b84e4a]/25 shadow-[0_2px_8px_rgb(223_103_99/0.45)]";

/** Toggle-label ring under Lockdown. */
export const LOCKDOWN_TOGGLE_LABEL_CLASS =
  "border-white/70 bg-white/20 ring-2 ring-white ring-offset-2 ring-offset-[#df6763] hover:border-white hover:bg-white/25 dark:ring-offset-[#d75a56]";

/** Stier hvor skrivebeskyttelse gælder når Lockdown er aktiv. */
export function isPlanningLockdownPath(pathname: string): boolean {
  return pathname.startsWith("/holddannelse") || pathname.startsWith("/turnering");
}
