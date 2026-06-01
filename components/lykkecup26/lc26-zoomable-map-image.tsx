"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

type Props = {
  src: string;
  alt: string;
  /** Valgfri undertekst under miniaturen (fx korttitel). */
  caption?: string;
};

/**
 * Kort/oversigtsbillede med tryk-for-fuldskærm og pinch/pan-zoom.
 * Nødvendigt fordi LykkeCup 26-viewport låser browser-zoom (userScalable: false).
 */
export function Lc26ZoomableMapImage({ src, alt, caption }: Props) {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

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

      {open ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-lc26-navy/95"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <p id={dialogTitleId} className="truncate text-sm font-semibold text-white">
                {alt}
              </p>
              <p className="text-[11px] text-white/55">Knib for at zoome · træk for at flytte kortet</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Luk"
            >
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={6}
              centerOnInit
              limitToBounds={false}
              doubleClick={{ mode: "zoomIn", step: 0.7 }}
              pinch={{ step: 5 }}
              wheel={{ step: 0.12 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-lc26-navy/90 px-2 py-1.5 shadow-lg ring-1 ring-white/15">
                    <button
                      type="button"
                      onClick={() => zoomOut()}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                      aria-label="Zoom ud"
                    >
                      <ZoomOut className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => resetTransform()}
                      className="px-2 text-[11px] font-semibold uppercase tracking-wide text-white/80 hover:text-white"
                    >
                      Nulstil
                    </button>
                    <button
                      type="button"
                      onClick={() => zoomIn()}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
                      aria-label="Zoom ind"
                    >
                      <ZoomIn className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>

                  <TransformComponent
                    wrapperClass="!h-full !w-full"
                    contentClass="!flex !h-full !w-full !items-center !justify-center"
                  >
                    <img
                      src={src}
                      alt={alt}
                      className="max-h-[min(78dvh,100%)] max-w-[min(100vw,100%)] touch-none select-none object-contain"
                      draggable={false}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

          {caption ? (
            <p className="shrink-0 border-t border-white/10 px-4 py-3 text-center text-xs text-white/70">{caption}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
