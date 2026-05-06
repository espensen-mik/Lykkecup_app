"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  fetchAssignedTeamForPlayer,
  LYKKECUP_EVENT_ID,
  type PlayerAssignedTeamSummary,
} from "@/lib/players";
import { derivePreferenceBadge } from "@/lib/player-preferences";
import { sortLevelKeysForNav } from "@/lib/holddannelse";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import type { PlayerDetail } from "@/types/player";
import { PlayerDetailContent } from "@/components/player-detail-content";
import { formatPreferences } from "@/lib/format";
import { emitPlayerUpdated } from "@/lib/player-updates";

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
  preferences: string[];
};

type PlayerEditableField = "name" | "home_club" | "birthdate" | "age" | "gender" | "level" | "preferences";

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
  preferences: [],
};

const GENDER_PRESETS = ["Pige", "Dreng", "Diverse"] as const;

const PREFERENCE_OPTIONS: { id: string; label: string }[] = [
  { id: "egen_klub", label: "Egen klub" },
  { id: "nye_venner", label: "Nye venner" },
  { id: "alt_ok", label: "Alt ok" },
  { id: "klar_pa_alt", label: "Klar på alt" },
];

const prefIdByBadge: Record<string, string> = {
  "Egen klub": "egen_klub",
  "Nye venner": "nye_venner",
  "Alt ok": "alt_ok",
  "Klar på alt": "klar_pa_alt",
};

function toDraft(player: PlayerDetail): PlayerDraft {
  const prefIds = preferenceIdsFromValue(player.preferences);
  return {
    name: player.name ?? "",
    homeClub: normalizeClubName(player.home_club ?? ""),
    birthdate: player.birthdate ? player.birthdate.slice(0, 10) : "",
    age: player.age == null ? "" : String(player.age),
    gender: player.gender ?? "",
    level: player.level ?? "",
    // UI er single-select for præferencer; behold første matchede værdi.
    preferences: prefIds.slice(0, 1),
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

function normalizeClubName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLogFieldValue(field: string, value: string | null): string {
  if (field !== "preferences") return printValue(value);
  if (value == null || value.trim() === "") return "—";

  // Loggen gemmer preferences som rå tekst (ofte JSON-array), så gør den læsbar.
  const raw = value.trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const labels = parsed.map((item) => {
        const key = String(item).toLowerCase();
        if (key === "egen_klub") return "Egen klub";
        if (key === "nye_venner") return "Nye venner";
        if (key === "alt_ok") return "Alt ok";
        if (key === "klar_pa_alt") return "Klar på alt";
        return String(item);
      });
      return labels.join(", ");
    }
  } catch {
    // Ikke JSON - falder tilbage til rå tekst.
  }
  return raw;
}

function readableFieldNoun(field: string): string {
  switch (field) {
    case "home_club":
      return "klub";
    case "birthdate":
      return "fødselsdato";
    case "age":
      return "alder";
    case "gender":
      return "køn";
    case "level":
      return "niveau";
    case "preferences":
      return "præferencer";
    case "name":
      return "navn";
    default:
      return field;
  }
}

function firstName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "En admin";
  return trimmed.split(/\s+/)[0] ?? "En admin";
}

function preferenceIdsFromValue(value: unknown): string[] {
  const set = new Set<string>();
  const raw = formatPreferences(value).toLowerCase();

  const badge = derivePreferenceBadge(value);
  const badgeId = badge ? prefIdByBadge[badge] : null;
  if (badgeId) set.add(badgeId);

  if (raw.includes("egen") && raw.includes("klub")) set.add("egen_klub");
  if (raw.includes("nye") && raw.includes("ven")) set.add("nye_venner");
  if (raw.includes("alt ok") || raw.includes("det er ok")) set.add("alt_ok");
  if (raw.includes("klar") && raw.includes("hele")) set.add("klar_pa_alt");

  if (Array.isArray(value)) {
    for (const item of value) {
      const t = String(item).toLowerCase();
      if (t.includes("egen")) set.add("egen_klub");
      if (t.includes("ven")) set.add("nye_venner");
      if (t.includes("alt_ok") || t === "alt ok") set.add("alt_ok");
      if (t.includes("klar")) set.add("klar_pa_alt");
    }
  }
  return [...set];
}

export function PlayerDetailModal({ playerId, onClose }: Props) {
  const supabase = getAuthBrowserClient();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [assignedTeam, setAssignedTeam] = useState<PlayerAssignedTeamSummary | null>(null);
  const [logs, setLogs] = useState<PlayerChangeLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<PlayerEditableField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlayerDraft>(emptyDraft);
  const [levelOptions, setLevelOptions] = useState<string[]>([]);
  const [clubOptions, setClubOptions] = useState<string[]>([]);
  const [genderOptions, setGenderOptions] = useState<string[]>([]);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setAssignedTeam(null);
      setLogs([]);
      setDraft(emptyDraft);
      setEditingField(null);
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
    setAssignedTeam(null);
    setLogs([]);
    setEditingField(null);
    setSaveError(null);
    setSaveNotice(null);
    setLevelOptions([]);
    setClubOptions([]);
    setGenderOptions([]);

    (async () => {
      const [{ data, error: supaError }, teamSummary, logsRes, metaRes] = await Promise.all([
        supabase
          .from("players")
          .select(
            "id, name, home_club, birthdate, age, gender, level, preferences, ticket_id",
          )
          .eq("id", playerId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .maybeSingle(),
        fetchAssignedTeamForPlayer(playerId),
        supabase
          .from("player_change_log")
          .select("id, field_name, old_value, new_value, changed_at, changed_by_name")
          .eq("player_id", playerId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .order("changed_at", { ascending: false })
          .limit(30),
        supabase.from("players").select("home_club, gender, level").eq("event_id", LYKKECUP_EVENT_ID),
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
      setAssignedTeam(teamSummary);
      setLogs((logsRes.data ?? []) as PlayerChangeLogRow[]);
      if (!metaRes.error) {
        const rows = (metaRes.data ?? []) as { home_club: string | null; gender: string | null; level: string | null }[];
        const levels = new Set<string>();
        const clubsByKey = new Map<string, string>();
        const genders = new Set<string>();
        for (const row of rows) {
          const lv = row.level?.trim();
          if (lv) levels.add(lv);
          const cl = normalizeClubName(row.home_club ?? "");
          if (cl) {
            const key = cl.toLocaleLowerCase("da");
            if (!clubsByKey.has(key)) clubsByKey.set(key, cl);
          }
          const ge = row.gender?.trim();
          if (ge) genders.add(ge);
        }
        const curClub = normalizeClubName((data as PlayerDetail).home_club ?? "");
        if (curClub) {
          const key = curClub.toLocaleLowerCase("da");
          if (!clubsByKey.has(key)) clubsByKey.set(key, curClub);
        }
        setLevelOptions(sortLevelKeysForNav([...levels]));
        setClubOptions([...clubsByKey.values()].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" })));

        const presetLower = new Set(GENDER_PRESETS.map((g) => g.toLowerCase()));
        const merged: string[] = [...GENDER_PRESETS];
        for (const g of genders) {
          if (!presetLower.has(g.toLowerCase())) merged.push(g);
        }
        merged.sort((a, b) => {
          const ia = GENDER_PRESETS.includes(a as (typeof GENDER_PRESETS)[number])
            ? GENDER_PRESETS.indexOf(a as (typeof GENDER_PRESETS)[number])
            : 99;
          const ib = GENDER_PRESETS.includes(b as (typeof GENDER_PRESETS)[number])
            ? GENDER_PRESETS.indexOf(b as (typeof GENDER_PRESETS)[number])
            : 99;
          if (ia !== ib) return ia - ib;
          return a.localeCompare(b, "da", { sensitivity: "base" });
        });
        const curGender = (data as PlayerDetail).gender?.trim();
        if (curGender && !merged.some((x) => x.toLowerCase() === curGender.toLowerCase())) {
          merged.push(curGender);
        }
        setGenderOptions(merged);
      }
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
    if (!playerId || !player || !editingField) return;
    setSaveError(null);
    setSaveNotice(null);

    const beforePrefIds = preferenceIdsFromValue(player.preferences);
    const beforePrefKey = [...beforePrefIds].sort().join("|");
    const nextPrefKey = [...draft.preferences].sort().join("|");
    const preferencesChanged = beforePrefKey !== nextPrefKey;
    const payload: Record<string, unknown> = {};
    let changed = false;

    if (editingField === "name") {
      const trimmedName = draft.name.trim();
      if (!trimmedName) {
        setSaveError("Navn er påkrævet.");
        return;
      }
      payload.name = trimmedName;
      changed = trimmedName !== player.name;
    } else if (editingField === "home_club") {
      const next = normalizeClubName(draft.homeClub) || null;
      payload.home_club = next;
      changed = next !== (normalizeClubName(player.home_club ?? "") || null);
    } else if (editingField === "birthdate") {
      const next = draft.birthdate || null;
      payload.birthdate = next;
      changed = next !== (player.birthdate ? player.birthdate.slice(0, 10) : null);
    } else if (editingField === "age") {
      const ageValue = draft.age.trim();
      const nextAge = ageValue === "" ? null : Number(ageValue);
      if (ageValue !== "" && !Number.isInteger(nextAge)) {
        setSaveError("Alder skal være et helt tal.");
        return;
      }
      payload.age = nextAge;
      changed = nextAge !== (player.age ?? null);
    } else if (editingField === "gender") {
      const next = draft.gender.trim() || null;
      payload.gender = next;
      changed = next !== (player.gender ?? null);
    } else if (editingField === "level") {
      const next = draft.level.trim() || null;
      payload.level = next;
      changed = next !== (player.level ?? null);
    } else if (editingField === "preferences") {
      const next = draft.preferences.length > 0 ? draft.preferences : null;
      payload.preferences = next;
      changed = preferencesChanged;
    }

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

    const updated: PlayerDetail = { ...player, ...(payload as Partial<PlayerDetail>) };
    setPlayer(updated);
    emitPlayerUpdated(updated);
    setDraft(toDraft(updated));
    setEditingField(null);
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
        <div className="flex items-center justify-between border-b border-teal-700 bg-[#0d9488] px-5 py-4">
          <h2 className="truncate pr-4 text-xl font-semibold text-white">
            {player?.name ?? "Spillerdetaljer"}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border border-white/30 bg-white/95 text-gray-600 transition hover:bg-white hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
              <PlayerDetailContent
                player={player}
                assignedTeam={assignedTeam}
                onAssignedTeamNavigate={onClose}
                onEditField={(field) => {
                  setEditingField(field);
                  setSaveError(null);
                  setSaveNotice(null);
                  if (player) setDraft(toDraft(player));
                }}
              />

              <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Rediger spiller
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tryk “Rediger” direkte i feltet ovenfor. Herunder redigeres kun det valgte felt.
                </p>

                {editingField ? (
                  <div className="mt-3 rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {fieldLabel(editingField)}
                    </p>
                    <div className="mt-2 space-y-2">
                      {editingField === "name" ? (
                        <input
                          value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        />
                      ) : null}
                      {editingField === "home_club" ? (
                        <select
                          value={draft.homeClub}
                          onChange={(e) => setDraft((d) => ({ ...d, homeClub: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">Ingen klub</option>
                          {clubOptions.map((club) => (
                            <option key={club} value={club}>
                              {club}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {editingField === "birthdate" ? (
                        <input
                          type="date"
                          value={draft.birthdate}
                          onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        />
                      ) : null}
                      {editingField === "age" ? (
                        <input
                          type="number"
                          value={draft.age}
                          onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        />
                      ) : null}
                      {editingField === "gender" ? (
                        <select
                          value={draft.gender}
                          onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">Ikke angivet</option>
                          {genderOptions.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {editingField === "level" ? (
                        <select
                          value={draft.level}
                          onChange={(e) => setDraft((d) => ({ ...d, level: e.target.value }))}
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">Ingen niveau</option>
                          {levelOptions.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {editingField === "preferences" ? (
                        <select
                          value={draft.preferences[0] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              preferences: e.target.value ? [e.target.value] : [],
                            }))
                          }
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">Ingen præference</option>
                          {PREFERENCE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void saveChanges()}
                          disabled={saving}
                          className="rounded-md bg-[#14b8a6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                        >
                          {saving ? "Gemmer..." : "Gem"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingField(null);
                            setSaveError(null);
                            setSaveNotice(null);
                            if (player) setDraft(toDraft(player));
                          }}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Annuller
                        </button>
                      </div>
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
                          {firstName(log.changed_by_name)} ændrede {readableFieldNoun(log.field_name)} fra{" "}
                          <span className="font-semibold">{formatLogFieldValue(log.field_name, log.old_value)}</span> til{" "}
                          <span className="font-semibold">{formatLogFieldValue(log.field_name, log.new_value)}</span>.
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {new Date(log.changed_at).toLocaleString("da-DK", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
