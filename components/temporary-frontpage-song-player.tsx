"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const SONG_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup.mp3";
const ART_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup-mp3-image.png";
const SONG_TITLE = "Vi vinder LykkeCup";

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TemporaryFrontpageSongPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const pct = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }, [playing]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const a = audioRef.current;
      if (!track || !a || !duration) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const p = Math.min(1, Math.max(0, x / rect.width));
      a.currentTime = p * duration;
    },
    [duration],
  );

  return (
    <div className="mt-3 w-full max-w-[min(100%,22rem)] text-left sm:mt-4 sm:max-w-md">
      <p className="text-center text-[13px] leading-snug text-white/88 sm:text-left sm:text-sm">
        Mens du venter, kan du øve dig på den helt nye LykkeCup sang.
      </p>

      <div
        className="mt-3 rounded-2xl border border-white/25 bg-white/[0.06] p-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-2xl sm:p-4"
        role="region"
        aria-label={`Afspiller: ${SONG_TITLE}`}
      >
        <div className="flex gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-white/5 shadow-inner ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- ekstern LykkeLiga-asset */}
            <img src={ART_URL} alt="" className="h-full w-full object-cover" width={56} height={56} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-white drop-shadow-sm">
              {SONG_TITLE}
            </h2>
          </div>
        </div>

        <div className="mt-3.5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void toggle()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md transition hover:bg-white/[0.22] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={playing ? `Pause ${SONG_TITLE}` : `Afspil ${SONG_TITLE}`}
          >
            {playing ? (
              <Pause className="h-5 w-5" strokeWidth={2} aria-hidden />
            ) : (
              <Play className="ml-0.5 h-5 w-5" strokeWidth={2} aria-hidden />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div
              ref={trackRef}
              role="presentation"
              className="group relative h-2 cursor-pointer rounded-full bg-white/12 ring-1 ring-white/15"
              onClick={seek}
            >
              <div
                className="pointer-events-none h-full rounded-full bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                style={{ width: `${pct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/95 shadow-md transition group-active:scale-110"
                style={{ left: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 text-[11px] tabular-nums text-white/55 sm:text-xs">
              <span>{formatClock(current)}</span>
              <span>{duration > 0 ? formatClock(duration) : "—:—"}</span>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      >
        <source src={SONG_URL} type="audio/mpeg" />
      </audio>
    </div>
  );
}
