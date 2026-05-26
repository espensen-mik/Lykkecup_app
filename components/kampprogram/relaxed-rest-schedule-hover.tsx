"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildRelaxedRestScheduleBlocks,
  type TeamScheduleBlock,
  type TeamScheduleLine,
} from "@/lib/team-match-schedule";
import type { KampprogramLevelTiming, KampprogramMatch } from "@/lib/kampprogram";
import type { TeamDetailView } from "@/lib/team-detail";
import { MATCH_RELAXED_TEAM_REST_NOTICE } from "@/lib/turnering";

const PANEL_SHELL_CLASS =
  "pointer-events-auto flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(32rem,75vh)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-xl dark:border-gray-600 dark:bg-gray-900";

const PANEL_HEADER_CLASS = "shrink-0 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800";

const PANEL_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 [-webkit-overflow-scrolling:touch]";

type TooltipCoords = { top: number; left: number };

const HOVER_CLOSE_DELAY_MS = 250;
const HOVER_BRIDGE_PX = 8;

function positionBelowAnchor(anchor: DOMRect): TooltipCoords {
  const pad = 8;
  const width = Math.min(352, window.innerWidth - pad * 2);
  let left = anchor.left;
  let top = anchor.bottom + 2;

  if (left + width > window.innerWidth - pad) {
    left = window.innerWidth - pad - width;
  }
  left = Math.max(pad, left);

  const estHeight = 280;
  if (top + estHeight > window.innerHeight - pad) {
    top = Math.max(pad, anchor.top - estHeight - 6);
  }

  return { top, left };
}

function GapLabel({ line }: { line: TeamScheduleLine }) {
  if (line.gapBeforeMinutes == null) return null;
  const label =
    line.gapBeforeMinutes <= 0
      ? "Ingen pause"
      : `${line.gapBeforeMinutes} min pause`;
  return (
    <p
      className={`mt-1 text-[10px] font-medium ${
        line.gapTooShort ? "text-red-700 dark:text-red-300" : "text-gray-500 dark:text-gray-400"
      }`}
    >
      ↑ {label}
      {line.gapTooShort ? ` (kræver min. ${line.minRestMinutes} min)` : null}
    </p>
  );
}

function TeamScheduleSection({ block }: { block: TeamScheduleBlock }) {
  return (
    <div className="border-t border-gray-100 pt-2 first:border-0 first:pt-0 dark:border-gray-800">
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{block.teamLabel}</p>
      {block.lines.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ingen planlagte kampe.</p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {block.lines.map((line) => (
            <li
              key={line.matchId}
              className={`rounded-md px-2 py-1.5 text-xs ${
                line.isCurrentMatch
                  ? "border border-red-200 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/40"
                  : "bg-gray-50/80 dark:bg-gray-800/50"
              }`}
            >
              <GapLabel line={line} />
              <p className="font-semibold tabular-nums text-gray-900 dark:text-white">{line.timeLabel}</p>
              <p className="mt-0.5 text-gray-700 dark:text-gray-300">vs {line.opponentLabel}</p>
              <p className="mt-0.5 text-gray-500 dark:text-gray-400">{line.courtLabel}</p>
              {line.isCurrentMatch ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
                  Denne kamp
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScheduleTooltipHeader() {
  return (
    <>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">{MATCH_RELAXED_TEAM_REST_NOTICE}</p>
      <p className="mt-1 text-[11px] leading-snug text-gray-600 dark:text-gray-400">
        Holdets kampe i rækkefølge — rød markering viser kampen med manglende pause. Korte pauser er markeret.
      </p>
    </>
  );
}

function ScheduleTooltipBody({ blocks }: { blocks: TeamScheduleBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <TeamScheduleSection key={block.teamId} block={block} />
      ))}
    </div>
  );
}

export function RelaxedRestScheduleHover({
  match,
  allMatches,
  teamDetails,
  levelTimingByLevel,
}: {
  match: KampprogramMatch;
  allMatches: readonly KampprogramMatch[];
  teamDetails: Record<string, TeamDetailView>;
  levelTimingByLevel: Readonly<Record<string, KampprogramLevelTiming>>;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({ top: 0, left: 0 });

  const blocks = buildRelaxedRestScheduleBlocks(match, allMatches, teamDetails, levelTimingByLevel);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setCoords(positionBelowAnchor(el.getBoundingClientRect()));
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeTooltip = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  const openTooltip = useCallback(() => {
    cancelClose();
    updatePosition();
    setOpen(true);
  }, [cancelClose, updatePosition]);

  const isInsidePanel = useCallback((node: EventTarget | null) => {
    const panel = panelRef.current;
    if (!panel || !node || !(node instanceof Node)) return false;
    return panel.contains(node);
  }, []);

  const isInsideAnchor = useCallback((node: EventTarget | null) => {
    const anchor = anchorRef.current;
    if (!anchor || !node || !(node instanceof Node)) return false;
    return anchor.contains(node);
  }, []);

  const shouldKeepOpen = useCallback(
    (node: EventTarget | null) => isInsidePanel(node) || isInsideAnchor(node),
    [isInsideAnchor, isInsidePanel],
  );

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = (e: Event) => {
      if (isInsidePanel(e.target) || isInsideAnchor(e.target)) return;
      closeTooltip();
    };
    const onResize = () => closeTooltip();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      cancelClose();
    };
  }, [open, updatePosition, closeTooltip, cancelClose, isInsideAnchor, isInsidePanel]);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={openTooltip}
      onMouseLeave={(e) => {
        if (shouldKeepOpen(e.relatedTarget)) {
          cancelClose();
          return;
        }
        scheduleClose();
      }}
      onFocus={openTooltip}
      onBlur={(e) => {
        if (!shouldKeepOpen(e.relatedTarget)) scheduleClose();
      }}
    >
      <span
        tabIndex={0}
        role="button"
        aria-describedby={open ? `relaxed-rest-${match.id}` : undefined}
        className="inline-flex shrink-0 cursor-help items-center rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-900 underline decoration-red-300/60 decoration-dotted underline-offset-2 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:decoration-red-600/60"
      >
        Mangler pause
      </span>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                position: "fixed",
                top: coords.top - HOVER_BRIDGE_PX,
                left: coords.left,
                zIndex: 220,
                paddingTop: HOVER_BRIDGE_PX,
              }}
              onMouseEnter={openTooltip}
              onMouseLeave={(e) => {
                if (shouldKeepOpen(e.relatedTarget)) {
                  cancelClose();
                  return;
                }
                scheduleClose();
              }}
            >
              <div
                id={`relaxed-rest-${match.id}`}
                role="tooltip"
                className={PANEL_SHELL_CLASS}
                onWheel={(e) => e.stopPropagation()}
              >
              <div className={PANEL_HEADER_CLASS}>
                <ScheduleTooltipHeader />
              </div>
              <div className={PANEL_SCROLL_CLASS}>
                <ScheduleTooltipBody blocks={blocks} />
              </div>
            </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
