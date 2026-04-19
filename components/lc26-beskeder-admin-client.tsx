"use client";

import { HeartHandshake, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import {
  LC26_MESSAGE_AVATAR_BUCKET,
  type Lc26PublicMessageRow,
  toDatetimeLocalValue,
} from "@/lib/lc26-public-messages";
import { fetchLc26GuestMessagesAdmin, type Lc26GuestMessageRow } from "@/lib/lc26-guest-messages";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

const BRAND = "#df6763";

const SELECT =
  "id, event_id, sender_name, subject, body, avatar_url, available_at, sort_order, created_at" as const;

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "avatar";
}

export function Lc26BeskederAdminClient() {
  const supabase = useMemo(() => getAuthBrowserClient(), []);
  const [rows, setRows] = useState<Lc26PublicMessageRow[]>([]);
  const [guestRows, setGuestRows] = useState<Lc26GuestMessageRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestLoadError, setGuestLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [availableLocal, setAvailableLocal] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setGuestLoadError(null);
    const [pmRes, guestPack] = await Promise.all([
      supabase
        .from("lc26_public_messages")
        .select(SELECT)
        .eq("event_id", LYKKECUP26_EVENT_ID)
        .order("available_at", { ascending: true })
        .order("sort_order", { ascending: true }),
      fetchLc26GuestMessagesAdmin(supabase),
    ]);

    if (pmRes.error) {
      setLoadError(pmRes.error.message);
      setRows([]);
    } else {
      setRows((pmRes.data ?? []) as Lc26PublicMessageRow[]);
    }

    if (guestPack.error) {
      setGuestLoadError(guestPack.error);
      setGuestRows([]);
    } else {
      setGuestRows(guestPack.data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSenderName("");
    setSubject("");
    setBody("");
    const d = new Date();
    d.setMinutes(d.getMinutes() - (d.getMinutes() % 5));
    setAvailableLocal(toDatetimeLocalValue(d.toISOString()));
    setSortOrder(0);
    setAvatarUrl(null);
    setPendingFile(null);
    setFormError(null);
  }, []);

  const fillFromRow = useCallback((r: Lc26PublicMessageRow) => {
    setEditingId(r.id);
    setSenderName(r.sender_name);
    setSubject(r.subject);
    setBody(r.body);
    setAvailableLocal(toDatetimeLocalValue(r.available_at));
    setSortOrder(r.sort_order);
    setAvatarUrl(r.avatar_url);
    setPendingFile(null);
    setFormError(null);
  }, []);

  const uploadAvatar = useCallback(
    async (messageId: string, file: File): Promise<string | null> => {
      const path = `${LYKKECUP26_EVENT_ID}/${messageId}/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(LC26_MESSAGE_AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) {
        setFormError(upErr.message);
        return null;
      }
      const { data: pub } = supabase.storage.from(LC26_MESSAGE_AVATAR_BUCKET).getPublicUrl(path);
      return pub.publicUrl ?? null;
    },
    [supabase],
  );

  const save = useCallback(async () => {
    setFormError(null);
    const sn = senderName.trim();
    const su = subject.trim();
    const bo = body.trim();
    if (!sn || !su || !bo) {
      setFormError("Udfyld afsender, emne og tekst.");
      return;
    }
    if (!availableLocal) {
      setFormError("Vælg dato og tid for aktivering.");
      return;
    }
    const availableAt = new Date(availableLocal);
    if (Number.isNaN(availableAt.getTime())) {
      setFormError("Ugyldig dato/tid.");
      return;
    }

    setSaving(true);
    try {
      const id = editingId ?? crypto.randomUUID();
      let nextAvatar = avatarUrl;

      if (pendingFile) {
        const url = await uploadAvatar(id, pendingFile);
        if (!url) {
          setSaving(false);
          return;
        }
        nextAvatar = url;
        setAvatarUrl(url);
        setPendingFile(null);
      }

      const payload = {
        id,
        event_id: LYKKECUP26_EVENT_ID,
        sender_name: sn,
        subject: su,
        body: bo,
        avatar_url: nextAvatar,
        available_at: availableAt.toISOString(),
        sort_order: sortOrder,
      };

      if (editingId) {
        const { error } = await supabase
          .from("lc26_public_messages")
          .update({
            event_id: payload.event_id,
            sender_name: payload.sender_name,
            subject: payload.subject,
            body: payload.body,
            avatar_url: payload.avatar_url,
            available_at: payload.available_at,
            sort_order: payload.sort_order,
          })
          .eq("id", editingId);
        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }
      } else {
        const { error } = await supabase.from("lc26_public_messages").insert(payload);
        if (error) {
          setFormError(error.message);
          setSaving(false);
          return;
        }
        setEditingId(id);
      }
      await load();
    } finally {
      setSaving(false);
    }
  }, [
    senderName,
    subject,
    body,
    availableLocal,
    sortOrder,
    avatarUrl,
    pendingFile,
    editingId,
    supabase,
    load,
    uploadAvatar,
  ]);

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Slette denne besked?")) return;
      setFormError(null);
      const { error } = await supabase.from("lc26_public_messages").delete().eq("id", id);
      if (error) {
        setFormError(error.message);
        return;
      }
      if (editingId === id) resetForm();
      await load();
    },
    [supabase, load, editingId, resetForm],
  );

  const removeGuest = useCallback(
    async (id: string) => {
      if (!window.confirm("Slette denne deltagerbesked?")) return;
      setFormError(null);
      const { error } = await supabase.from("lc26_guest_messages").delete().eq("id", id);
      if (error) {
        setFormError(error.message);
        return;
      }
      await load();
    },
    [supabase, load],
  );

  return (
    <>
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Planlagte beskeder</h2>
          <button
            type="button"
            onClick={() => resetForm()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Ny besked
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Indlæser…</p>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Ingen beskeder endnu — opret den første i formularen.</p>
        ) : (
          <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {rows.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center gap-3 bg-white px-4 py-3 dark:bg-gray-900 ${
                  editingId === r.id ? "bg-[rgb(223_103_99/0.06)] dark:bg-[rgb(223_103_99/0.08)]" : ""
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
                  {r.avatar_url ? (
                    <Image src={r.avatar_url} alt="" fill className="object-cover" sizes="40px" unoptimized />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-500">
                      {r.sender_name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{r.sender_name}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{r.subject}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                    Aktiveres{" "}
                    {new Date(r.available_at).toLocaleString("da-DK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => fillFromRow(r)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    aria-label="Rediger"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    aria-label="Slet"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="min-w-0">
        <div
          className="rounded-2xl border-2 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-6"
          style={{ borderColor: BRAND }}
        >
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              <MessageSquare className="h-4 w-4" strokeWidth={2} aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingId ? "Rediger besked" : "Ny besked"}</h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Avatar</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPendingFile(f ?? null);
                  setFormError(null);
                }}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-100"
              />
              {avatarUrl && !pendingFile ? (
                <div className="relative mt-3 h-16 w-16 overflow-hidden rounded-full border border-gray-200 dark:border-gray-600">
                  <Image src={avatarUrl} alt="" fill className="object-cover" sizes="64px" unoptimized />
                </div>
              ) : null}
              {pendingFile ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Ny fil: {pendingFile.name} (gemmes ved «Gem»)</p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Afsender</span>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Emne (forhåndsvisning)</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Beskedtekst</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="mt-1 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Aktiveres (dato og tid)</span>
              <input
                type="datetime-local"
                value={availableLocal}
                onChange={(e) => setAvailableLocal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Sortering (valgfri)</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Ved samme tidspunkt vises lavere tal først.</p>
            </label>

            {formError ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                {saving ? "Gemmer…" : "Gem"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void remove(editingId)}
                  className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Slet
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>

    <section className="mt-12 border-t border-gray-200 pt-10 dark:border-gray-700">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: BRAND }}
        >
          <HeartHandshake className="h-5 w-5" strokeWidth={2} aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Beskeder fra deltagere</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Hilsner sendt fra LykkeCup-appen under «Send en besked til LykkeLiga».
          </p>
        </div>
      </div>

      {guestLoadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Kunne ikke hente deltagerbeskeder (kør database-migration for <code className="rounded bg-black/5 px-1">lc26_guest_messages</code> hvis tabellen mangler):{" "}
          {guestLoadError}
        </div>
      ) : loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Indlæser…</p>
      ) : guestRows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ingen deltagerbeskeder endnu.</p>
      ) : (
        <ul className="space-y-3">
          {guestRows.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{g.display_name}</p>
                  {g.role_hint ? (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{g.role_hint}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    {new Date(g.created_at).toLocaleString("da-DK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeGuest(g.id)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                  aria-label="Slet deltagerbesked"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">{g.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
    </>
  );
}
