"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { formatDaDateTime } from "@/lib/datetime";
import { LYKKECUP_EVENT_ID } from "@/lib/players";

export type CupChatCurrentUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
};

type ChatRow = {
  id: string;
  event_id: string;
  parent_id: string | null;
  body: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  created_at: string;
};

type Thread = {
  top: ChatRow;
  replies: ChatRow[];
};

type LikeSummary = { count: number; likedByMe: boolean };

const emptyLikeSummary = (): LikeSummary => ({ count: 0, likedByMe: false });

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

function Avatar({
  name,
  avatarUrl,
  sizeClass = "h-9 w-9",
}: {
  name: string;
  avatarUrl: string | null;
  sizeClass?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600`}
      />
    );
  }
  return (
    <span
      className={`inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-900/50 dark:text-teal-200`}
    >
      {initialsFromName(name)}
    </span>
  );
}

function MessageBlock({
  row,
  likeSummary,
  likeDisabled,
  onToggleLike,
}: {
  row: ChatRow;
  likeSummary: LikeSummary;
  likeDisabled: boolean;
  onToggleLike: () => void;
}) {
  const { count, likedByMe } = likeSummary;
  return (
    <div className="flex gap-3">
      <Avatar name={row.author_name} avatarUrl={row.author_avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{row.author_name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDaDateTime(row.created_at)}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{row.body}</p>
        <div className="mt-2">
          <button
            type="button"
            onClick={onToggleLike}
            disabled={likeDisabled}
            aria-pressed={likedByMe}
            aria-label={likedByMe ? "Fjern synes godt om" : "Synes godt om"}
            title={likedByMe ? "Fjern synes godt om" : "Synes godt om"}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              likedByMe
                ? "border-teal-400/60 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-950/50 dark:text-teal-100"
                : "border-gray-200 bg-white text-gray-600 hover:border-teal-200 hover:bg-teal-50/60 hover:text-teal-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-teal-800 dark:hover:bg-teal-950/30 dark:hover:text-teal-100"
            }`}
          >
            <ThumbsUp
              className={`h-3.5 w-3.5 shrink-0 ${likedByMe ? "fill-teal-600 text-teal-600 dark:fill-teal-400 dark:text-teal-400" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
            <span>{count}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function CupChatClient({ currentUser }: { currentUser: CupChatCurrentUser | null }) {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [likesByMessageId, setLikesByMessageId] = useState<Record<string, LikeSummary>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [likeBusyMessageId, setLikeBusyMessageId] = useState<string | null>(null);
  const [topDraft, setTopDraft] = useState("");
  const [replyDraftByParentId, setReplyDraftByParentId] = useState<Record<string, string>>({});
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getAuthBrowserClient();
    const { data, error } = await supabase
      .from("holddannelse_chat_messages")
      .select("id, event_id, parent_id, body, author_id, author_name, author_avatar_url, created_at")
      .eq("event_id", LYKKECUP_EVENT_ID)
      .order("created_at", { ascending: false });

    if (error) {
      const hint =
        error.message.includes("relation") || error.message.includes("does not exist")
          ? "Kør migration holddannelse_chat_messages i Supabase."
          : error.message;
      setLoadError(hint);
      setRows([]);
      setLikesByMessageId({});
      return;
    }
    setLoadError(null);
    const list = (data ?? []) as ChatRow[];
    setRows(list);

    const ids = list.map((r) => r.id);
    const uid = currentUser?.id ?? null;
    const likesMap: Record<string, LikeSummary> = {};
    for (const id of ids) likesMap[id] = emptyLikeSummary();

    if (ids.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("holddannelse_chat_message_likes")
        .select("message_id, user_id")
        .in("message_id", ids);

      if (!likesError && likesData) {
        for (const row of likesData as { message_id: string; user_id: string }[]) {
          const cur = likesMap[row.message_id] ?? emptyLikeSummary();
          cur.count += 1;
          if (uid && row.user_id === uid) cur.likedByMe = true;
          likesMap[row.message_id] = cur;
        }
      }
    }
    setLikesByMessageId(likesMap);
  }, [currentUser?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getAuthBrowserClient();
    const channel = supabase
      .channel("cup-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "holddannelse_chat_messages",
          filter: `event_id=eq.${LYKKECUP_EVENT_ID}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "holddannelse_chat_message_likes" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "holddannelse_chat_message_likes" },
        () => {
          void load();
        },
      )
      .subscribe();

    const id = window.setInterval(() => {
      void load();
    }, 25_000);

    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const threads = useMemo((): Thread[] => {
    const tops = rows
      .filter((r) => r.parent_id === null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const repliesByParent = new Map<string, ChatRow[]>();
    for (const r of rows) {
      if (r.parent_id === null) continue;
      const list = repliesByParent.get(r.parent_id) ?? [];
      list.push(r);
      repliesByParent.set(r.parent_id, list);
    }
    for (const [, list] of repliesByParent) {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return tops.map((top) => ({
      top,
      replies: repliesByParent.get(top.id) ?? [],
    }));
  }, [rows]);

  async function insertMessage(body: string, parentId: string | null) {
    const text = body.trim();
    if (!text) {
      setPostError("Skriv en besked før du sender.");
      return;
    }
    if (!currentUser) {
      setPostError("Du skal være logget ind.");
      return;
    }
    setPostError(null);
    setBusy(true);
    const supabase = getAuthBrowserClient();
    const { error } = await supabase.from("holddannelse_chat_messages").insert({
      event_id: LYKKECUP_EVENT_ID,
      parent_id: parentId,
      body: text,
      author_id: currentUser.id,
      author_name: currentUser.fullName,
      author_avatar_url: currentUser.avatarUrl,
    });
    setBusy(false);
    if (error) {
      const hint =
        error.message.includes("relation") || error.message.includes("does not exist")
          ? "Kør migration holddannelse_chat_messages i Supabase."
          : error.message;
      setPostError(hint);
      return;
    }
    if (parentId === null) setTopDraft("");
    else setReplyDraftByParentId((d) => ({ ...d, [parentId]: "" }));
    await load();
  }

  async function toggleLike(messageId: string) {
    if (!currentUser) return;
    const summary = likesByMessageId[messageId] ?? emptyLikeSummary();
    setLikeBusyMessageId(messageId);
    setPostError(null);
    const supabase = getAuthBrowserClient();
    if (summary.likedByMe) {
      const { error } = await supabase
        .from("holddannelse_chat_message_likes")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUser.id);
      setLikeBusyMessageId(null);
      if (error) {
        const hint =
          error.message.includes("relation") || error.message.includes("does not exist")
            ? "Kør migration for synes godt om (holddannelse_chat_message_likes) i Supabase."
            : error.message;
        setPostError(hint);
        return;
      }
    } else {
      const { error } = await supabase.from("holddannelse_chat_message_likes").insert({
        message_id: messageId,
        user_id: currentUser.id,
      });
      setLikeBusyMessageId(null);
      if (error) {
        const hint =
          error.message.includes("relation") || error.message.includes("does not exist")
            ? "Kør migration for synes godt om (holddannelse_chat_message_likes) i Supabase."
            : error.message;
        setPostError(hint);
        return;
      }
    }
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          KontrolCenter
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">CupChat</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Kort intern chat for dem, der sidder forskellige steder: skriv f.eks. hvilket niveau eller hold du arbejder
          på. Nyeste besked øverst; du kan svare under hver tråd.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </div>
      ) : null}

      {postError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {postError}
        </div>
      ) : null}

      {currentUser ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ny besked</h2>
          <div className="mt-3 flex gap-3">
            <div className="shrink-0 pt-0.5">
              <Avatar name={currentUser.fullName} avatarUrl={currentUser.avatarUrl} sizeClass="h-11 w-11" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Du skriver som <span className="font-medium text-gray-900 dark:text-white">{currentUser.fullName}</span>
              </p>
              <label className="block">
                <span className="sr-only">Ny besked til alle</span>
                <textarea
                  value={topDraft}
                  onChange={(e) => setTopDraft(e.target.value)}
                  rows={3}
                  placeholder="Skriv en lykkelig besked..."
                  disabled={busy}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void insertMessage(topDraft, null)}
              className="rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 dark:border-emerald-500/20 dark:from-emerald-600 dark:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500"
            >
              {busy ? "Sender…" : "Send"}
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Log ind for at skrive i CupChat.</p>
      )}

      <section aria-label="Beskeder">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Samtale</h2>
        {threads.length === 0 && !loadError ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Ingen beskeder endnu.</p>
        ) : (
          <ul className="mt-4 space-y-6">
            {threads.map(({ top, replies }) => (
              <li
                key={top.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40"
              >
                <MessageBlock
                  row={top}
                  likeSummary={likesByMessageId[top.id] ?? emptyLikeSummary()}
                  likeDisabled={!currentUser || likeBusyMessageId === top.id || busy}
                  onToggleLike={() => void toggleLike(top.id)}
                />
                {replies.length > 0 ? (
                  <ul className="mt-4 space-y-3 border-l-2 border-teal-100 pl-4 dark:border-teal-900/40">
                    {replies.map((r) => (
                      <li key={r.id} className="rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/50">
                        <MessageBlock
                          row={r}
                          likeSummary={likesByMessageId[r.id] ?? emptyLikeSummary()}
                          likeDisabled={!currentUser || likeBusyMessageId === r.id || busy}
                          onToggleLike={() => void toggleLike(r.id)}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {currentUser ? (
                  <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700/80">
                    <label className="block">
                      <span className="sr-only">Svar i tråden</span>
                      <textarea
                        value={replyDraftByParentId[top.id] ?? ""}
                        onChange={(e) =>
                          setReplyDraftByParentId((d) => ({ ...d, [top.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Skriv en lykkelig besked..."
                        disabled={busy}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void insertMessage(replyDraftByParentId[top.id] ?? "", top.id)}
                        className="rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 dark:border-emerald-500/20 dark:from-emerald-600 dark:to-teal-600 dark:hover:from-emerald-500 dark:hover:to-teal-500"
                      >
                        {busy ? "Sender…" : "Svar"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
