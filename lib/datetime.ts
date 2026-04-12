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
