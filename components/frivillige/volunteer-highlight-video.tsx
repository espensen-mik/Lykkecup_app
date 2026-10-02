"use client";

import { Play, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LYKKECUP_2027_HLS_SRC, LYKKECUP_2027_POSTER_SRC } from "@/lib/lykkecup27";

function HighlightPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    let hls: { destroy(): void } | null = null;

    const play = () => {
      void video.play().catch(() => {});
    };

    const playNatively = () => {
      video.src = LYKKECUP_2027_HLS_SRC;
      play();
    };

    const isSafari = /^((?!chrome|chromium|crios|android).)*safari/i.test(navigator.userAgent);
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (isSafari && nativeHls) {
      playNatively();
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (destroyed) return;
        if (!Hls.isSupported()) {
          if (nativeHls) playNatively();
          return;
        }
        const instance = new Hls({ capLevelToPlayerSize: true });
        instance.loadSource(LYKKECUP_2027_HLS_SRC);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, play);
        hls = instance;
      });
    }

    return () => {
      destroyed = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full bg-black"
      poster={LYKKECUP_2027_POSTER_SRC}
      controls
      playsInline
      preload="metadata"
    />
  );
}

/** Lille link, der åbner sidste års LykkeCup-video i en modal. */
export function VolunteerHighlightVideo() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl bg-white/[0.07] p-4 text-left text-sm font-semibold text-[#5ee0a4] ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/[0.12]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#22b573]/20 ring-1 ring-[#5ee0a4]/25">
          <Play className="h-4 w-4 fill-current" aria-hidden />
        </span>
        Se video fra LykkeCup 2026
      </button>
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f2442]/80 p-4 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/15"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
                  <p id={titleId} className="text-sm font-semibold">
                    LykkeCup 2026
                  </p>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                    aria-label="Luk video"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <HighlightPlayer />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
