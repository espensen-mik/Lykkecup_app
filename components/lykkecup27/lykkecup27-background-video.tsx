"use client";

import { useEffect, useRef, useState } from "react";
import { LYKKECUP_2027_HLS_SRC, LYKKECUP_2027_POSTER_SRC } from "@/lib/lykkecup27";

const MEDIA_CLASS = "absolute inset-0 h-full w-full object-cover object-[50%_40%]";

/** Muted looping Mux background. Falls back to the poster when motion is reduced or HLS is unavailable. */
export function Lykkecup27BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    video.muted = true;
    video.defaultMuted = true;

    let destroyed = false;
    let hls: { destroy(): void } | null = null;

    const play = () => {
      void video.play().catch(() => {});
    };

    const playNatively = () => {
      video.src = LYKKECUP_2027_HLS_SRC;
      play();
    };

    /** Chrome reports native HLS as "maybe" but cannot always play Mux streams; only Safari gets native HLS. */
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
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b1626]" aria-hidden>
      <img src={LYKKECUP_2027_POSTER_SRC} alt="" className={MEDIA_CLASS} fetchPriority="high" decoding="async" />
      <video
        ref={videoRef}
        className={`${MEDIA_CLASS} transition-opacity duration-1000 ${playing ? "opacity-100" : "opacity-0"}`}
        poster={LYKKECUP_2027_POSTER_SRC}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        onPlaying={() => setPlaying(true)}
      />
    </div>
  );
}
