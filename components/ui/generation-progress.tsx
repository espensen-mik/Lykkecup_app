"use client";

type Props = {
  /** 0–100 when determinate; ignored when indeterminate. */
  value?: number;
  label?: string;
  detail?: string;
  indeterminate?: boolean;
  className?: string;
};

export function GenerationProgress({
  value = 0,
  label,
  detail,
  indeterminate = false,
  className = "",
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const percentLabel = indeterminate ? null : `${Math.round(clamped)}%`;

  return (
    <div
      className={`rounded-lg border border-teal-200/80 bg-teal-50/50 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/25 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label ? (
            <p className="text-sm font-medium text-teal-950 dark:text-teal-50">{label}</p>
          ) : null}
          {detail ? (
            <p className="mt-0.5 text-xs text-teal-900/80 dark:text-teal-100/80">{detail}</p>
          ) : null}
        </div>
        {percentLabel ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-teal-800 dark:text-teal-200">
            {percentLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-teal-100 dark:bg-teal-950/60">
        {indeterminate ? (
          <div className="h-full w-2/5 animate-[generation-progress-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488]" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#14b8a6] to-[#0d9488] transition-[width] duration-300 ease-out"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
    </div>
  );
}
