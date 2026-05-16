/** Konsistent dato/tid til dansk UI (fx kommentarer). */
export function formatDaDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Kun klokkeslæt til kampprogram m.m. (fx «12.30»). */
export function formatDaTimeOnly(iso: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
