"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fetchAssignedTeamNameForPlayer, LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { PlayerDetail } from "@/types/player";
import { PlayerDetailContent } from "@/components/player-detail-content";
import { formatPreferences } from "@/lib/format";

type Props = {
  playerId: string | null;
  onClose: () => void;
};

type PlayerDraft = {
  name: string;
  homeClub: string;
  birthdate: string;
  age: string;
  gender: string;
  level: string;
  preferences: string;
};

type PlayerChangeLogRow = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_name: string | null;
};

const emptyDraft: PlayerDraft = {
  name: "",
  homeClub: "",
  birthdate: "",
  age: "",
  gender: "",
  level: "",
  preferences: "",
};

function toDraft(player: PlayerDetail): PlayerDraft {
  const prefText = formatPreferences(player.preferences);
  return {
    name: player.name ?? "",
    homeClub: player.home_club ?? "",
    birthdate: player.birthdate ? player.birthdate.slice(0, 10) : "",
    age: player.age == null ? "" : String(player.age),
    gender: player.gender ?? "",
    level: player.level ?? "",
    preferences: prefText === "—" ? "" : prefText,
  };
}

function fieldLabel(field: string): string {
  switch (field) {
    case "name":
      return "Navn";
    case "home_club":
      return "Hjemmeklub";
    case "birthdate":
      return "Fødselsdato";
    case "age":
      return "Alder";
    case "gender":
      return "Køn";
    case "level":
      return "Niveau";
    case "preferences":
      return "Præferencer";
    default:
      return field;
  }
}

function printValue(value: string | null): string {
  if (value == null || value.trim() === "") return "—";
  return value;
}

function parsePreferencesInput(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function PlayerDetailModal({ playerId, onClose }: Props) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [assignedTeamName, setAssignedTeamName] = useState<string | null>(null);
  const [logs, setLogs] = useState<PlayerChangeLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlayerDraft>(emptyDraft);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setAssignedTeamName(null);
      setLogs([]);
      setDraft(emptyDraft);
      setEditing(false);
      setSaveError(null);
      setSaveNotice(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlayer(null);
    setAssignedTeamName(null);
    setLogs([]);
    setEditing(false);
    setSaveError(null);
    setSaveNotice(null);

    (async () => {
      const [{ data, error: supaError }, teamName, logsRes] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, name, home_club, birthdate, age, gender, level, preferences, ticket_id",
          )
          .eq("id", playerId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .maybeSingle(),
        fetchAssignedTeamNameForPlayer(playerId),
        supabase
          .from("player_change_log")
          .select("id, field_name, old_value, new_value, changed_at, changed_by_name")
          .eq("player_id", playerId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .order("changed_at", { ascending: false })
          .limit(30),
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
      const detail = data as PlayerDetail;
      setPlayer(detail);
      setDraft(toDraft(detail));
      setAssignedTeamName(teamName);
      setLogs((logsRes.data ?? []) as PlayerChangeLogRow[]);
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

  async function refreshLogs(playerIdForLogs: string) {
    const logsRes = await supabase
      .from("player_change_log")
      .select("id, field_name, old_value, new_value, changed_at, changed_by_name")
      .eq("player_id", playerIdForLogs)
      .eq("event_id", LYKKECUP_EVENT_ID)
      .order("changed_at", { ascending: false })
      .limit(30);
    if (!logsRes.error) {
      setLogs((logsRes.data ?? []) as PlayerChangeLogRow[]);
    }
  }

  async function saveChanges() {
    if (!playerId || !player) return;
    setSaveError(null);
    setSaveNotice(null);

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setSaveError("Navn er påkrævet.");
      return;
    }

    const ageValue = draft.age.trim();
    const nextAge = ageValue === "" ? null : Number(ageValue);
    if (ageValue !== "" && !Number.isInteger(nextAge)) {
      setSaveError("Alder skal være et helt tal.");
      return;
    }

    const payload = {
      name: trimmedName,
      home_club: draft.homeClub.trim() || null,
      birthdate: draft.birthdate || null,
      age: nextAge,
      gender: draft.gender.trim() || null,
      level: draft.level.trim() || null,
      preferences: parsePreferencesInput(draft.preferences),
    };

    const beforePrefs = formatPreferences(player.preferences) === "—" ? "" : formatPreferences(player.preferences);
    const changed =
      payload.name !== player.name ||
      payload.home_club !== (player.home_club ?? null) ||
      payload.birthdate !== (player.birthdate ? player.birthdate.slice(0, 10) : null) ||
      payload.age !== (player.age ?? null) ||
      payload.gender !== (player.gender ?? null) ||
      payload.level !== (player.level ?? null) ||
      draft.preferences.trim() !== beforePrefs.trim();

    if (!changed) {
      setSaveNotice("Ingen ændringer at gemme.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("players")
      .update(payload)
      .eq("id", playerId)
      .eq("event_id", LYKKECUP_EVENT_ID);
    setSaving(false);

    if (updateError) {
      setSaveError(updateError.message);
      return;
    }

    const updated: PlayerDetail = {
      ...player,
      name: payload.name,
      home_club: payload.home_club,
      birthdate: payload.birthdate,
      age: payload.age,
      gender: payload.gender,
      level: payload.level,
      preferences: payload.preferences,
    };
    setPlayer(updated);
    setDraft(toDraft(updated));
    setEditing(false);
    setSaveNotice("Spilleroplysninger gemt.");
    await refreshLogs(playerId);
  }

  if (!playerId) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="relative mt-0 w-full max-w-2xl overflow-hidden rounded-none border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label="Spillerdetaljer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="truncate pr-4 text-xl font-semibold text-gray-900 dark:text-white">
            {player?.name ?? "Spillerdetaljer"}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/35 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
            aria-label="Luk"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className="relative max-h-[min(85vh,780px)] overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-gray-600/90 dark:text-gray-400">Indlæser …</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/85 px-4 py-3 text-sm text-red-800 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          ) : player ? (
            <div className="space-y-4">
              <PlayerDetailContent player={player} assignedTeamName={assignedTeamName} />

              <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                    Rediger spiller
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing((prev) => !prev);
                      setSaveError(null);
                      setSaveNotice(null);
                      if (player) setDraft(toDraft(player));
                    }}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {editing ? "Annuller" : "Rediger oplysninger"}
                  </button>
                </div>

                {editing ? (
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Navn
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Hjemmeklub
                      <input
                        value={draft.homeClub}
                        onChange={(e) => setDraft((d) => ({ ...d, homeClub: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Fødselsdato
                      <input
                        type="date"
                        value={draft.birthdate}
                        onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Alder
                      <input
                        type="number"
                        value={draft.age}
                        onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Køn
                      <input
                        value={draft.gender}
                        onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Niveau
                      <input
                        value={draft.level}
                        onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="sm:col-span-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Præferencer
                      <textarea
                        value={draft.preferences}
                        onChange={(e) => setDraft((d) => ({ ...d, preferences: e.target.value }))}
                        rows={3}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                      />
                    </label>

                    <div className="sm:col-span-2 mt-0.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveChanges()}
                        disabled={saving}
                        className="rounded-md bg-[#14b8a6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                      >
                        {saving ? "Gemmer..." : "Gem ændringer"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {saveError ? <p className="mt-3 text-xs text-red-600 dark:text-red-400">{saveError}</p> : null}
                {saveNotice ? <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{saveNotice}</p> : null}
              </section>

              <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Ændringsnoter
                </h2>
                {logs.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ingen ændringer registreret endnu.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                    {logs.map((log) => (
                      <li key={log.id} className="rounded-md border border-gray-200/80 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/45">
                        <p>
                          <span className="font-semibold">{fieldLabel(log.field_name)}:</span> {printValue(log.old_value)}
                          {" -> "}
                          {printValue(log.new_value)}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {new Date(log.changed_at).toLocaleString("da-DK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {log.changed_by_name?.trim() || "Ukendt bruger"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
