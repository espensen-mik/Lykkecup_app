"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";

type Props = {
  src: string;
  alt: string;
  /** Valgfri undertekst under miniaturen (fx korttitel). */
  caption?: string;
};

const MAP_CONTROL_CLASS = "lc26-map-control";

/** Faste zoner så zoom-området ikke skjuler luk-knap i mobilbrowser (adresselinje m.m.). */
const CHROME_TOP = "calc(3.75rem + env(safe-area-inset-top, 0px))";
const CHROME_BOTTOM = "calc(10.5rem + env(safe-area-inset-bottom, 0px))";

/**
 * Kort/oversigtsbillede med tryk-for-fuldskærm og pinch/pan-zoom.
 * Nødvendigt fordi LykkeCup 26-viewport låser browser-zoom (userScalable: false).
 */
export function Lc26ZoomableMapImage({ src, alt, caption }: Props) {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const dialogTitleId = useId();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      transformRef.current?.resetTransform(0);
    });
    return () => cancelAnimationFrame(id);
  }, [open, src]);

  const fullscreen = open && portalReady ? (
    <div
      className="fixed inset-0 z-[1000] touch-none overscroll-none bg-lc26-navy/95"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header
        className={`${MAP_CONTROL_CLASS} fixed inset-x-0 top-0 z-[1010] flex items-center justify-between gap-3 border-b border-white/10 bg-lc26-navy px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]`}
      >
        <div className="min-w-0 flex-1">
          <p id={dialogTitleId} className="truncate text-sm font-semibold text-white">
            {alt}
          </p>
          <p className="text-[11px] text-white/55">
            Knib eller scroll for zoom · træk kortet · Esc eller Luk for at afslutte
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className={`${MAP_CONTROL_CLASS} flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-[0.97]`}
          aria-label="Luk"
        >
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div
        className="fixed inset-x-0 z-[1005] overflow-hidden"
        style={{ top: CHROME_TOP, bottom: CHROME_BOTTOM }}
      >
        <TransformWrapper
          ref={transformRef}
          key={src}
          initialScale={1}
          minScale={1}
          maxScale={6}
          centerOnInit
          centerZoomedOut
          limitToBounds
          alignmentAnimation={{ sizeX: 0, sizeY: 0, animationTime: 200 }}
          doubleClick={{ mode: "reset", animationTime: 200 }}
          wheel={{ step: 0.12, excluded: [MAP_CONTROL_CLASS] }}
          panning={{ velocityDisabled: true, excluded: [MAP_CONTROL_CLASS] }}
          pinch={{ step: 5, excluded: [MAP_CONTROL_CLASS] }}
          trackPadPanning={{ disabled: true }}
        >
          <TransformComponent
            wrapperClass="!h-full !w-full"
            contentClass="!flex !h-full !w-full !items-center !justify-center"
          >
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      <footer
        className={`${MAP_CONTROL_CLASS} fixed inset-x-0 bottom-0 z-[1010] flex flex-col items-center gap-2 border-t border-white/10 bg-lc26-navy px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
      >
        {caption ? <p className="max-w-md text-center text-xs text-white/70">{caption}</p> : null}
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1.5 ring-1 ring-white/15">
          <button
            type="button"
            onClick={() => transformRef.current?.zoomOut()}
            className={`${MAP_CONTROL_CLASS} flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/10`}
            aria-label="Zoom ud"
          >
            <ZoomOut className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => transformRef.current?.resetTransform(200)}
            className={`${MAP_CONTROL_CLASS} cursor-pointer px-2 text-[11px] font-semibold uppercase tracking-wide text-white/80 hover:text-white`}
          >
            Nulstil
          </button>
          <button
            type="button"
            onClick={() => transformRef.current?.zoomIn()}
            className={`${MAP_CONTROL_CLASS} flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white hover:bg-white/10`}
            aria-label="Zoom ind"
          >
            <ZoomIn className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          className={`${MAP_CONTROL_CLASS} inline-flex min-h-11 w-full max-w-xs cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-lc26-navy shadow-md transition hover:bg-white/90 active:scale-[0.98]`}
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          Luk kort
        </button>
      </footer>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in border-0 bg-stone-100/90 p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lc26-teal focus-visible:ring-offset-2"
        aria-label={`Åbn kort i fuld skærm: ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[min(52vh,420px)] w-full object-contain object-center"
          decoding="async"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-lc26-navy/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md backdrop-blur-sm transition group-hover:bg-lc26-navy">
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Tryk for fuld skærm
        </span>
      </button>

      {portalReady && fullscreen ? createPortal(fullscreen, document.body) : null}
    </>
  );
}
