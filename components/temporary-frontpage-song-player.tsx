"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const SONG_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup.mp3";
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
        className="mt-3 rounded-2xl border border-white/18 bg-gradient-to-b from-white/[0.14] to-white/[0.06] p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur-md sm:p-5"
        role="region"
        aria-label={`Afspiller: ${SONG_TITLE}`}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => void toggle()}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-teal-300 to-teal-600 text-teal-950 shadow-[0_6px_20px_rgba(20,184,166,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-teal-200 hover:to-teal-500 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-[4.5rem] sm:w-[4.5rem]"
            aria-label={playing ? `Pause ${SONG_TITLE}` : `Afspil ${SONG_TITLE}`}
          >
            {playing ? (
              <Pause className="h-8 w-8" strokeWidth={2.2} aria-hidden />
            ) : (
              <Play className="ml-1 h-8 w-8" strokeWidth={2.2} aria-hidden />
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            <div
              ref={trackRef}
              role="presentation"
              className="group relative h-3 cursor-pointer rounded-full bg-black/35 ring-1 ring-white/15"
              onClick={seek}
            >
              <div
                className="pointer-events-none h-full rounded-full bg-gradient-to-r from-teal-400 via-teal-300 to-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{ width: `${pct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-100 shadow-md transition group-active:scale-110"
                style={{ left: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 text-[11px] tabular-nums text-white/65 sm:text-xs">
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
