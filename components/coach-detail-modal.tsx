"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Coach } from "@/types/coach";
import { fetchCoachById } from "@/lib/coaches";
import { CoachDetailContent } from "@/components/coach-detail-content";

type Props = {
  coachId: string | null;
  onClose: () => void;
};

export function CoachDetailModal({ coachId, onClose }: Props) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!coachId) {
      setCoach(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCoach(null);

    (async () => {
      const { coach, error } = await fetchCoachById(coachId);
      if (cancelled) return;
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      if (!coach) {
        setError("Træner ikke fundet.");
        setLoading(false);
        return;
      }
      setCoach(coach);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [coachId]);

  useEffect(() => {
    if (!coachId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [coachId, onClose]);

  useEffect(() => {
    if (coachId) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId && !loading && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [coachId, loading]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!coachId) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-gradient-to-b from-slate-950/55 via-slate-900/50 to-teal-950/35 px-4 py-10 backdrop-blur-md dark:from-black/70 dark:via-slate-950/60 dark:to-teal-950/25"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="relative mt-0 w-full max-w-lg overflow-hidden rounded-2xl border border-white/40 bg-white/72 shadow-[0_32px_64px_-16px_rgba(15,23,42,0.45),inset_0_0_0_1px_rgba(255,255,255,0.55)] backdrop-blur-2xl dark:border-white/15 dark:bg-gray-950/58 dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.75),inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        role="dialog"
        aria-modal="true"
        aria-label="Trænerdetaljer"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent dark:via-teal-400/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[min(100%,28rem)] -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl dark:bg-teal-500/10"
          aria-hidden
        />

        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200/90 bg-white/90 text-gray-500 shadow-sm backdrop-blur-sm transition hover:border-gray-300 hover:bg-white hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/35 dark:border-white/12 dark:bg-gray-900/75 dark:text-gray-300 dark:hover:border-white/22 dark:hover:bg-gray-800 dark:hover:text-white"
          aria-label="Luk"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>

        <div className="relative max-h-[min(85vh,720px)] overflow-y-auto p-6 pt-14 sm:p-8 sm:pt-16">
          {loading ? (
            <p className="text-sm text-gray-600/90 dark:text-gray-400">Indlæser …</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/85 px-4 py-3 text-sm text-red-800 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          ) : coach ? (
            <CoachDetailContent coach={coach} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

