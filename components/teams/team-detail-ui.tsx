"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, ReactNode } from "react";
import { Users, X } from "lucide-react";
import {
  kontrolCenterTeamDisplayName,
  teamDetailHasContent,
  type TeamCoachView,
  type TeamDetailView,
  type TeamPlayerView,
} from "@/lib/team-detail";

const TOOLTIP_PANEL_CLASS =
  "pointer-events-none w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-600 dark:bg-gray-900";

const TOOLTIP_OFFSET = 14;
const TOOLTIP_EST_HEIGHT = 320;
const TOOLTIP_EST_WIDTH = 288;

type TooltipCoords = { top: number; left: number };

function coordsAtPointer(clientX: number, clientY: number): TooltipCoords {
  const pad = 8;
  const maxLeft = window.innerWidth - TOOLTIP_EST_WIDTH - pad;
  const maxTop = window.innerHeight - TOOLTIP_EST_HEIGHT - pad;

  let left = clientX + TOOLTIP_OFFSET;
  let top = clientY + TOOLTIP_OFFSET;

  if (left > maxLeft) left = clientX - TOOLTIP_OFFSET - TOOLTIP_EST_WIDTH;
  if (top > maxTop) top = clientY - TOOLTIP_OFFSET - TOOLTIP_EST_HEIGHT;

  left = Math.min(Math.max(pad, left), maxLeft);
  top = Math.min(Math.max(pad, top), maxTop);

  return { top, left };
}

/** Hover tooltip (follows pointer) for any team detail content. */
export function TeamHoverHost({
  detail,
  children,
  className = "",
  onOpenDetail,
}: {
  detail: TeamDetailView;
  children: ReactNode;
  className?: string;
  onOpenDetail?: () => void;
}) {
  const pointerRef = useRef({ x: 0, y: 0 });
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<TooltipCoords>({ top: 0, left: 0 });

  const hasTooltip = teamDetailHasContent(detail);

  const updateTooltipCoords = useCallback((clientX: number, clientY: number) => {
    pointerRef.current = { x: clientX, y: clientY };
    setTooltipCoords(coordsAtPointer(clientX, clientY));
  }, []);

  const openTooltip = useCallback(
    (e: MouseEvent) => {
      if (!hasTooltip) return;
      updateTooltipCoords(e.clientX, e.clientY);
      setTooltipOpen(true);
    },
    [hasTooltip, updateTooltipCoords],
  );

  const moveTooltip = useCallback(
    (e: MouseEvent) => {
      if (!tooltipOpen || !hasTooltip) return;
      updateTooltipCoords(e.clientX, e.clientY);
    },
    [tooltipOpen, hasTooltip, updateTooltipCoords],
  );

  const closeTooltip = useCallback(() => setTooltipOpen(false), []);

  useLayoutEffect(() => {
    if (!tooltipOpen) return;
    const { x, y } = pointerRef.current;
    setTooltipCoords(coordsAtPointer(x, y));
    const onScroll = () => closeTooltip();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [tooltipOpen, closeTooltip]);

  const showPortalTooltip = tooltipOpen && hasTooltip;

  return (
    <div
      className={className}
      onMouseEnter={openTooltip}
      onMouseMove={moveTooltip}
      onMouseLeave={closeTooltip}
      onFocusCapture={(e) => {
        if (!hasTooltip) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        updateTooltipCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
        setTooltipOpen(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) closeTooltip();
      }}
      onClick={
        onOpenDetail
          ? (e) => {
              if ((e.target as HTMLElement).closest("[data-team-detail-trigger]")) {
                e.stopPropagation();
                onOpenDetail();
              }
            }
          : undefined
      }
    >
      {children}
      {showPortalTooltip
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "fixed",
                top: tooltipCoords.top,
                left: tooltipCoords.left,
                zIndex: 200,
              }}
              className={TOOLTIP_PANEL_CLASS}
            >
              <TeamDetailTooltip detail={detail} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Inline team name (e.g. match table) with hover tooltip. */
export function TeamNameWithHover({
  detail,
  displayName,
  onOpenDetail,
  className = "",
  maxWidthClass = "max-w-[9.5rem]",
}: {
  detail: TeamDetailView;
  /** Standard: kaldenavn eller officielt navn uden alders-parentes. */
  displayName?: string;
  onOpenDetail?: () => void;
  className?: string;
  maxWidthClass?: string;
}) {
  const label = displayName ?? kontrolCenterTeamDisplayName(detail);
  return (
    <TeamHoverHost detail={detail} className={`inline-flex min-w-0 ${className}`} onOpenDetail={onOpenDetail}>
      <button
        type="button"
        data-team-detail-trigger={onOpenDetail ? "" : undefined}
        className={`truncate text-left font-semibold text-gray-900 underline-offset-2 hover:underline dark:text-white ${maxWidthClass}`}
        title={label}
        onClick={(e) => {
          if (onOpenDetail) {
            e.stopPropagation();
            onOpenDetail();
          }
        }}
      >
        {label}
      </button>
    </TeamHoverHost>
  );
}

/** Full-width team card row (Puljer-style) with integrated detail icon. */
export function TeamRowWithPlayers({
  detail,
  onShowDetail,
  className = "",
  children,
}: {
  detail: TeamDetailView;
  onShowDetail: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TeamHoverHost
      detail={detail}
      onOpenDetail={onShowDetail}
      className={`group relative flex w-full items-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900/50 ${className}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        data-team-detail-trigger=""
        className="mr-2.5 flex shrink-0 items-center rounded-md p-1 text-gray-400 transition-colors group-hover:text-[#0d9488] hover:text-[#0d9488] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0d9488] dark:text-gray-500 dark:group-hover:text-teal-400 dark:hover:text-teal-400"
        aria-label={`Se holddetaljer for ${detail.teamName}`}
        title="Se holddetaljer"
      >
        <Users className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
    </TeamHoverHost>
  );
}

function TeamDetailTooltip({ detail }: { detail: TeamDetailView }) {
  return (
    <div className="space-y-2">
      {detail.nickname ? (
        <p className="text-xs text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-500 dark:text-gray-400">Kaldenavn: </span>
          {detail.nickname}
        </p>
      ) : null}
      {detail.coaches.length > 0 ? (
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Trænere
          </p>
          <TeamCoachesList coaches={detail.coaches} compact />
        </div>
      ) : null}
      {detail.players.length > 0 ? (
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Spillere
          </p>
          <TeamPlayersList players={detail.players} compact />
        </div>
      ) : null}
    </div>
  );
}

function TeamCoachesList({
  coaches,
  compact = false,
}: {
  coaches: TeamCoachView[];
  compact?: boolean;
}) {
  if (coaches.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Ingen trænere på holdet.</p>;
  }
  return (
    <ul className={compact ? "max-h-32 space-y-1 overflow-y-auto" : "space-y-2"}>
      {coaches.map((c) => (
        <li
          key={c.id}
          className={
            compact
              ? "truncate text-xs text-gray-700 dark:text-gray-200"
              : "rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
          }
        >
          {compact ? (
            <span>
              <span className="font-medium">{c.name}</span>
              {c.homeClub ? (
                <span className="text-gray-500 dark:text-gray-400"> · {c.homeClub}</span>
              ) : null}
            </span>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.homeClub || "—"}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TeamPlayersList({
  players,
  compact = false,
}: {
  players: TeamPlayerView[];
  compact?: boolean;
}) {
  if (players.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Ingen spillere på holdet.</p>;
  }
  return (
    <ul className={compact ? "max-h-40 space-y-1 overflow-y-auto" : "space-y-2"}>
      {players.map((p) => (
        <li
          key={p.id}
          className={
            compact
              ? "truncate text-xs text-gray-700 dark:text-gray-200"
              : "flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700"
          }
        >
          {compact ? (
            <span>
              <span className="font-medium">{p.name}</span>
              {p.age != null ? (
                <span className="text-gray-500 dark:text-gray-400"> · {p.age} år</span>
              ) : null}
            </span>
          ) : (
            <>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p.club || "—"}</p>
              </div>
              <p className="shrink-0 text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
                {p.age == null ? "— år" : `${p.age} år`}
              </p>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TeamDetailModal({
  open,
  onClose,
  detail,
  playerCount,
}: {
  open: boolean;
  onClose: () => void;
  detail: TeamDetailView;
  playerCount: number;
}) {
  if (!open) return null;

  const coachCount = detail.coaches.length;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-lc-border bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label={`Hold: ${detail.teamName}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-lc-border px-5 py-4 dark:border-gray-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-400">Hold</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{detail.teamName}</h3>
            {detail.nickname ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium text-gray-500 dark:text-gray-400">Kaldenavn: </span>
                {detail.nickname}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {playerCount} {playerCount === 1 ? "spiller" : "spillere"}
              {coachCount > 0
                ? ` · ${coachCount} ${coachCount === 1 ? "træner" : "trænere"}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Luk"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="max-h-[55vh] space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Trænere
            </h4>
            <TeamCoachesList coaches={detail.coaches} />
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Spillere
            </h4>
            <TeamPlayersList players={detail.players} />
          </section>
        </div>
      </div>
    </div>
  );
}
