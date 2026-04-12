"use client";

export type SlimBarRow = {
  key: string;
  label: string;
  count: number;
  /** Vises som "1." foran label (fx top-5 klubber) */
  rank?: number;
};

type Props = {
  rows: SlimBarRow[];
  /** Standard søjlefarve */
  barColor: string;
  /** Første række (fx klub #1) */
  leadBarColor?: string;
  /** Aria / screen reader */
  chartLabel: string;
};

/**
 * Slanke vandrette søjler i ren HTML/CSS — ingen akse-overlap, fulde navne som tekst.
 */
export function SlimHorizontalBarChart({
  rows,
  barColor,
  leadBarColor,
  chartLabel,
}: Props) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div
      className="space-y-5"
      role="list"
      aria-label={chartLabel}
    >
      {rows.map((row, i) => {
        const pct = (row.count / max) * 100;
        const fill = leadBarColor && i === 0 ? leadBarColor : barColor;
        const fullTitle = `${row.label}: ${row.count} spillere`;
        return (
          <div
            key={row.key}
            role="listitem"
            className="rounded-lg px-0 py-0.5 transition-colors sm:px-1 sm:hover:bg-gray-50/80 dark:sm:hover:bg-gray-800/30"
          >
            <p
              className="text-sm font-medium leading-snug text-gray-900 dark:text-gray-100"
              title={fullTitle}
            >
              {row.rank != null ? (
                <span className="mr-2 inline-block w-5 text-right font-semibold tabular-nums text-gray-400 dark:text-gray-500">
                  {row.rank}.
                </span>
              ) : null}
              <span className="align-top">{row.label}</span>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06)] dark:bg-gray-800/90 dark:shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)]"
                aria-hidden
              >
                <div
                  className="h-full max-w-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: fill,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
                  }}
                />
              </div>
              <p className="shrink-0 text-right text-[0.8125rem] tabular-nums leading-none text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {row.count}
                </span>
                <span className="font-normal"> spillere</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
