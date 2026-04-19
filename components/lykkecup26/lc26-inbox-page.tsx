"use client";

import { ChevronRight, Inbox, Lock, Mail, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { lc26InboxUnlockDate, type Lc26InboxMessageDef } from "@/lib/lc26-public-messages";
import { type Lc26InboxRow, useLc26Inbox } from "@/components/lykkecup26/use-lc26-inbox";

const BRAND = "#df6763";
const BRAND_SOFT = "rgb(223 103 99 / 0.12)";

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

function Avatar({ def, size }: { def: Lc26InboxMessageDef; size: "sm" | "md" }) {
  const cls = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  if (def.avatarSrc) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white bg-stone-100 shadow-sm ring-1 ring-stone-200/80 ${cls}`}
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
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-stone-100 text-xs font-bold text-lc26-navy/70 shadow-sm ring-1 ring-stone-200/80 ${cls}`}
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
    <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-3 pb-12 pt-5 sm:max-w-2xl sm:px-5 sm:pb-16 sm:pt-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 rounded-b-[2rem] bg-gradient-to-b from-[rgb(223_103_99/0.18)] via-[rgb(223_103_99/0.06)] to-transparent sm:h-64"
        aria-hidden
      />

      <div
        className="relative overflow-hidden rounded-2xl border-2 bg-white shadow-[0_28px_56px_-32px_rgb(15_30_60/0.35),0_0_0_1px_rgb(223_103_99/0.06)_inset] dark:border-[#df6763]/35 dark:bg-gray-950"
        style={{ borderColor: "rgb(223 103 99 / 0.42)" }}
      >
        <div
          className="h-1.5 w-full bg-gradient-to-r from-[#ea908b] via-[#df6763] to-[#c24e4a]"
          aria-hidden
        />

        <header className="border-b px-4 pb-5 pt-5 sm:px-6" style={{ borderColor: BRAND_SOFT, background: `linear-gradient(180deg, ${BRAND_SOFT} 0%, transparent 100%)` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-14 sm:w-14"
                style={{ backgroundColor: BRAND, boxShadow: "0 10px 28px -8px rgb(223 103 99 / 0.55)" }}
              >
                <Inbox className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#c45450] dark:text-[#e89590]">
                  LykkeCup 26 · indbakke
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem] dark:text-white">
                  Beskeder
                </h1>
                <p className="mt-2 flex items-start gap-2 text-sm leading-snug text-lc26-navy/55 dark:text-gray-400">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#df6763]/70" strokeWidth={2} aria-hidden />
                  <span>
                    Hver besked kan åbnes fra det tidspunkt, den er planlagt til — indtil da vises den som låst.
                  </span>
                </p>
              </div>
            </div>
            {unreadCount > 0 ? (
              <span
                className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold text-white shadow-md"
                style={{ backgroundColor: BRAND, boxShadow: "0 4px 14px -4px rgb(223 103 99 / 0.65)" }}
                aria-label={`${unreadCount} ulæste`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </div>
        </header>

        <div className="bg-gradient-to-b from-stone-50/90 to-stone-100/80 px-2 py-3 dark:from-gray-900/80 dark:to-gray-950/90 sm:px-3 sm:py-4">
          {fetchError ? (
            <p
              className="mx-1 mb-3 rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              Kunne ikke hente beskeder: {fetchError}
            </p>
          ) : null}
          {messagesLoading && !fetchError ? (
            <p className="mb-3 px-3 text-sm text-lc26-navy/50 dark:text-gray-400">Indlæser beskeder…</p>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-[0_1px_0_rgb(255_255_255/0.8)_inset,0_8px_24px_-16px_rgb(15_30_60/0.12)] dark:border-gray-700 dark:bg-gray-900 dark:shadow-none">
            <ul className="divide-y divide-stone-100 dark:divide-gray-800">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={!row.unlocked}
                    onClick={() => openRow(row)}
                    className={`flex w-full items-center gap-3 px-3 py-3.5 text-left transition sm:gap-4 sm:px-4 sm:py-4 ${
                      row.unlocked ? "hover:bg-[rgb(223_103_99/0.04)] active:bg-[rgb(223_103_99/0.07)] dark:hover:bg-white/[0.04]" : "cursor-default opacity-[0.58]"
                    } ${row.status === "unread" ? "bg-[rgb(223_103_99/0.07)] dark:bg-[rgb(223_103_99/0.1)]" : ""}`}
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
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-lc26-navy/45 dark:text-gray-500">
                            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                            {unlockPreviewLabel(lc26InboxUnlockDate(row))}
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
                    </div>
                    {row.unlocked ? (
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#df6763]/35 dark:text-[#df6763]/50" strokeWidth={2} aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="mx-1 mt-4 rounded-lg border border-[#df6763]/15 bg-[rgb(223_103_99/0.05)] px-3 py-2.5 text-center text-[0.8125rem] leading-relaxed text-lc26-navy/48 dark:border-[#df6763]/20 dark:bg-[rgb(223_103_99/0.08)] dark:text-gray-400">
            Dette er en leg i appen — der sendes ingen rigtige beskeder. Arrangøren planlægger små hilsner, der dukker op
            her på de valgte tidspunkter.
          </p>

          <div className="mt-4 text-center">
            <Link
              href="/lykkecup26"
              className="inline-flex items-center justify-center rounded-full border-2 border-[#df6763]/35 bg-white px-4 py-2 text-sm font-semibold text-[#c45450] shadow-sm transition hover:border-[#df6763]/55 hover:bg-[rgb(223_103_99/0.06)] dark:border-[#df6763]/40 dark:bg-gray-900 dark:text-[#e8a09c] dark:hover:bg-[rgb(223_103_99/0.1)]"
            >
              Tilbage til forsiden
            </Link>
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <button type="button" className="absolute inset-0 bg-lc26-navy/50 backdrop-blur-[2px]" aria-label="Luk" onClick={() => setOpen(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-2xl dark:border-[#df6763]/45 dark:bg-gray-950"
            style={{ borderColor: BRAND }}
          >
            <div className="h-1 w-full bg-gradient-to-r from-[#ea908b] via-[#df6763] to-[#c24e4a]" aria-hidden />
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-gradient-to-b from-[rgb(223_103_99/0.12)] to-[rgb(223_103_99/0.04)] px-4 py-3 dark:border-gray-800 dark:from-[rgb(223_103_99/0.15)] dark:to-transparent sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar def={open} size="md" />
                <div className="min-w-0">
                  <p id={titleId} className="truncate text-sm font-semibold text-lc26-navy dark:text-white">
                    {open.fromName}
                  </p>
                  <p className="truncate text-xs text-lc26-navy/50 dark:text-gray-400">{open.subject}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-white/80 hover:text-lc26-navy dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="Luk"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
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
