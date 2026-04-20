"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SONG_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup.mp3";
const ART_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup-mp3-image.png";
const SONG_TITLE = "Vi vinder LykkeCup";
const ARTIST_CREDIT = "Sang af: Guldgåsen Vordingborg";

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function safeDuration(el: HTMLAudioElement): number {
  const d = el.duration;
  return Number.isFinite(d) && d > 0 && d !== Number.POSITIVE_INFINITY ? d : 0;
}

export function TemporaryFrontpageSongPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const pct =
    duration > 0 && Number.isFinite(current) ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

  /** Nogle browsere (især mobil) sender sjældent `timeupdate` — vi synker med rAF under afspilning. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playing) return;
    let id = 0;
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrent(a.currentTime);
      const d = safeDuration(a);
      if (d > 0) setDuration(d);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const syncDurationFromElement = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const d = safeDuration(a);
    if (d > 0) setDuration(d);
  }, []);

  const toggle = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      setCurrent(a.currentTime);
    } else {
      try {
        await a.play();
        setPlaying(true);
        syncDurationFromElement();
      } catch {
        setPlaying(false);
      }
    }
  }, [playing, syncDurationFromElement]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const a = audioRef.current;
      if (!track || !a) return;
      const d = duration > 0 ? duration : safeDuration(a);
      if (!d) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const p = Math.min(1, Math.max(0, x / rect.width));
      a.currentTime = p * d;
      setCurrent(a.currentTime);
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
            <p className="mt-1 text-[12px] leading-snug text-white/50">{ARTIST_CREDIT}</p>
          </div>
        </div>

        {/* Knap kun på samme række som selve baren — tid under baren */}
        <div className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5">
          <button
            type="button"
            onClick={() => void toggle()}
            className="col-start-1 row-start-1 flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-white/40 bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-md transition hover:bg-white/[0.22] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={playing ? `Pause ${SONG_TITLE}` : `Afspil ${SONG_TITLE}`}
          >
            {playing ? (
              <Pause className="h-4 w-4" strokeWidth={2} aria-hidden />
            ) : (
              <Play className="ml-px h-4 w-4" strokeWidth={2} aria-hidden />
            )}
          </button>

          <div
            ref={trackRef}
            role="presentation"
            className="col-start-2 row-start-1 group relative h-2 min-w-0 cursor-pointer self-center rounded-full bg-white/12 ring-1 ring-white/15"
            onClick={seek}
          >
            <div
              className="pointer-events-none h-full rounded-full bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              style={{ width: `${pct}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/95 shadow-md transition group-active:scale-110"
              style={{ left: `${pct}%` }}
            />
          </div>

          <div className="col-start-2 row-start-2 flex min-w-0 justify-between gap-2 text-[11px] tabular-nums text-white/55 sm:text-xs">
            <span>{formatClock(current)}</span>
            <span>{duration > 0 ? formatClock(duration) : "—:—"}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={syncDurationFromElement}
        onDurationChange={syncDurationFromElement}
        onLoadedData={syncDurationFromElement}
        onTimeUpdate={(e) => {
          if (!playing) setCurrent(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          const a = audioRef.current;
          if (a) setCurrent(a.currentTime);
        }}
        onPause={(e) => {
          setPlaying(false);
          setCurrent(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
      >
        <source src={SONG_URL} type="audio/mpeg" />
      </audio>
    </div>
  );
}
