"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyManualScheduleSlotAction,
  fetchManualScheduleSlotsAction,
  type ManualScheduleSlotsActionResult,
} from "@/lib/turnering-actions";
import type { ManualScheduleSlotOption } from "@/lib/turnering-scheduler";
import { formatCourtWithVenue } from "@/lib/kampprogram";

type Props = {
  open: boolean;
  onClose: () => void;
  matchId: string;
  levelKey: string;
  teamALabel: string;
  teamBLabel: string;
  onSuccess?: (message: string) => void;
};

function courtTypeLabel(t: ManualScheduleSlotOption["courtType"]): string {
  switch (t) {
    case "mini":
      return "Mini";
    case "kort":
      return "Kort";
    case "stor":
      return "Stor";
    default:
      return t;
  }
}

function isRecommendedSlot(slot: ManualScheduleSlotOption): boolean {
  return (
    slot.isPreferredCourtType &&
    !slot.isOutsidePoolPeriod &&
    !slot.isDedicatedOtherPoolPeriod &&
    slot.respectsTeamRest
  );
}

function SlotBadges({ slot }: { slot: ManualScheduleSlotOption }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
      <span className="text-gray-500 dark:text-gray-400">{slot.periodName}</span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {courtTypeLabel(slot.courtType)}
      </span>
      {!slot.isPreferredCourtType ? (
        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
          Anden banestørrelse
        </span>
      ) : null}
      {slot.isOutsidePoolPeriod ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Uden for pulje-periode
        </span>
      ) : null}
      {slot.isDedicatedOtherPoolPeriod ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Anden puljes periode
        </span>
      ) : null}
      {!slot.respectsTeamRest ? (
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
          Uden hold-pause
        </span>
      ) : null}
    </span>
  );
}

export function ManualScheduleDialog({
  open,
  onClose,
  matchId,
  levelKey,
  teamALabel,
  teamBLabel,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<ManualScheduleSlotOption[]>([]);
  const [teamRestMinutes, setTeamRestMinutes] = useState(0);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: ManualScheduleSlotsActionResult = await fetchManualScheduleSlotsAction(matchId);
      if (!result.ok) throw new Error(result.message);
      setSlots(result.slots ?? []);
      setTeamRestMinutes(result.teamRestMinutes ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente ledige tider.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!open) return;
    void loadSlots();
  }, [open, loadSlots]);

  const visibleSlots = useMemo(() => {
    if (showRecommendedOnly) {
      return slots.filter(isRecommendedSlot);
    }
    return slots;
  }, [slots, showRecommendedOnly]);

  const recommendedCount = useMemo(() => slots.filter(isRecommendedSlot).length, [slots]);

  async function handleSelect(slot: ManualScheduleSlotOption) {
    setSaving(true);
    setError(null);
    try {
      const result = await applyManualScheduleSlotAction(
        matchId,
        levelKey,
        slot.courtId,
        slot.startMinutes,
        slot.endMinutes,
        slot.respectsTeamRest,
      );
      if (!result.ok) throw new Error(result.message);
      router.refresh();
      onSuccess?.(result.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Luk"
        onClick={onClose}
        disabled={saving}
      />
      <div className="relative z-10 flex max-h-[min(90vh,44rem)] w-full max-w-2xl flex-col rounded-xl border border-lc-border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden />
            Planlæg manuelt
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {teamALabel} vs {teamBLabel}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Alle ledige kombinationer af bane, tid og periode — også andre banestørrelser og tider uden for puljens
            periode. Hold-pause: min. {teamRestMinutes} min mellem kampe (kan fraviges med mærkning).
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Henter alle ledige muligheder…
            </p>
          ) : null}

          {!loading && slots.length > 0 ? (
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showRecommendedOnly}
                onChange={(e) => setShowRecommendedOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              Vis kun anbefalede ({recommendedCount} af {slots.length})
            </label>
          ) : null}

          {!loading && error ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {!loading && !error && visibleSlots.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {slots.length === 0
                ? "Ingen ledige baner/tider fundet — tjek at banerne har åbningstider under Opsætning, og at holdene ikke allerede spiller på samme tidspunkt."
                : "Ingen tider matcher filteret «kun anbefalede»."}
            </p>
          ) : null}

          {!loading && visibleSlots.length > 0 ? (
            <ul className="space-y-2">
              {visibleSlots.map((slot) => {
                const key = `${slot.courtId}:${slot.startMinutes}:${slot.periodName}`;
                const recommended = isRecommendedSlot(slot);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSelect(slot)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                        recommended
                          ? "border-teal-200 hover:border-teal-400 hover:bg-teal-50/50 dark:border-teal-800 dark:hover:border-teal-600 dark:hover:bg-teal-950/30"
                          : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 dark:border-gray-600 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
                      }`}
                    >
                      <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                        {slot.timeLabel}
                      </span>
                      <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-gray-700 dark:text-gray-200">
                        {formatCourtWithVenue(slot.courtName, slot.venueName)}
                      </span>
                      <SlotBadges slot={slot} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}
