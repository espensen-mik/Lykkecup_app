"use client";

import { ChevronRight, Lock, MessageSquare, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { lc26InboxUnlockDate, type Lc26InboxMessageDef } from "@/lib/lc26-public-messages";
import { Lc26GuestMessageForm } from "@/components/lykkecup26/lc26-guest-message-form";
import { type Lc26InboxRow, useLc26Inbox } from "@/components/lykkecup26/use-lc26-inbox";

const BRAND = "#df6763";

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
}

function unlockPreviewLabel(d: Date): string {
  return d.toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDaDateTime(iso: string): string {
  return new Date(iso).toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Én linje under emnet: oprettet (hvis kendt) + hvornår beskeden er aktiv. */
function inboxRowTimeLine(def: Lc26InboxMessageDef): string {
  const active = formatDaDateTime(def.availableAt);
  if (def.createdAt) {
    const created = formatDaDateTime(def.createdAt);
    return `Oprettet ${created} · Aktiv ${active}`;
  }
  return `Aktiv ${active}`;
}

function Avatar({ def, size }: { def: Lc26InboxMessageDef; size: "sm" | "md" }) {
  const cls = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  if (def.avatarSrc) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 shadow-sm ring-1 ring-stone-200/60 ${cls}`}
      >
        <Image
          src={def.avatarSrc}
          alt=""
          fill
          className="object-cover"
          sizes={size === "sm" ? "44px" : "48px"}
          unoptimized={def.avatarSrc.startsWith("http://") || def.avatarSrc.startsWith("https://")}
        />
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-xs font-bold text-lc26-navy/70 shadow-sm ring-1 ring-stone-200/60 ${cls}`}
      aria-hidden
    >
      {initials(def.fromName)}
    </div>
  );
}

export function Lc26InboxPage() {
  const titleId = useId();
  const { rows, unreadCount, markRead, fetchError, messagesLoading } = useLc26Inbox();
  const [open, setOpen] = useState<Lc26InboxRow | null>(null);
  const totalCount = rows.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openRow = useCallback(
    (row: Lc26InboxRow) => {
      if (!row.unlocked) return;
      setOpen(row);
      markRead(row.id);
    },
    [markRead],
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col pb-12 pt-0 sm:max-w-2xl sm:pb-16">
      <header className="border-b border-stone-200/95 bg-gradient-to-b from-white via-white to-stone-50/90 px-4 pb-5 pt-5 shadow-[0_1px_0_rgb(255_255_255/0.8)_inset] sm:px-6 sm:pb-6 sm:pt-6 dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900/95">
        <div className="flex items-start gap-4 sm:gap-5">
          <MessageSquare
            className="mt-0.5 h-9 w-9 shrink-0 text-[#df6763] sm:h-10 sm:w-10"
            strokeWidth={2}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-lc26-navy dark:text-white sm:text-[1.75rem]">
              Beskeder
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-lc26-navy/60 dark:text-gray-400 sm:text-[0.9375rem]">
              Dette er din LykkeCup 26 indbakke, hvor du modtager beskeder på dagen.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {!messagesLoading ? (
              <span
                className="rounded-full border border-stone-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums text-lc26-navy/75 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                aria-label={`${totalCount} beskeder i alt`}
              >
                {totalCount} {totalCount === 1 ? "besked" : "beskeder"}
              </span>
            ) : null}
            {unreadCount > 0 ? (
              <span
                className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-white shadow-sm"
                style={{ backgroundColor: BRAND }}
                aria-label={`${unreadCount} ulæste`}
              >
                {unreadCount} ulæst{unreadCount !== 1 ? "e" : ""}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="px-3 pt-4 sm:px-5 sm:pt-5">
        {fetchError ? (
          <p
            className="mb-4 rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            Kunne ikke hente beskeder: {fetchError}
          </p>
        ) : null}
        {messagesLoading && !fetchError ? (
          <p className="mb-4 text-sm text-lc26-navy/50 dark:text-gray-400">Indlæser beskeder…</p>
        ) : null}

        <ul className="divide-y divide-stone-200 border-y border-stone-200/90 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                disabled={!row.unlocked}
                onClick={() => openRow(row)}
                className={`flex w-full items-center gap-3 px-3 py-3.5 text-left transition sm:gap-4 sm:px-4 sm:py-4 ${
                  row.unlocked ? "hover:bg-stone-50 active:bg-stone-100/90 dark:hover:bg-white/[0.04]" : "cursor-default opacity-[0.58]"
                } ${row.status === "unread" ? "bg-[rgb(223_103_99/0.06)] dark:bg-[rgb(223_103_99/0.1)]" : ""}`}
              >
                <Avatar def={row} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`truncate text-[0.9375rem] ${row.status === "unread" ? "font-bold text-lc26-navy dark:text-white" : "font-medium text-lc26-navy/90 dark:text-gray-200"}`}
                    >
                      {row.fromName}
                    </p>
                    {!row.unlocked ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-lc26-navy/45 dark:text-gray-500" title="Låses op på dette tidspunkt">
                        <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                        <span className="hidden min-[380px]:inline">{unlockPreviewLabel(lc26InboxUnlockDate(row))}</span>
                      </span>
                    ) : row.status === "read" ? (
                      <span className="shrink-0 text-[11px] text-lc26-navy/38 dark:text-gray-500">Læst</span>
                    ) : (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
                    )}
                  </div>
                  <p
                    className={`mt-0.5 truncate text-sm ${row.status === "unread" ? "font-semibold text-lc26-navy/78 dark:text-gray-300" : "text-lc26-navy/55 dark:text-gray-500"}`}
                  >
                    {row.subject}
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-snug text-lc26-navy/42 dark:text-gray-500">
                    {inboxRowTimeLine(row)}
                  </p>
                </div>
                {row.unlocked ? (
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#df6763]/35 dark:text-[#df6763]/50" strokeWidth={2} aria-hidden />
                ) : null}
              </button>
            </li>
          ))}
        </ul>

        <Lc26GuestMessageForm />

        <div className="mt-8 text-center">
          <Link
            href="/lykkecup26"
            className="inline-flex items-center justify-center rounded-full border-2 border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-lc26-navy shadow-sm transition hover:border-[#df6763]/40 hover:text-[#c45450] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-[#df6763]/50"
          >
            Tilbage til forsiden
          </Link>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <button type="button" className="absolute inset-0 bg-lc26-navy/50 backdrop-blur-[2px]" aria-label="Luk" onClick={() => setOpen(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 border-stone-200/90 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950"
          >
            <div className="border-b border-stone-100 bg-gradient-to-b from-stone-50 to-white px-4 pb-3 pt-4 dark:border-gray-800 dark:from-gray-900 dark:to-gray-950 sm:px-5 sm:pb-4 sm:pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar def={open} size="md" />
                  <div className="min-w-0">
                    <p id={titleId} className="truncate text-sm font-semibold text-lc26-navy dark:text-white">
                      {open.fromName}
                    </p>
                    <p className="truncate text-xs text-lc26-navy/50 dark:text-gray-400">{open.subject}</p>
                    <p className="mt-1 text-[11px] font-medium text-lc26-navy/45 dark:text-gray-500">{inboxRowTimeLine(open)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-stone-100 hover:text-lc26-navy dark:text-gray-400 dark:hover:bg-gray-800"
                  aria-label="Luk"
                >
                  <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[rgb(252_252_251)] px-4 py-4 text-sm leading-relaxed text-lc26-navy/88 dark:bg-gray-900/50 dark:text-gray-200 sm:px-5 sm:py-5">
              {open.body.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
            <div className="border-t border-stone-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950 sm:px-5">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 active:scale-[0.99]"
                style={{ backgroundColor: BRAND, boxShadow: "0 6px 20px -8px rgb(223 103 99 / 0.55)" }}
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
