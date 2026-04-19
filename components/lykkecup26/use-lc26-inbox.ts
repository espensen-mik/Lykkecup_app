"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LC26_INBOX_CHANGED,
  fetchLc26PublicMessages,
  lc26InboxIsUnlocked,
  type Lc26InboxMessageDef,
} from "@/lib/lc26-public-messages";

const READ_KEY = "lc26-inbox-read-ids";

function readIdSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeIdSet(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(LC26_INBOX_CHANGED));
  } catch {
    /* ignore */
  }
}

export type Lc26InboxRow = Lc26InboxMessageDef & {
  unlocked: boolean;
  read: boolean;
  status: "scheduled" | "unread" | "read";
};

export function useLc26Inbox() {
  const [now, setNow] = useState(() => new Date());
  const [readIds, setReadIds] = useState<Set<string>>(readIdSet);
  const [defs, setDefs] = useState<Lc26InboxMessageDef[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(true);

  const refreshRead = useCallback(() => {
    setReadIds(readIdSet());
  }, []);

  const reloadMessages = useCallback(async () => {
    const { data, error } = await fetchLc26PublicMessages();
    setDefs(data);
    setFetchError(error);
    setMessagesLoading(false);
  }, []);

  useEffect(() => {
    void reloadMessages();
    const poll = window.setInterval(() => void reloadMessages(), 60_000);
    return () => window.clearInterval(poll);
  }, [reloadMessages]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    const on = () => refreshRead();
    window.addEventListener(LC26_INBOX_CHANGED, on);
    window.addEventListener("storage", on);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(LC26_INBOX_CHANGED, on);
      window.removeEventListener("storage", on);
    };
  }, [refreshRead]);

  const rows = useMemo((): Lc26InboxRow[] => {
    return defs.map((def) => {
      const unlocked = lc26InboxIsUnlocked(def, now);
      const read = readIds.has(def.id);
      let status: Lc26InboxRow["status"];
      if (!unlocked) status = "scheduled";
      else if (!read) status = "unread";
      else status = "read";
      return { ...def, unlocked, read, status };
    });
  }, [now, readIds, defs]);

  const unreadCount = useMemo(() => rows.filter((r) => r.status === "unread").length, [rows]);

  const markRead = useCallback((id: string) => {
    const next = readIdSet();
    if (next.has(id)) return;
    next.add(id);
    writeIdSet(next);
    setReadIds(next);
  }, []);

  return { rows, unreadCount, markRead, now, fetchError, messagesLoading, reloadMessages };
}
