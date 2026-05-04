"use client";

import { CheckCircle2, ChevronDown, RotateCcw, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { formatDaDateTime } from "@/lib/datetime";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { StyledSelect } from "@/components/ui/styled-select";
import type { ClubFeedbackRow } from "@/types/club-feedback";

type CurrentUserLite = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

type Props = {
  comments: ClubFeedbackRow[];
  totalCount: number;
  currentUser: CurrentUserLite | null;
};

const ALL_CLUBS = "__all__";

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function KommentarerFilteredList({ comments, totalCount, currentUser }: Props) {
  const router = useRouter();
  const [clubKey, setClubKey] = useState<string>(ALL_CLUBS);
  const [query, setQuery] = useState("");
  const [messageDraft, setMessageDraft] = useState<Record<string, string>>({});
  const [expandedHandled, setExpandedHandled] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});

  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const c of comments) {
      const t = c.home_club?.trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [comments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return comments.filter((c) => {
      const club = c.home_club?.trim() ?? "";
      if (clubKey !== ALL_CLUBS && club !== clubKey) return false;
      if (!needle) return true;
      const threadBlob = (c.internal_thread ?? [])
        .map((m) => [m.body, m.author_name].join("\n"))
        .join("\n");
      const blob = [
        c.comment_text,
        c.author_name,
        c.author_phone,
        club,
        c.created_at,
        c.ll_status_text,
        c.ll_status_author_name,
        threadBlob,
      ]
        .join("\n")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [comments, clubKey, query]);

  const filterActive =
    clubKey !== ALL_CLUBS || query.trim().length > 0 || filtered.length !== totalCount;

  async function postInternalMessage(commentId: string) {
    const text = (messageDraft[commentId] ?? "").trim();
    if (!text) {
      setErrorById((e) => ({ ...e, [commentId]: "Skriv en besked før du sender." }));
      return;
    }
    if (!currentUser) {
      setErrorById((e) => ({ ...e, [commentId]: "Du skal være logget ind." }));
      return;
    }
    setErrorById((e) => ({ ...e, [commentId]: null }));
    setBusyId(commentId);
    const supabase = getAuthBrowserClient();
    const { error } = await supabase.from("club_feedback_internal_messages").insert({
      club_feedback_id: commentId,
      event_id: LYKKECUP_EVENT_ID,
      body: text,
      author_id: currentUser.id,
      author_name: currentUser.fullName,
      author_avatar_url: currentUser.avatarUrl,
    });

    setBusyId(null);
    if (error) {
      const hint =
        error.message.includes("relation") || error.message.includes("does not exist")
          ? "Kør migration club_feedback_internal_thread i Supabase."
          : error.message;
      setErrorById((e) => ({ ...e, [commentId]: hint }));
      return;
    }
    setMessageDraft((d) => ({ ...d, [commentId]: "" }));
    router.refresh();
  }

  async function markHandled(commentId: string) {
    if (!currentUser) {
      setErrorById((e) => ({ ...e, [commentId]: "Du skal være logget ind." }));
      return;
    }
    setErrorById((e) => ({ ...e, [commentId]: null }));
    setBusyId(commentId);
    const supabase = getAuthBrowserClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("club_feedback")
      .update({
        handled_at: now,
        handled_by: currentUser.id,
      })
      .eq("id", commentId)
      .eq("event_id", LYKKECUP_EVENT_ID);

    setBusyId(null);
    if (error) {
      setErrorById((e) => ({
        ...e,
        [commentId]: error.message.includes("column") ? "Database mangler kolonner — kør migration i Supabase." : error.message,
      }));
      return;
    }
    setExpandedHandled((prev) => ({ ...prev, [commentId]: false }));
    router.refresh();
  }

  async function reopenComment(commentId: string) {
    if (!currentUser) {
      setErrorById((e) => ({ ...e, [commentId]: "Du skal være logget ind." }));
      return;
    }
    setErrorById((e) => ({ ...e, [commentId]: null }));
    setBusyId(commentId);
    const supabase = getAuthBrowserClient();
    const { error } = await supabase
      .from("club_feedback")
      .update({
        handled_at: null,
        handled_by: null,
      })
      .eq("id", commentId)
      .eq("event_id", LYKKECUP_EVENT_ID);

    setBusyId(null);
    if (error) {
      setErrorById((e) => ({
        ...e,
        [commentId]: error.message.includes("column") ? "Database mangler kolonner — kør migration i Supabase." : error.message,
      }));
      return;
    }
    setExpandedHandled((prev) => ({ ...prev, [commentId]: false }));
    router.refresh();
  }

  async function deleteComment(commentId: string) {
    if (!currentUser) {
      setErrorById((e) => ({ ...e, [commentId]: "Du skal være logget ind." }));
      return;
    }
    const ok = window.confirm(
      "Slette denne kommentar permanent? Den forsvinder også fra den offentlige coach-feedback-side.",
    );
    if (!ok) return;

    setErrorById((e) => ({ ...e, [commentId]: null }));
    setBusyId(commentId);
    const supabase = getAuthBrowserClient();
    const { error } = await supabase.from("club_feedback").delete().eq("id", commentId).eq("event_id", LYKKECUP_EVENT_ID);

    setBusyId(null);
    if (error) {
      setErrorById((e) => ({
        ...e,
        [commentId]:
          error.message.includes("permission") || error.message.includes("policy")
            ? "Ingen rettighed til at slette — kør migration club_feedback_authenticated_delete i Supabase."
            : error.message,
      }));
      return;
    }
    setExpandedHandled((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
    setMessageDraft((d) => {
      const next = { ...d };
      delete next[commentId];
      return next;
    });
    router.refresh();
  }

  if (comments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        Der er endnu ingen kommentarer registreret.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="kommentarer-club"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Klub
          </label>
          <StyledSelect
            id="kommentarer-club"
            value={clubKey}
            onChange={(e) => setClubKey(e.target.value)}
            className="rounded-lg border border-lc-border bg-white py-2.5 pl-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/25 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value={ALL_CLUBS}>Alle klubber</option>
            {clubs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[min(100%,20rem)]">
          <label
            htmlFor="kommentarer-search"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Søg
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="kommentarer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i kommentarer, træner eller klub …"
              autoComplete="off"
              className="w-full rounded-lg border border-lc-border bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/25 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {filterActive ? (
          <>
            Viser{" "}
            <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
              {filtered.length}
            </span>{" "}
            af {totalCount} {totalCount === 1 ? "kommentar" : "kommentarer"}
          </>
        ) : (
          <>
            {totalCount} {totalCount === 1 ? "kommentar" : "kommentarer"} i alt
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          Ingen kommentarer matcher filtrene.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((c) => {
            const handled = Boolean(c.handled_at);
            const expanded = expandedHandled[c.id] === true;

            if (handled && !expanded) {
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedHandled((prev) => ({ ...prev, [c.id]: true }))}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-left shadow-sm transition hover:bg-emerald-100/90 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/50"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <span className="font-semibold text-emerald-900 dark:text-emerald-100">Håndteret</span>
                      <span className="text-xs tabular-nums text-emerald-800/90 dark:text-emerald-200/90">
                        {c.handled_at ? formatDaDateTime(c.handled_at) : ""}
                      </span>
                      <span className="truncate text-sm text-emerald-900/80 dark:text-emerald-200/80">
                        · {c.home_club?.trim() || "—"}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                  </button>
                </li>
              );
            }

            return (
              <li
                key={c.id}
                className={`overflow-hidden rounded-xl border shadow-lc-card dark:shadow-none ${
                  handled
                    ? "border-emerald-200 bg-white dark:border-emerald-900/40 dark:bg-gray-900/35"
                    : "border-lc-border bg-white dark:border-gray-700 dark:bg-gray-900/35"
                }`}
              >
                {handled ? (
                  <button
                    type="button"
                    onClick={() => setExpandedHandled((prev) => ({ ...prev, [c.id]: false }))}
                    className="flex w-full items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/90 px-4 py-2.5 text-left text-sm font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                      Håndteret · klik for at folde sammen
                    </span>
                    <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
                  </button>
                ) : null}

                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-lc-border bg-gray-50/80 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {c.home_club?.trim() || "—"}
                  </p>
                  <time
                    className="text-xs tabular-nums text-gray-500 dark:text-gray-400"
                    dateTime={c.created_at}
                  >
                    {formatDaDateTime(c.created_at)}
                  </time>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {c.author_name}
                  </p>
                  {c.author_phone?.trim() ? (
                    <p className="mt-1 text-xs tabular-nums text-gray-600 dark:text-gray-400">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Telefon:</span>{" "}
                      {c.author_phone.trim()}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {c.comment_text}
                  </p>
                </div>

                <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0d9488] dark:text-teal-400">
                    Intern diskussion
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Kun synlig her i KontrolCenter. Flere admins kan skrive flere gange hver.
                  </p>

                  {c.ll_status_text?.trim() ? (
                    <div className="mt-3">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Historisk (før tråd)
                      </p>
                      <div className="mt-1.5 flex gap-3 rounded-lg border border-dashed border-gray-300 bg-white/90 p-3 dark:border-gray-600 dark:bg-gray-900/80">
                        {c.ll_status_author_avatar_url ? (
                          <img
                            src={c.ll_status_author_avatar_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                          />
                        ) : (
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                            {initialsFromName(c.ll_status_author_name ?? "?")}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {c.ll_status_author_name ?? "Admin"}
                          </p>
                          {c.ll_status_created_at ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDaDateTime(c.ll_status_created_at)}
                            </p>
                          ) : null}
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {c.ll_status_text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {(c.internal_thread ?? []).map((m) => (
                    <div
                      key={m.id}
                      className="mt-3 flex gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/80"
                    >
                      {m.author_avatar_url ? (
                        <img
                          src={m.author_avatar_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                        />
                      ) : (
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                          {initialsFromName(m.author_name ?? "?")}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {m.author_name ?? "Admin"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDaDateTime(m.created_at)}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{m.body}</p>
                      </div>
                    </div>
                  ))}

                  {!c.ll_status_text?.trim() && (c.internal_thread ?? []).length === 0 ? (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Ingen beskeder endnu.</p>
                  ) : null}

                  {currentUser ? (
                    <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 dark:border-gray-600">
                      <label className="block">
                        <span className="sr-only">Ny besked i tråden</span>
                        <textarea
                          value={messageDraft[c.id] ?? ""}
                          onChange={(e) => setMessageDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                          rows={3}
                          placeholder="Skriv til de andre admins om denne kommentar …"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void postInternalMessage(c.id)}
                          className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-200"
                        >
                          {busyId === c.id ? "Sender…" : "Send besked"}
                        </button>
                        {!handled ? (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => void markHandled(c.id)}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                          >
                            Marker som håndteret
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => void reopenComment(c.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            Åbn igen (ikke håndteret)
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void deleteComment(c.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-60 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Slet kommentar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Log ind for at skrive i tråden.</p>
                  )}

                  {errorById[c.id] ? (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorById[c.id]}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
