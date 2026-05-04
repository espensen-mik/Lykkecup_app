/** Én CSV-celle med RFC 4180-lignende escaping (komma, citationstegn, linjeskift). */
export function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** UTF-8 med BOM så Excel i Windows oftere viser æøå korrekt. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const base = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  const content = `\uFEFF${toCsv(rows)}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = base;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
