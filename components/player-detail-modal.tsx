"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fetchAssignedTeamNameForPlayer, LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { PlayerDetail } from "@/types/player";
import { PlayerDetailContent } from "@/components/player-detail-content";

type Props = {
  playerId: string | null;
  onClose: () => void;
};

export function PlayerDetailModal({ playerId, onClose }: Props) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [assignedTeamName, setAssignedTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setAssignedTeamName(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlayer(null);
    setAssignedTeamName(null);

    (async () => {
      const [{ data, error: supaError }, teamName] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, name, home_club, birthdate, age, gender, level, preferences, ticket_id",
          )
          .eq("id", playerId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .maybeSingle(),
        fetchAssignedTeamNameForPlayer(playerId),
      ]);

      if (cancelled) return;
      if (supaError) {
        setError(supaError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Spiller ikke fundet.");
        setLoading(false);
        return;
      }
      setPlayer(data as PlayerDetail);
      setAssignedTeamName(teamName);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [playerId, onClose]);

  useEffect(() => {
    if (playerId) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [playerId]);

  useEffect(() => {
    if (playerId && !loading && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [playerId, loading]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!playerId) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-gradient-to-b from-slate-950/55 via-slate-900/50 to-teal-950/35 px-4 py-10 backdrop-blur-md dark:from-black/70 dark:via-slate-950/60 dark:to-teal-950/25"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="relative mt-0 w-full max-w-lg overflow-hidden rounded-2xl border border-white/40 bg-white/72 shadow-[0_32px_64px_-16px_rgba(15,23,42,0.45),inset_0_0_0_1px_rgba(255,255,255,0.55)] backdrop-blur-2xl dark:border-white/15 dark:bg-gray-950/58 dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.06)]"
        role="dialog"
        aria-modal="true"
        aria-label="Spillerdetaljer"
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
          className="absolute right-3 top-3 z-10 rounded-xl border border-white/50 bg-white/45 p-2 text-gray-600 shadow-sm backdrop-blur-md transition-[background-color,border-color,color,box-shadow] hover:border-white/70 hover:bg-white/65 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 dark:border-white/10 dark:bg-white/[0.08] dark:text-gray-300 dark:hover:border-white/18 dark:hover:bg-white/[0.14] dark:hover:text-white"
          aria-label="Luk"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        <div className="relative max-h-[min(85vh,720px)] overflow-y-auto p-6 pt-14 sm:p-8 sm:pt-16">
          {loading ? (
            <p className="text-sm text-gray-600/90 dark:text-gray-400">Indlæser …</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/85 px-4 py-3 text-sm text-red-800 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          ) : player ? (
            <PlayerDetailContent player={player} assignedTeamName={assignedTeamName} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
