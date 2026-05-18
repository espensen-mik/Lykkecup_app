"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import type {
  BanerTiderBundle,
  CourtAvailabilityRow,
  CourtBreakRow,
  CourtRow,
  CourtType,
  LevelScheduleRow,
} from "@/lib/baner-tider";
import {
  formatTimeForInput,
  timeInputToTimestamptz,
  timeToMinutes,
  validateAvailability,
  validateBreakInsideAvailability,
} from "@/lib/baner-tider";
import {
  availabilityRowsToRegnemaskineAvailability,
  breakRowsToRegnemaskineBreaks,
  computeCourtCapacities,
  conservativeRoundTimingFromSchedule,
  courtsRowsToRegnemaskineCourts,
} from "@/lib/lykkecup-regnemaskine";
import { courtTypeForLevel, defaultRoundsPerMatchForLevel } from "@/lib/level-court-settings";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import {
  LykkecupRegnemaskine,
  type RegnemaskineLevelInput,
  type RegnemaskinePoolInput,
  type RegnemaskineTeamPoolInput,
} from "@/components/turnering/lykkecup-regnemaskine";
import { PerioderPanel } from "@/components/turnering/perioder-panel";
import type { PeriodCapacityHint } from "@/lib/period-capacity";
import type { PeriodsBundle } from "@/lib/tournament-periods";

type TabId = "haller" | "niveau" | "kampe" | "perioder";

const tabs: { id: TabId; label: string }[] = [
  { id: "haller", label: "Haller & baner" },
  { id: "niveau", label: "Niveau indstillinger" },
  { id: "kampe", label: "Kampe" },
  { id: "perioder", label: "Perioder" },
];

function courtTypeLabel(t: CourtRow["court_type"]) {
  switch (t) {
    case "mini":
      return "Mini bane";
    case "kort":
      return "Kort bane";
    case "stor":
      return "Stor bane";
    default:
      return String(t);
  }
}

function CourtTimeline({
  availability,
  breaks,
}: {
  availability: CourtAvailabilityRow | null;
  breaks: CourtBreakRow[];
}) {
  if (!availability) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">Ingen åbningstid sat — angiv under Rediger bane.</p>
    );
  }
  const a0 = timeToMinutes(availability.start_time);
  const a1 = timeToMinutes(availability.end_time);
  if (a0 == null || a1 == null || a1 <= a0) return null;
  const total = a1 - a0;
  return (
    <div className="space-y-1">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Dagslinje</p>
      <div className="relative h-9 w-full overflow-hidden rounded-md bg-emerald-500/25 ring-1 ring-emerald-600/20 dark:bg-emerald-500/15 dark:ring-emerald-500/30">
        {breaks.map((b) => {
          const b0 = timeToMinutes(b.start_time);
          const b1 = timeToMinutes(b.end_time);
          if (b0 == null || b1 == null || b1 <= b0) return null;
          const left = ((b0 - a0) / total) * 100;
          const width = ((b1 - b0) / total) * 100;
          const clampedLeft = Math.max(0, Math.min(100, left));
          const clampedWidth = Math.max(0, Math.min(100 - clampedLeft, width));
          if (clampedWidth <= 0) return null;
          return (
            <div
              key={b.id}
              className="absolute inset-y-0 bg-red-500/85 dark:bg-red-600/90"
              style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
              title={b.label?.trim() || "Pause"}
            />
          );
        })}
      </div>
      <p className="text-[0.7rem] text-gray-500 dark:text-gray-400">
        Grøn: spilletid · Rød: pauser (inden for åbningstid)
      </p>
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  wide,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Luk" onClick={onClose} />
      <div
        className={`relative z-10 w-full rounded-xl border border-lc-border bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900 ${
          wide ? "max-h-[90vh] max-w-2xl overflow-y-auto" : "max-w-md"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Luk
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function BanerTiderWorkspace({
  initial,
  levels,
  pools = [],
  teams = [],
  periodsBundle,
  capacityHints,
}: {
  initial: BanerTiderBundle;
  levels: RegnemaskineLevelInput[];
  pools?: readonly RegnemaskinePoolInput[];
  teams?: readonly RegnemaskineTeamPoolInput[];
  periodsBundle: PeriodsBundle;
  capacityHints: PeriodCapacityHint[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => getAuthBrowserClient(), []);
  const eventId = TURNERING_EVENT_ID;

  const [tab, setTab] = useState<TabId>("haller");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial.error);

  const [venueModal, setVenueModal] = useState(false);
  const [courtModal, setCourtModal] = useState<{ venueId: string } | null>(null);
  const [editCourt, setEditCourt] = useState<CourtRow | null>(null);

  const [venueName, setVenueName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [courtType, setCourtType] = useState<CourtType>("stor");

  const courtsByVenue = useMemo(() => {
    const map = new Map<string, CourtRow[]>();
    for (const c of initial.courts) {
      const list = map.get(c.venue_id) ?? [];
      list.push(c);
      map.set(c.venue_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "da"));
    }
    return map;
  }, [initial.courts]);

  const availabilityByCourt = useMemo(() => {
    const m = new Map<string, CourtAvailabilityRow>();
    for (const a of initial.availability) {
      if (!m.has(a.court_id)) m.set(a.court_id, a);
    }
    return m;
  }, [initial.availability]);

  const breaksByCourt = useMemo(() => {
    const m = new Map<string, CourtBreakRow[]>();
    for (const b of initial.breaks) {
      const list = m.get(b.court_id) ?? [];
      list.push(b);
      m.set(b.court_id, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return m;
  }, [initial.breaks]);

  const levelSettingsByLevel = useMemo(() => {
    const m = new Map<string, LevelScheduleRow>();
    for (const row of initial.levelSettings) {
      m.set(row.level, row);
    }
    return m;
  }, [initial.levelSettings]);

  const roundTiming = useMemo(
    () => conservativeRoundTimingFromSchedule(initial.levelSettings),
    [initial.levelSettings],
  );

  const slotsByCourtId = useMemo(() => {
    const courts = courtsRowsToRegnemaskineCourts(initial.courts);
    const availability = availabilityRowsToRegnemaskineAvailability(initial.availability);
    const breaks = breakRowsToRegnemaskineBreaks(initial.breaks);
    const rows = computeCourtCapacities(courts, availability, breaks, roundTiming);
    return new Map(rows.map((r) => [r.courtId, r.slots]));
  }, [initial.courts, initial.availability, initial.breaks, roundTiming]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setToast(null);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateVenue(e: React.FormEvent) {
    e.preventDefault();
    const name = venueName.trim();
    if (!name) return;
    const err = await run(async () => {
      const { error: insErr } = await supabase.from("venues").insert({
        event_id: eventId,
        name,
        sort_order: 999,
      });
      if (insErr) return insErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setVenueName("");
    setVenueModal(false);
    setToast("Hal oprettet.");
    refresh();
  }

  async function handleCreateCourt(e: React.FormEvent) {
    e.preventDefault();
    if (!courtModal) return;
    const name = courtName.trim();
    if (!name) return;
    const err = await run(async () => {
      const { error: insErr } = await supabase.from("courts").insert({
        venue_id: courtModal.venueId,
        event_id: eventId,
        name,
        court_type: courtType,
        is_active: true,
        sort_order: 999,
      });
      if (insErr) return insErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setCourtName("");
    setCourtType("stor");
    setCourtModal(null);
    setToast("Bane oprettet.");
    refresh();
  }

  async function handleSaveCourtEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCourt) return;
    const name = courtName.trim();
    if (!name) return;
    const v1 = validateAvailability(avStart, avEnd);
    if (v1) {
      setError(v1);
      return;
    }
    const startTs = timeInputToTimestamptz(avStart);
    const endTs = timeInputToTimestamptz(avEnd);
    if (!startTs || !endTs) {
      setError("Kunne ikke konvertere tider til databasen.");
      return;
    }
    const err = await run(async () => {
      const { error: upErr } = await supabase
        .from("courts")
        .update({
          name,
          court_type: courtType,
        })
        .eq("id", editCourt.id);
      if (upErr) return upErr.message;

      await supabase.from("court_availability").delete().eq("event_id", eventId).eq("court_id", editCourt.id);
      const { error: avErr } = await supabase.from("court_availability").insert({
        event_id: eventId,
        court_id: editCourt.id,
        start_time: startTs,
        end_time: endTs,
      });
      if (avErr) return avErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setEditCourt(null);
    setToast("Bane gemt.");
    refresh();
  }

  async function toggleCourtActive(c: CourtRow) {
    const err = await run(async () => {
      const { error: upErr } = await supabase.from("courts").update({ is_active: !c.is_active }).eq("id", c.id);
      if (upErr) return upErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    refresh();
  }

  const editAvail = editCourt ? (availabilityByCourt.get(editCourt.id) ?? null) : null;
  const editBreaks = editCourt ? (breaksByCourt.get(editCourt.id) ?? []) : [];

  const [avStart, setAvStart] = useState("");
  const [avEnd, setAvEnd] = useState("");

  useEffect(() => {
    if (!editCourt) return;
    const avail = availabilityByCourt.get(editCourt.id);
    setAvStart(formatTimeForInput(avail?.start_time));
    setAvEnd(formatTimeForInput(avail?.end_time));
    setBreakLabel("");
    setBreakStart("12:00");
    setBreakEnd("12:30");
    setEditBreak(null);
  }, [editCourt?.id, availabilityByCourt, editCourt]);

  const [breakLabel, setBreakLabel] = useState("");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("12:30");
  const [editBreak, setEditBreak] = useState<CourtBreakRow | null>(null);

  async function addBreak() {
    if (!editCourt || !editAvail) {
      setError("Angiv først åbningstid for banen.");
      return;
    }
    const v = validateBreakInsideAvailability(editAvail.start_time, editAvail.end_time, breakStart, breakEnd);
    if (v) {
      setError(v);
      return;
    }
    const breakStartTs = timeInputToTimestamptz(breakStart);
    const breakEndTs = timeInputToTimestamptz(breakEnd);
    if (!breakStartTs || !breakEndTs) {
      setError("Kunne ikke konvertere pausetider til databasen.");
      return;
    }
    const err = await run(async () => {
      const { error: insErr } = await supabase.from("court_breaks").insert({
        event_id: eventId,
        court_id: editCourt.id,
        label: breakLabel.trim() || null,
        start_time: breakStartTs,
        end_time: breakEndTs,
      });
      if (insErr) return insErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setBreakLabel("");
    setToast("Pause tilføjet.");
    refresh();
  }

  async function saveEditBreak(e: React.FormEvent) {
    e.preventDefault();
    if (!editBreak || !editAvail) return;
    const v = validateBreakInsideAvailability(editAvail.start_time, editAvail.end_time, breakStart, breakEnd);
    if (v) {
      setError(v);
      return;
    }
    const breakStartTs = timeInputToTimestamptz(breakStart);
    const breakEndTs = timeInputToTimestamptz(breakEnd);
    if (!breakStartTs || !breakEndTs) {
      setError("Kunne ikke konvertere pausetider til databasen.");
      return;
    }
    const err = await run(async () => {
      const { error: upErr } = await supabase
        .from("court_breaks")
        .update({
          label: breakLabel.trim() || null,
          start_time: breakStartTs,
          end_time: breakEndTs,
        })
        .eq("id", editBreak.id);
      if (upErr) return upErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setEditBreak(null);
    setToast("Pause opdateret.");
    refresh();
  }

  async function deleteBreak(b: CourtBreakRow) {
    if (!confirm("Slette denne pause?")) return;
    const err = await run(async () => {
      const { error: delErr } = await supabase.from("court_breaks").delete().eq("id", b.id);
      if (delErr) return delErr.message;
      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setToast("Pause slettet.");
    refresh();
  }

  const [levelDrafts, setLevelDrafts] = useState<Record<string, { match: string; pause: string; rounds: string }>>({});
  const [courtDrafts, setCourtDrafts] = useState<Partial<Record<string, CourtType>>>({});

  function draftFor(level: string) {
    const row = levelSettingsByLevel.get(level);
    const d = levelDrafts[level];
    if (d) return d;
    return {
      match: row ? String(row.match_duration_minutes) : "60",
      pause: row ? String(row.break_between_matches_minutes) : "5",
      rounds: row ? String(row.rounds_per_match) : String(defaultRoundsPerMatchForLevel(level)),
    };
  }

  function setDraft(level: string, patch: Partial<{ match: string; pause: string; rounds: string }>) {
    setLevelDrafts((prev) => {
      const row = levelSettingsByLevel.get(level);
      const base = prev[level] ?? {
        match: row ? String(row.match_duration_minutes) : "60",
        pause: row ? String(row.break_between_matches_minutes) : "5",
        rounds: row ? String(row.rounds_per_match) : String(defaultRoundsPerMatchForLevel(level)),
      };
      return { ...prev, [level]: { ...base, ...patch } };
    });
  }

  function courtPickFor(level: string): CourtType {
    const fromDraft = courtDrafts[level];
    if (fromDraft) return fromDraft;
    return courtTypeForLevel(level, initial.levelCourtSettings);
  }

  async function saveLevelRow(level: string) {
    const d = draftFor(level);
    const match = Number.parseInt(d.match, 10);
    const pause = Number.parseInt(d.pause, 10);
    const rounds = Number.parseInt(d.rounds, 10);
    if (!Number.isFinite(match) || match < 1 || match > 24 * 60) {
      setError("Kampvarighed skal være et positivt tal (minutter).");
      return;
    }
    if (!Number.isFinite(pause) || pause < 0 || pause > 24 * 60) {
      setError("Pause mellem kampe skal være et tal (minutter).");
      return;
    }
    if (!Number.isFinite(rounds) || rounds < 1 || rounds > 4) {
      setError("Runder pr. kamp skal være mellem 1 og 4.");
      return;
    }
    const err = await run(async () => {
      const existing = levelSettingsByLevel.get(level);
      if (existing) {
        const { error: upErr } = await supabase
          .from("level_schedule_settings")
          .update({
            match_duration_minutes: match,
            break_between_matches_minutes: pause,
            rounds_per_match: rounds,
          })
          .eq("id", existing.id);
        if (upErr) return upErr.message;
      } else {
        const { error: insErr } = await supabase.from("level_schedule_settings").insert({
          event_id: eventId,
          level,
          match_duration_minutes: match,
          break_between_matches_minutes: pause,
          rounds_per_match: rounds,
        });
        if (insErr) return insErr.message;
      }

      const ct = courtPickFor(level);
      const { error: lcErr } = await supabase.from("level_court_settings").upsert(
        {
          event_id: eventId,
          level,
          court_type: ct,
        },
        { onConflict: "event_id,level" },
      );
      if (lcErr) return lcErr.message;

      return null;
    });
    if (err) {
      setError(err);
      return;
    }
    setToast("Niveau gemt.");
    refresh();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">Turnering</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">Opsætning</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Turneringsopsætning: baner og tider, niveauindstillinger og kampebehov vs. kapacitet.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setError(null)}
          >
            Skjul
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
          <button type="button" className="ml-3 underline" onClick={() => setToast(null)}>
            OK
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-lc-border bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={busy}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[#14b8a6] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "haller" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Haller & baner</h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setVenueName("");
                setVenueModal(true);
              }}
              className="rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#0d9488] disabled:opacity-50"
            >
              Opret hal
            </button>
          </div>

          {initial.venues.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
              Ingen haller endnu. Opret en hal for at tilføje baner.
            </p>
          ) : null}

          <ul className="space-y-4">
            {initial.venues.map((v) => (
              <li key={v.id}>
                <article className="rounded-xl border border-lc-border bg-white p-5 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hal</p>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{v.name}</h3>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setCourtModal({ venueId: v.id });
                        setCourtName("");
                        setCourtType("stor");
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      Tilføj bane
                    </button>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {(courtsByVenue.get(v.id) ?? []).length === 0 ? (
                      <li className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                        Ingen baner i denne hal.
                      </li>
                    ) : (
                      (courtsByVenue.get(v.id) ?? []).map((c) => {
                        const avail = availabilityByCourt.get(c.id);
                        const totalSlots = slotsByCourtId.get(c.id) ?? 0;
                        const usedSlots = initial.scheduledSlotsByCourtId[c.id] ?? 0;
                        const openLabel =
                          avail != null
                            ? `${formatTimeForInput(avail.start_time)} – ${formatTimeForInput(avail.end_time)}`
                            : "Ingen åbningstid";
                        return (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700/80 dark:bg-gray-800/40"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{courtTypeLabel(c.court_type)}</p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{openLabel}</p>
                            <p className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
                              Runder: {usedSlots}/{totalSlots > 0 ? totalSlots : "—"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleCourtActive(c)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                c.is_active
                                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                                  : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                            >
                              {c.is_active ? "Aktiv" : "Inaktiv"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setEditCourt(c);
                                setCourtName(c.name);
                                setCourtType(c.court_type);
                              }}
                              className="rounded-md text-sm font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-300"
                            >
                              Rediger
                            </button>
                          </div>
                        </li>
                        );
                      })
                    )}
                  </ul>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "niveau" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Niveau indstillinger</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Én <strong className="font-medium text-gray-700 dark:text-gray-300">runde</strong> = kampvarighed + pause (fx 9+1 min).
            Vælg <strong className="font-medium text-gray-700 dark:text-gray-300">2 runder pr. kamp</strong> når en kamp har to halvlege
            (ROCK på stor bane).
          </p>
          {initial.levelKeys.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
              Ingen niveauer fundet endnu (spillere/hold). Når der findes niveauer i turneringen, vises de her.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                <thead className="bg-gray-50/80 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Niveau</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Bane (planlægning)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Min. pr. runde</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Pause (min)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Runder pr. kamp</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {initial.levelKeys.map((level) => {
                    const d = draftFor(level);
                    const courtVal = courtPickFor(level);
                    return (
                      <tr key={level}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">{level}</td>
                        <td className="px-4 py-3">
                          <select
                            className="min-w-[10rem] rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                            value={courtVal}
                            onChange={(e) =>
                              setCourtDrafts((prev) => ({
                                ...prev,
                                [level]: e.target.value as CourtType,
                              }))
                            }
                          >
                            <option value="mini">Mini bane</option>
                            <option value="kort">Kort bane</option>
                            <option value="stor">Stor bane</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={1}
                            className="w-24 rounded-md border border-gray-200 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                            value={d.match}
                            onChange={(e) => setDraft(level, { match: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            className="w-24 rounded-md border border-gray-200 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
                            value={d.pause}
                            onChange={(e) => setDraft(level, { pause: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                            value={d.rounds}
                            onChange={(e) => setDraft(level, { rounds: e.target.value })}
                            title={
                              d.rounds === "2"
                                ? "Kampen bruger to på hinanden følgende runder (to halvlege)"
                                : "Kampen bruger én runde"
                            }
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveLevelRow(level)}
                            className="rounded-lg bg-[#14b8a6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
                          >
                            Gem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === "perioder" ? <PerioderPanel initial={periodsBundle} capacityHints={capacityHints} /> : null}

      {tab === "kampe" ? (
        <LykkecupRegnemaskine
          levels={levels}
          baner={initial}
          pools={pools}
          teams={teams}
          embedded
          onOpenTab={setTab}
        />
      ) : null}

      <Modal open={venueModal} title="Opret hal" onClose={() => setVenueModal(false)}>
        <form className="space-y-4" onSubmit={handleCreateVenue}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Navn</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="F.eks. Hal A"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14b8a6] py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
          >
            Opret
          </button>
        </form>
      </Modal>

      <Modal open={courtModal != null} title="Ny bane" onClose={() => setCourtModal(null)}>
        <form className="space-y-4" onSubmit={handleCreateCourt}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Navn</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="F.eks. Bane 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={courtType}
              onChange={(e) => setCourtType(e.target.value as CourtType)}
            >
              <option value="mini">Mini bane</option>
              <option value="kort">Kort bane</option>
              <option value="stor">Stor bane</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14b8a6] py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
          >
            Opret bane
          </button>
        </form>
      </Modal>

      <Modal open={editCourt != null} title="Rediger bane" wide onClose={() => setEditCourt(null)}>
        <form className="space-y-6" onSubmit={handleSaveCourtEdit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Navn</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={courtType}
              onChange={(e) => setCourtType(e.target.value as CourtType)}
            >
              <option value="mini">Mini bane</option>
              <option value="kort">Kort bane</option>
              <option value="stor">Stor bane</option>
            </select>
          </div>

          <div className="border-t border-gray-100 pt-5 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Åbningstid</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Én åbningstid pr. bane pr. turnering.</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Starttid</label>
                <input
                  type="time"
                  required
                  className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={avStart}
                  onChange={(e) => setAvStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Sluttid</label>
                <input
                  type="time"
                  required
                  className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={avEnd}
                  onChange={(e) => setAvEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pauser</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Gem banen først med åbningstid — derefter kan du tilføje pauser.
            </p>
            <div className="mt-4">
              <CourtTimeline availability={editAvail} breaks={editBreaks} />
            </div>

            <ul className="mt-4 space-y-2">
              {editBreaks.length === 0 ? (
                <li className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                  Ingen pauser endnu.
                </li>
              ) : (
                editBreaks.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/25"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{b.label?.trim() || "Pause"}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {formatTimeForInput(b.start_time)} – {formatTimeForInput(b.end_time)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditBreak(b);
                          setBreakLabel(b.label ?? "");
                          setBreakStart(formatTimeForInput(b.start_time));
                          setBreakEnd(formatTimeForInput(b.end_time));
                        }}
                        className="text-xs font-medium text-[#0f766e] underline-offset-2 hover:underline dark:text-teal-300"
                      >
                        Rediger
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteBreak(b)}
                        className="text-xs font-medium text-red-700 hover:underline dark:text-red-300"
                      >
                        Slet
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 dark:border-gray-700 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Tilføj pause">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Label (valgfri)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={breakLabel}
                  onChange={(e) => setBreakLabel(e.target.value)}
                  placeholder="F.eks. Frokost"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Starttid</label>
                <input
                  type="time"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Sluttid</label>
                <input
                  type="time"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  disabled={busy || !editAvail}
                  onClick={() => void addBreak()}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  Tilføj pause
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14b8a6] py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
          >
            Gem bane
          </button>
        </form>
      </Modal>

      <Modal
        open={editBreak != null}
        title="Rediger pause"
        onClose={() => {
          setEditBreak(null);
        }}
      >
        <form className="space-y-4" onSubmit={saveEditBreak}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Label</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              value={breakLabel}
              onChange={(e) => setBreakLabel(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Starttid</label>
              <input
                type="time"
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Sluttid</label>
              <input
                type="time"
                required
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14b8a6] py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
          >
            Gem pause
          </button>
        </form>
      </Modal>
    </div>
  );
}
