"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Coach } from "@/types/coach";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import { CoachDetailContent } from "@/components/coach-detail-content";

type Props = {
  coachId: string | null;
  onClose: () => void;
};

type CoachDraft = {
  name: string;
  homeClub: string;
  birthdate: string;
  age: string;
  tshirtSize: string;
  email: string;
  phone: string;
};

type CoachEditableField = "name" | "home_club" | "birthdate" | "age" | "tshirt_size" | "email" | "phone";

type CoachChangeLogRow = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_name: string | null;
};

const emptyCoachDraft: CoachDraft = {
  name: "",
  homeClub: "",
  birthdate: "",
  age: "",
  tshirtSize: "",
  email: "",
  phone: "",
};

const tshirtOptions = ["", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

function toCoachDraft(coach: Coach): CoachDraft {
  return {
    name: coach.name ?? "",
    homeClub: coach.home_club ?? "",
    birthdate: coach.birthdate ? coach.birthdate.slice(0, 10) : "",
    age: coach.age == null ? "" : String(coach.age),
    tshirtSize: coach.tshirt_size ?? "",
    email: coach.email ?? "",
    phone: coach.phone ?? "",
  };
}

function coachFieldLabel(field: string): string {
  switch (field) {
    case "name":
      return "Navn";
    case "home_club":
      return "Hjemmeklub";
    case "birthdate":
      return "Fødselsdato";
    case "age":
      return "Alder";
    case "tshirt_size":
      return "T-shirt";
    case "email":
      return "E-mail";
    case "phone":
      return "Telefon";
    default:
      return field;
  }
}

function printValue(value: string | null): string {
  if (value == null || value.trim() === "") return "—";
  return value;
}

export function CoachDetailModal({ coachId, onClose }: Props) {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [logs, setLogs] = useState<CoachChangeLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<CoachEditableField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<CoachDraft>(emptyCoachDraft);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!coachId) {
      setCoach(null);
      setLogs([]);
      setDraft(emptyCoachDraft);
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
    setCoach(null);
    setLogs([]);
    setDraft(emptyCoachDraft);
    setEditingField(null);
    setSaveError(null);
    setSaveNotice(null);

    (async () => {
      const [{ data, error: coachError }, logsRes] = await Promise.all([
        supabase
          .from("coaches")
          .select("id, event_id, ticket_id, name, home_club, email, phone, birthdate, age, tshirt_size")
          .eq("id", coachId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .maybeSingle(),
        supabase
          .from("coach_change_log")
          .select("id, field_name, old_value, new_value, changed_at, changed_by_name")
          .eq("coach_id", coachId)
          .eq("event_id", LYKKECUP_EVENT_ID)
          .order("changed_at", { ascending: false })
          .limit(30),
      ]);
      if (cancelled) return;
      if (coachError) {
        setError(coachError.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Træner ikke fundet.");
        setLoading(false);
        return;
      }
      const detail = data as Coach;
      setCoach(detail);
      setDraft(toCoachDraft(detail));
      setLogs((logsRes.data ?? []) as CoachChangeLogRow[]);
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

  async function refreshLogs(coachIdForLogs: string) {
    const logsRes = await supabase
      .from("coach_change_log")
      .select("id, field_name, old_value, new_value, changed_at, changed_by_name")
      .eq("coach_id", coachIdForLogs)
      .eq("event_id", LYKKECUP_EVENT_ID)
      .order("changed_at", { ascending: false })
      .limit(30);
    if (!logsRes.error) {
      setLogs((logsRes.data ?? []) as CoachChangeLogRow[]);
    }
  }

  async function saveChanges() {
    if (!coachId || !coach) return;
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
      tshirt_size: draft.tshirtSize.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
    };

    const changed =
      payload.name !== coach.name ||
      payload.home_club !== (coach.home_club ?? null) ||
      payload.birthdate !== (coach.birthdate ? coach.birthdate.slice(0, 10) : null) ||
      payload.age !== (coach.age ?? null) ||
      payload.tshirt_size !== (coach.tshirt_size ?? null) ||
      payload.email !== (coach.email ?? null) ||
      payload.phone !== (coach.phone ?? null);

    if (!changed) {
      setSaveNotice("Ingen ændringer at gemme.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("coaches")
      .update(payload)
      .eq("id", coachId)
      .eq("event_id", LYKKECUP_EVENT_ID);
    setSaving(false);

    if (updateError) {
      setSaveError(updateError.message);
      return;
    }

    const updated: Coach = {
      ...coach,
      name: payload.name,
      home_club: payload.home_club,
      birthdate: payload.birthdate,
      age: payload.age,
      tshirt_size: payload.tshirt_size,
      email: payload.email,
      phone: payload.phone,
    };
    setCoach(updated);
    setDraft(toCoachDraft(updated));
    setEditingField(null);
    setSaveNotice("Træneroplysninger gemt.");
    await refreshLogs(coachId);
  }

  if (!coachId) return null;

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
        aria-label="Trænerdetaljer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-teal-700 bg-[#0d9488] px-5 py-4">
          <h2 className="truncate pr-4 text-xl font-semibold text-white">
            {coach?.name ?? "Trænerdetaljer"}
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
          ) : coach ? (
            <div className="space-y-4">
              <CoachDetailContent coach={coach} />

              <section className="rounded-xl border border-lc-border/80 bg-white/80 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Rediger træner
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Rediger ét felt ad gangen.</p>

                <div className="mt-3 space-y-2">
                  {(
                    [
                      ["name", "Navn"],
                      ["home_club", "Hjemmeklub"],
                      ["birthdate", "Fødselsdato"],
                      ["age", "Alder"],
                      ["tshirt_size", "T-shirt"],
                      ["email", "E-mail"],
                      ["phone", "Telefon"],
                    ] as [CoachEditableField, string][]
                  ).map(([field, label]) => {
                    const active = editingField === field;
                    return (
                      <div key={field} className="rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900/60">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                          {!active ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField(field);
                                setSaveError(null);
                                setSaveNotice(null);
                                if (coach) setDraft(toCoachDraft(coach));
                              }}
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              Rediger
                            </button>
                          ) : null}
                        </div>

                        {!active ? (
                          <p className="mt-1.5 text-sm text-gray-900 dark:text-gray-100">
                            {field === "name"
                              ? draft.name || "—"
                              : field === "home_club"
                                ? draft.homeClub || "—"
                                : field === "birthdate"
                                  ? draft.birthdate || "—"
                                  : field === "age"
                                    ? draft.age || "—"
                                    : field === "tshirt_size"
                                      ? draft.tshirtSize || "—"
                                      : field === "email"
                                        ? draft.email || "—"
                                        : draft.phone || "—"}
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {field === "name" ? (
                              <input
                                value={draft.name}
                                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
                            ) : null}
                            {field === "home_club" ? (
                              <input
                                value={draft.homeClub}
                                onChange={(e) => setDraft((d) => ({ ...d, homeClub: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
                            ) : null}
                            {field === "birthdate" ? (
                              <input
                                type="date"
                                value={draft.birthdate}
                                onChange={(e) => setDraft((d) => ({ ...d, birthdate: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
                            ) : null}
                            {field === "age" ? (
                              <input
                                type="number"
                                value={draft.age}
                                onChange={(e) => setDraft((d) => ({ ...d, age: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
                            ) : null}
                            {field === "tshirt_size" ? (
                              <select
                                value={draft.tshirtSize}
                                onChange={(e) => setDraft((d) => ({ ...d, tshirtSize: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              >
                                {tshirtOptions.map((size) => (
                                  <option key={size || "none"} value={size}>
                                    {size || "Ingen størrelse"}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            {field === "email" ? (
                              <input
                                type="email"
                                value={draft.email}
                                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
                            ) : null}
                            {field === "phone" ? (
                              <input
                                type="tel"
                                value={draft.phone}
                                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                                className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                              />
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
                                  if (coach) setDraft(toCoachDraft(coach));
                                }}
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                Annuller
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

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
                          <span className="font-semibold">{coachFieldLabel(log.field_name)}:</span> {printValue(log.old_value)}
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

