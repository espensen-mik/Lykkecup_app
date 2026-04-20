"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const SONG_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup.mp3";
const ART_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup-mp3-image.png";

const BAR_COUNT = 56;

function pickFakeHeights(t: number, playing: boolean): Float32Array {
  const out = new Float32Array(BAR_COUNT);
  if (!playing) {
    for (let i = 0; i < BAR_COUNT; i++) out[i] = 0.06 + Math.sin(i * 0.35) * 0.02;
    return out;
  }
  for (let i = 0; i < BAR_COUNT; i++) {
    const phase = t * 0.004 + i * 0.42;
    const wobble =
      0.45 * Math.abs(Math.sin(phase)) +
      0.35 * Math.abs(Math.cos(phase * 0.73 + i * 0.11)) +
      0.2 * Math.abs(Math.sin(phase * 1.9 + t * 0.001));
    const envelope = 0.55 + 0.45 * Math.sin(t * 0.0023 + i * 0.08);
    out[i] = Math.min(1, 0.12 + wobble * envelope);
  }
  return out;
}

export function TemporaryFrontpageSongPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const useSyntheticRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const ensureGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || sourceConnectedRef.current) return;

    const AC =
      typeof window !== "undefined" &&
      (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) {
      useSyntheticRef.current = true;
      return;
    }

    try {
      audio.crossOrigin = "anonymous";
      const ctx = new AC();
      ctxRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const n = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(n));
      sourceConnectedRef.current = true;
      useSyntheticRef.current = false;
    } catch {
      useSyntheticRef.current = true;
    }
  }, []);

  const drawFrame = useCallback(
    (heights: Float32Array) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const gap = 2;
      const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      const mid = h / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = heights[i] ?? 0;
        const bh = Math.max(2, v * (h * 0.42));
        const x = i * (barW + gap);
        const grd = g.createLinearGradient(0, mid - bh, 0, mid + bh);
        grd.addColorStop(0, "rgba(45, 212, 191, 0.95)");
        grd.addColorStop(0.5, "rgba(94, 234, 212, 0.85)");
        grd.addColorStop(1, "rgba(20, 184, 166, 0.75)");
        g.fillStyle = grd;
        g.beginPath();
        const radius = Math.min(3, barW / 2);
        if (typeof g.roundRect === "function") {
          g.roundRect(x, mid - bh, barW, bh * 2, radius);
        } else {
          g.rect(x, mid - bh, barW, bh * 2);
        }
        g.fill();
      }
    },
    [],
  );

  useEffect(() => {
    let synthCheckFrames = 0;

    const loop = (t: number) => {
      const analyser = analyserRef.current;
      const data = dataArrayRef.current;
      let heights: Float32Array;

      if (!useSyntheticRef.current && analyser && data && playing) {
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
        let sum = 0;
        const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
        heights = new Float32Array(BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          let s = 0;
          const start = i * step;
          const end = Math.min(data.length, start + step);
          for (let j = start; j < end; j++) s += data[j];
          const avg = s / (end - start);
          heights[i] = (avg / 255) ** 0.85;
          sum += avg;
        }
        if (sum < 2 && synthCheckFrames++ > 45) {
          useSyntheticRef.current = true;
        }
      } else {
        heights = pickFakeHeights(t, playing);
      }

      drawFrame(heights);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, drawFrame]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!playing) {
      await ensureGraph();
      const ctx = ctxRef.current;
      if (ctx?.state === "suspended") await ctx.resume();
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="mt-10 w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md sm:mt-12 sm:max-w-lg sm:p-6">
      <p className="text-left text-sm font-medium leading-relaxed text-white/95 sm:text-base">
        Mens du venter kan du øve dig i den helt nye LykkeCup-sang{" "}
        <span className="font-semibold text-white">«Vi vinder LykkeCup»</span>.
      </p>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-xl shadow-lg ring-2 ring-white/20 sm:mx-0 sm:h-28 sm:w-28">
          {/* eslint-disable-next-line @next/next/no-img-element -- ekstern LykkeLiga-asset; ingen Next Image-domæne */}
          <img
            src={ART_URL}
            alt="Cover: Vi vinder LykkeCup"
            className="h-full w-full object-cover"
            width={224}
            height={224}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-center text-lg font-semibold tracking-tight text-white sm:text-left sm:text-xl">
            Vi vinder LykkeCup
          </p>

          <div className="relative h-14 w-full overflow-hidden rounded-xl bg-black/35 ring-1 ring-white/10">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void toggle()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-400 text-teal-950 shadow-md transition hover:bg-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={playing ? "Pause Vi vinder LykkeCup" : "Afspil Vi vinder LykkeCup"}
            >
              {playing ? <Pause className="h-5 w-5" strokeWidth={2.2} /> : <Play className="ml-0.5 h-5 w-5" strokeWidth={2.2} />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-300 to-teal-100 transition-[width] duration-150 ease-linear"
                  style={{
                    width: duration > 0 ? `${Math.min(100, (current / duration) * 100)}%` : "0%",
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] tabular-nums text-white/55">
                {formatClock(current)} / {duration > 0 ? formatClock(duration) : "—:—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={SONG_URL}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
    </div>
  );
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
