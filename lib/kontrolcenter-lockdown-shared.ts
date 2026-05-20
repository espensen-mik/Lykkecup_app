export const PLANNING_LOCKDOWN_MESSAGE =
  "Planlægning er låst (Lockdown). En administrator skal slå Lockdown fra, før der kan redigeres.";

/** Stier hvor skrivebeskyttelse gælder når Lockdown er aktiv. */
export function isPlanningLockdownPath(pathname: string): boolean {
  return pathname.startsWith("/holddannelse") || pathname.startsWith("/turnering");
}
