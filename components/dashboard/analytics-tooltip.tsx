"use client";

import type { TooltipContentProps } from "recharts";

type Payload = TooltipContentProps["payload"];

type AnalyticsProps = {
  active?: boolean;
  payload?: Payload;
  label?: string | number;
  /** Vises som lille overskrift (fx kategorinavn) */
  title?: string;
  /** Suffix efter værdi, fx "spillere" */
  valueSuffix?: string;
};

function formatTooltipValue(
  v: NonNullable<Payload>[number]["value"]
): string | number {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return typeof v === "number" || typeof v === "string" ? v : String(v);
}

/**
 * Fælles tooltip til dashboard-diagrammer — hvid, let kant, blød skygge.
 */
export function AnalyticsTooltip({
  active,
  payload,
  label,
  title,
  valueSuffix,
}: AnalyticsProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0];
  const value = formatTooltipValue(row?.value);
  const seriesName = row?.name;

  const headline =
    title ?? (label != null && label !== "" ? String(label) : undefined);

  const showSeries =
    Boolean(seriesName) &&
    !valueSuffix &&
    seriesName !== "value";

  return (
    <div className="rounded-lg border border-gray-200/95 bg-white px-3.5 py-2.5 shadow-lg shadow-gray-900/[0.06] ring-1 ring-gray-900/[0.03]">
      {headline ? (
        <p className="max-w-[min(280px,70vw)] text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500">
          {headline}
        </p>
      ) : null}
      <div className={headline ? "mt-2" : ""}>
        {showSeries ? (
          <span className="mr-2 text-xs font-medium text-gray-500">
            {seriesName}
          </span>
        ) : null}
        <span className="text-base font-semibold tabular-nums tracking-tight text-gray-900">
          {value}
          {valueSuffix ? (
            <span className="text-sm font-medium text-gray-500"> {valueSuffix}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** Tooltip til søjlediagram (niveau): viser fuldt niveau-navn selvom aksen bruger kort label */
export function LevelBarTooltip({ active, payload, label }: TooltipContentProps) {
  const row = payload?.[0] as { payload?: { name?: string } } | undefined;
  const fullName = row?.payload?.name?.trim();
  const short = label != null && label !== "" ? String(label) : "";
  const titleText =
    fullName && fullName.length > 0
      ? `Niveau · ${fullName}`
      : short
        ? `Niveau · ${short}`
        : "Niveau";

  return (
    <AnalyticsTooltip
      active={active}
      payload={payload}
      title={titleText}
      valueSuffix="spillere"
    />
  );
}

/** Tooltip til vandrette klub-søjler — fuldt klubnavn fra datapunktet */
export function ClubBarTooltip({ active, payload, label }: TooltipContentProps) {
  const row = payload?.[0] as { payload?: { club?: string } } | undefined;
  const clubName = row?.payload?.club?.trim() || (label != null ? String(label) : "");

  return (
    <AnalyticsTooltip
      active={active}
      payload={payload}
      title={clubName || undefined}
      valueSuffix="spillere"
    />
  );
}

/** Tooltip til cirkeldiagram — segmentnavn i payload */
export function PieSliceTooltip({ active, payload }: TooltipContentProps) {
  const segmentName = payload?.[0]?.name;
  return (
    <AnalyticsTooltip
      active={active}
      payload={payload}
      title={segmentName != null ? String(segmentName) : undefined}
      valueSuffix="spillere"
    />
  );
}

/** Tooltip til alderssøjler — aksen bruger korte labels (år / 25+). */
export function AgeBarTooltip({ active, payload, label }: TooltipContentProps) {
  const lbl = label != null && label !== "" ? String(label) : "";
  const titleText =
    lbl === "Ukendt"
      ? "Alder · ikke angivet"
      : lbl === "25+"
        ? "Alder · 25 år eller derover"
        : lbl
          ? `Alder · ${lbl} år`
          : "Alder";

  return (
    <AnalyticsTooltip
      active={active}
      payload={payload}
      title={titleText}
      valueSuffix="spillere"
    />
  );
}
