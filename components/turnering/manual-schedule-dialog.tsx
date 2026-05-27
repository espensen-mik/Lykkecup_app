"use client";

import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyManualScheduleSlotAction,
  fetchManualScheduleSlotsAction,
  updateMatchScheduleAction,
  type ManualScheduleSlotsActionResult,
} from "@/lib/turnering-actions";
import type {
  ManualScheduleBookedBlock,
  ManualScheduleCourtOption,
  ManualScheduleCurrentSlot,
  ManualScheduleMoveSuggestion,
  ManualScheduleSlotOption,
} from "@/lib/turnering-scheduler";
import { formatCourtWithVenue } from "@/lib/kampprogram";
import { StyledSelect } from "@/components/ui/styled-select";

type Props = {
  open: boolean;
  onClose: () => void;
  matchId: string;
  levelKey: string;
  isScheduled?: boolean;
  /** Vises med det samme; opdateres fra server ved indlæsning. */
  currentSchedule?: ManualScheduleCurrentSlot | null;
  teamALabel: string;
  teamBLabel: string;
  onSuccess?: (message: string) => void;
  onRescheduleMatch?: (matchId: string) => void;
};

type ViewMode = "recommended" | "chrono" | "court";

type CourtTimelineRow =
  | { type: "booked"; block: ManualScheduleBookedBlock }
  | { type: "slot"; slot: ManualScheduleSlotOption };

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
    slot.teamsFree &&
    slot.respectsTeamRest
  );
}

function sortSlotsChronologically(items: ManualScheduleSlotOption[]): ManualScheduleSlotOption[] {
  return [...items].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      a.courtName.localeCompare(b.courtName, "da", { sensitivity: "base" }),
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
          udenfor periode
        </span>
      ) : null}
      {!slot.teamsFree ? (
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
          Hold optaget
        </span>
      ) : null}
      {slot.teamsFree && !slot.respectsTeamRest ? (
        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
          Uden hold-pause
        </span>
      ) : null}
    </span>
  );
}

function SlotOptionButton({
  slot,
  disabled,
  onSelect,
  showCourt = false,
}: {
  slot: ManualScheduleSlotOption;
  disabled: boolean;
  onSelect: (slot: ManualScheduleSlotOption) => void;
  showCourt?: boolean;
}) {
  const recommended = isRecommendedSlot(slot);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(slot)}
      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
        recommended
          ? "border-teal-200 hover:border-teal-400 hover:bg-teal-50/50 dark:border-teal-800 dark:hover:border-teal-600 dark:hover:bg-teal-950/30"
          : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/40 dark:border-gray-600 dark:hover:border-amber-700 dark:hover:bg-amber-950/20"
      }`}
    >
      <span className="font-medium tabular-nums text-gray-900 dark:text-white">{slot.timeLabel}</span>
      {showCourt ? (
        <>
          <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-700 dark:text-gray-200">
            {formatCourtWithVenue(slot.courtName, slot.venueName)}
          </span>
        </>
      ) : (
        <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-900 dark:bg-teal-900/40 dark:text-teal-200">
          Ledig
        </span>
      )}
      <SlotBadges slot={slot} />
    </button>
  );
}

function ViewModeTabs({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "recommended", label: "Anbefalet" },
    { id: "chrono", label: "Hele dagen" },
    { id: "court", label: "Per bane" },
  ];

  return (
    <div className="inline-flex w-full rounded-lg border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-md px-2.5 py-2 text-xs font-medium transition sm:text-sm ${
            viewMode === tab.id
              ? "bg-white text-[#0f766e] shadow-sm dark:bg-gray-900 dark:text-teal-200"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ManualScheduleDialog({
  open,
  onClose,
  matchId,
  levelKey,
  isScheduled = false,
  currentSchedule: currentScheduleProp = null,
  teamALabel,
  teamBLabel,
  onSuccess,
  onRescheduleMatch,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<ManualScheduleSlotOption[]>([]);
  const [courts, setCourts] = useState<ManualScheduleCourtOption[]>([]);
  const [bookedBlocks, setBookedBlocks] = useState<ManualScheduleBookedBlock[]>([]);
  const [moveSuggestions, setMoveSuggestions] = useState<ManualScheduleMoveSuggestion[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ManualScheduleCurrentSlot | null>(
    currentScheduleProp,
  );
  const [teamRestMinutes, setTeamRestMinutes] = useState(0);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [showOtherCourtSizes, setShowOtherCourtSizes] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("recommended");
  const [selectedCourtId, setSelectedCourtId] = useState("");

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: ManualScheduleSlotsActionResult = await fetchManualScheduleSlotsAction(matchId);
      if (!result.ok) throw new Error(result.message);
      setSlots(result.slots ?? []);
      setCourts(result.courts ?? []);
      setBookedBlocks(result.bookedBlocks ?? []);
      setMoveSuggestions(result.moveSuggestions ?? []);
      setCurrentSchedule(result.currentSchedule ?? currentScheduleProp ?? null);
      setTeamRestMinutes(result.teamRestMinutes ?? 0);
      const courtList = result.courts ?? [];
      const preferredWithSlots = courtList.find(
        (c) =>
          c.isPreferredCourtType &&
          (result.slots ?? []).some((s) => s.courtId === c.courtId),
      );
      const anyWithSlots = courtList.find((c) => (result.slots ?? []).some((s) => s.courtId === c.courtId));
      setSelectedCourtId(preferredWithSlots?.courtId ?? anyWithSlots?.courtId ?? courtList[0]?.courtId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente ledige tider.");
      setSlots([]);
      setCourts([]);
      setBookedBlocks([]);
      setMoveSuggestions([]);
      setCurrentSchedule(currentScheduleProp ?? null);
      setSelectedCourtId("");
    } finally {
      setLoading(false);
    }
  }, [matchId, currentScheduleProp]);

  useEffect(() => {
    if (!open) return;
    setCurrentSchedule(currentScheduleProp ?? null);
    setViewMode("recommended");
    setShowRecommendedOnly(false);
    setShowOtherCourtSizes(false);
    void loadSlots();
  }, [open, loadSlots, currentScheduleProp]);

  const displayCurrentSchedule = currentSchedule ?? currentScheduleProp;

  const slotsForCourtSize = useMemo(() => {
    if (showOtherCourtSizes) return slots;
    return slots.filter((s) => s.isPreferredCourtType);
  }, [slots, showOtherCourtSizes]);

  const visibleCourts = useMemo(() => {
    if (showOtherCourtSizes) return courts;
    return courts.filter((c) => c.isPreferredCourtType);
  }, [courts, showOtherCourtSizes]);

  const filteredSlots = useMemo(() => {
    if (showRecommendedOnly) return slotsForCourtSize.filter(isRecommendedSlot);
    return slotsForCourtSize;
  }, [slotsForCourtSize, showRecommendedOnly]);

  const recommendedCount = useMemo(
    () => slotsForCourtSize.filter(isRecommendedSlot).length,
    [slotsForCourtSize],
  );
  const showMoveSuggestions = !loading && recommendedCount === 0 && moveSuggestions.length > 0;

  const chronoSlots = useMemo(() => sortSlotsChronologically(filteredSlots), [filteredSlots]);

  useEffect(() => {
    if (showOtherCourtSizes || !selectedCourtId) return;
    const selected = courts.find((c) => c.courtId === selectedCourtId);
    if (selected?.isPreferredCourtType) return;
    const preferredWithSlots = visibleCourts.find((c) =>
      slotsForCourtSize.some((s) => s.courtId === c.courtId),
    );
    setSelectedCourtId(preferredWithSlots?.courtId ?? visibleCourts[0]?.courtId ?? "");
  }, [showOtherCourtSizes, selectedCourtId, courts, visibleCourts, slotsForCourtSize]);

  const selectedCourt = useMemo(
    () => visibleCourts.find((c) => c.courtId === selectedCourtId) ?? null,
    [visibleCourts, selectedCourtId],
  );

  const courtTimeline = useMemo((): CourtTimelineRow[] => {
    if (!selectedCourtId) return [];
    const rows: CourtTimelineRow[] = [
      ...bookedBlocks
        .filter((b) => b.courtId === selectedCourtId)
        .map((block) => ({ type: "booked" as const, block })),
      ...filteredSlots
        .filter((s) => s.courtId === selectedCourtId)
        .map((slot) => ({ type: "slot" as const, slot })),
    ];
    rows.sort((a, b) => {
      const startA = a.type === "booked" ? a.block.startMinutes : a.slot.startMinutes;
      const startB = b.type === "booked" ? b.block.startMinutes : b.slot.startMinutes;
      return startA - startB;
    });
    return rows;
  }, [bookedBlocks, filteredSlots, selectedCourtId]);

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
        slot.teamsFree,
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

  async function handleClearSchedule() {
    if (!isScheduled) return;
    const ok = window.confirm("Fjern planlægning for denne kamp?");
    if (!ok) return;

    setClearing(true);
    setError(null);
    try {
      const result = await updateMatchScheduleAction(matchId, levelKey, null, null, null);
      if (!result.ok) throw new Error(result.message);
      router.refresh();
      onSuccess?.(result.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne planlægning.");
    } finally {
      setClearing(false);
    }
  }

  if (!open) return null;

  const fieldClass =
    "w-full rounded-md border border-lc-border bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Luk"
        onClick={onClose}
        disabled={saving || clearing}
      />
      <div
        className={`relative z-10 flex max-h-[min(90vh,44rem)] w-full flex-col rounded-xl border border-lc-border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 ${
          viewMode === "court" ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden />
            {isScheduled ? "Flyt kamp" : "Planlæg manuelt"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {teamALabel} vs {teamBLabel}
          </p>
          {isScheduled ? (
            <div className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50/70 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">
                Nuværende planlægning
              </p>
              {displayCurrentSchedule ? (
                <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                  <span>{displayCurrentSchedule.timeLabel}</span>
                  <span className="mx-2 font-normal text-gray-400 dark:text-gray-500">·</span>
                  <span className="font-medium">{displayCurrentSchedule.courtLabel}</span>
                </p>
              ) : loading ? (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Henter…</p>
              ) : (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Ingen bane eller tid sat</p>
              )}
            </div>
          ) : null}
          <p
            className={`text-xs leading-relaxed text-gray-500 dark:text-gray-400 ${
              isScheduled ? "mt-3" : "mt-1"
            }`}
          >
            Vælg visning nedenfor. «Uden hold-pause» = for lidt tid mellem kampe (min. {teamRestMinutes} min).
            «Hold optaget» = overlap med anden kamp.
          </p>
          {!loading && slots.length > 0 ? (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {recommendedCount} anbefalede · {slotsForCourtSize.length} ledige tider ·{" "}
              {visibleCourts.length} baner
              {!showOtherCourtSizes && slots.length !== slotsForCourtSize.length
                ? ` (${slots.length - slotsForCourtSize.length} skjult — anden banestørrelse)`
                : ""}
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Henter alle ledige muligheder…
            </p>
          ) : null}

          {!loading && slots.length > 0 ? (
            <div className="mb-4 space-y-3">
              <ViewModeTabs viewMode={viewMode} onChange={setViewMode} />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showOtherCourtSizes}
                  onChange={(e) => setShowOtherCourtSizes(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Vis andre banestørrelser
              </label>
              {viewMode !== "court" ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showRecommendedOnly}
                    onChange={(e) => setShowRecommendedOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Vis kun anbefalede ({recommendedCount} af {slotsForCourtSize.length})
                </label>
              ) : null}
            </div>
          ) : null}

          {!loading && error ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {showMoveSuggestions ? (
            <section className="mb-4 rounded-lg border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/50 dark:bg-violet-950/25">
              <h4 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                Ingen anbefalede tider — flyt en blokerende kamp først
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/90 dark:text-violet-100/90">
                Disse kampe forhindrer en god placering. Flyt en af dem, og vend tilbage hertil — systemet
                estimerer hvor mange anbefalede tider der åbner.
              </p>
              <ul className="mt-3 space-y-2">
                {moveSuggestions.map((suggestion) => (
                  <li key={suggestion.matchId}>
                    <button
                      type="button"
                      disabled={saving || clearing || !onRescheduleMatch}
                      onClick={() => onRescheduleMatch?.(suggestion.matchId)}
                      className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-violet-400 hover:bg-violet-50/80 disabled:opacity-50 dark:border-violet-800 dark:bg-gray-900 dark:hover:border-violet-600 dark:hover:bg-violet-950/40"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {suggestion.teamALabel} vs {suggestion.teamBLabel}
                      </span>
                      <span className="mt-1 block text-xs text-gray-600 dark:text-gray-300">
                        {suggestion.timeLabel} · {formatCourtWithVenue(suggestion.courtName, suggestion.venueName)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-900 dark:bg-violet-900/40 dark:text-violet-200">
                          {suggestion.reasonLabel}
                        </span>
                        {suggestion.slotsFreed > 0 ? (
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 font-medium text-teal-900 dark:bg-teal-900/40 dark:text-teal-200">
                            +{suggestion.slotsFreed} anbefalede tid{suggestion.slotsFreed === 1 ? "" : "er"}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!loading && !error && viewMode === "recommended" && filteredSlots.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {slots.length === 0
                ? showMoveSuggestions
                  ? "Ingen ledige baner/tider lige nu — brug forslagene ovenfor til at flytte blokerende kampe."
                  : "Ingen ledige baner/tider fundet — tjek banernes åbningstider og pauser under Opsætning → Haller & baner."
                : slotsForCourtSize.length === 0 && !showOtherCourtSizes
                  ? "Ingen ledige tider på niveauets banestørrelse — afkryds «Vis andre banestørrelser» for at se flere."
                  : "Ingen tider matcher filteret «kun anbefalede»."}
            </p>
          ) : null}

          {!loading && !error && viewMode === "chrono" && chronoSlots.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {slotsForCourtSize.length === 0 && !showOtherCourtSizes && slots.length > 0
                ? "Ingen ledige tider på niveauets banestørrelse — afkryds «Vis andre banestørrelser» for at se flere."
                : "Ingen ledige tider matcher filteret."}
            </p>
          ) : null}

          {!loading && viewMode === "recommended" && filteredSlots.length > 0 ? (
            <ul className="space-y-2">
              {filteredSlots.map((slot) => {
                const key = `${slot.courtId}:${slot.startMinutes}:${slot.periodName}`;
                return (
                  <li key={key}>
                    <SlotOptionButton
                      slot={slot}
                      disabled={saving || clearing}
                      onSelect={(s) => void handleSelect(s)}
                      showCourt
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {!loading && viewMode === "chrono" && chronoSlots.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Alle ledige tider sorteret kronologisk på tværs af baner.
              </p>
              <ul className="space-y-2">
                {chronoSlots.map((slot) => {
                  const key = `${slot.courtId}:${slot.startMinutes}:${slot.periodName}`;
                  return (
                    <li key={key}>
                      <SlotOptionButton
                        slot={slot}
                        disabled={saving || clearing}
                        onSelect={(s) => void handleSelect(s)}
                        showCourt
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {!loading && viewMode === "court" ? (
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Bane
                <StyledSelect
                  value={selectedCourtId}
                  onChange={(e) => setSelectedCourtId(e.target.value)}
                  className={fieldClass}
                >
                  {visibleCourts.map((court) => {
                    const bookedCount = bookedBlocks.filter((b) => b.courtId === court.courtId).length;
                    const freeCount = slotsForCourtSize.filter((s) => s.courtId === court.courtId).length;
                    return (
                      <option key={court.courtId} value={court.courtId}>
                        {formatCourtWithVenue(court.courtName, court.venueName)}
                        {court.isPreferredCourtType ? "" : " (anden størrelse)"}
                        {` — ${bookedCount} planlagt, ${freeCount} ledige`}
                      </option>
                    );
                  })}
                </StyledSelect>
              </label>

              {selectedCourt ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCourtWithVenue(selectedCourt.courtName, selectedCourt.venueName)} ·{" "}
                  {courtTypeLabel(selectedCourt.courtType)}
                  {selectedCourt.isPreferredCourtType ? "" : " · anden banestørrelse end niveauets"}
                </p>
              ) : null}

              {courtTimeline.length === 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Ingen planlagte kampe eller ledige tider på denne bane.
                </p>
              ) : (
                <ul className="space-y-2">
                  {courtTimeline.map((row) => {
                    if (row.type === "booked") {
                      const { block } = row;
                      return (
                        <li
                          key={`booked-${block.matchId}`}
                          className={`rounded-lg border px-3 py-2.5 text-sm ${
                            block.isCurrentMatch
                              ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30"
                              : "border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                              {block.timeLabel}
                            </span>
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              Optaget
                            </span>
                            {block.isCurrentMatch ? (
                              <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                                Denne kamp
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-gray-700 dark:text-gray-200">
                            {block.teamALabel} vs {block.teamBLabel}
                          </p>
                        </li>
                      );
                    }

                    const key = `slot-${row.slot.courtId}:${row.slot.startMinutes}`;
                    return (
                      <li key={key}>
                        <SlotOptionButton
                          slot={row.slot}
                          disabled={saving || clearing}
                          onSelect={(s) => void handleSelect(s)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {isScheduled ? (
              <button
                type="button"
                onClick={() => void handleClearSchedule()}
                disabled={saving || clearing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200 dark:hover:bg-red-950/40 sm:w-auto"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Fjern planlægning
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || clearing}
              className={`w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 ${
                isScheduled ? "sm:w-auto" : ""
              }`}
            >
              Luk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
