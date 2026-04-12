import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  /** Lille farvet accent — matcher diagramserien */
  accentClassName: string;
  children: ReactNode;
  className?: string;
};

/**
 * Hvid kort til analytics — afrundet, let kant, blød skygge, luftig header.
 */
export function AnalyticsChartCard({
  title,
  subtitle,
  accentClassName,
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_rgb(15_23_42/0.05)] ${className}`}
    >
      <div className="border-b border-gray-100 px-6 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
        <div className="flex items-start gap-3.5">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${accentClassName}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
            <p className="text-xs leading-relaxed text-gray-400">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="px-6 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">{children}</div>
    </div>
  );
}

/** Diskret indre ramme til diagram — ekstra luft omkring plottet */
export function ChartPlotWell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-gradient-to-b from-gray-50/80 to-gray-50/40 p-5 ring-1 ring-inset ring-gray-100/80 sm:p-6 lg:p-7">
      {children}
    </div>
  );
}
