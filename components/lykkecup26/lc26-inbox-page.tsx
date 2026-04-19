"use client";

import { ChevronRight, Inbox, Lock, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { lc26InboxUnlockDate, type Lc26InboxMessageDef } from "@/lib/lc26-public-messages";
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

function Avatar({ def, size }: { def: Lc26InboxMessageDef; size: "sm" | "md" }) {
  const cls = size === "sm" ? "h-11 w-11" : "h-12 w-12";
  if (def.avatarSrc) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 ${cls}`}>
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
      className={`flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-xs font-bold text-lc26-navy/70 ${cls}`}
      aria-hidden
    >
      {initials(def.fromName)}
    </div>
  );
}

export function Lc26InboxPage() {
  const titleId = useId();
  const { rows, unreadCount, markRead, cupPhase, cupDayLabel, fetchError, messagesLoading } = useLc26Inbox();
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
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-8 sm:max-w-2xl sm:px-6 sm:pb-16 sm:pt-10">
      <header className="border-b border-stone-200/90 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
            >
              <Inbox className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-lc26-navy">Beskeder</h1>
              <p className="mt-1 text-sm leading-snug text-lc26-navy/50">
                {cupPhase < 0
                  ? `Dine beskeder åbner på LykkeCup-dagen (${cupDayLabel}).`
                  : cupPhase > 0
                    ? "Her er alle hilsner fra dagen — du kan stadig læse dem."
                    : "Beskederne låses op løbende i løbet af dagen."}
              </p>
            </div>
          </div>
          {unreadCount > 0 ? (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: BRAND }}
              aria-label={`${unreadCount} ulæste`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>
      </header>

      {fetchError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">
          Kunne ikke hente beskeder: {fetchError}
        </p>
      ) : null}
      {messagesLoading && !fetchError ? (
        <p className="mt-4 text-sm text-lc26-navy/50">Indlæser beskeder…</p>
      ) : null}

      <ul className="mt-2 divide-y divide-stone-200/90 border-b border-stone-200/90">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              disabled={!row.unlocked}
              onClick={() => openRow(row)}
              className={`flex w-full items-center gap-3 py-4 text-left transition sm:gap-4 ${
                row.unlocked ? "hover:bg-stone-50 active:bg-stone-100/80" : "cursor-default opacity-60"
              } ${row.status === "unread" ? "bg-[rgb(223_103_99/0.06)]" : ""}`}
            >
              <Avatar def={row} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`truncate text-[0.9375rem] ${row.status === "unread" ? "font-bold text-lc26-navy" : "font-medium text-lc26-navy/90"}`}
                  >
                    {row.fromName}
                  </p>
                  {!row.unlocked ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-lc26-navy/45">
                      <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                      {unlockPreviewLabel(lc26InboxUnlockDate(row))}
                    </span>
                  ) : row.status === "read" ? (
                    <span className="shrink-0 text-[11px] text-lc26-navy/38">Læst</span>
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: BRAND }} aria-hidden />
                  )}
                </div>
                <p
                  className={`mt-0.5 truncate text-sm ${row.status === "unread" ? "font-semibold text-lc26-navy/75" : "text-lc26-navy/55"}`}
                >
                  {row.subject}
                </p>
              </div>
              {row.unlocked ? (
                <ChevronRight className="h-5 w-5 shrink-0 text-lc26-navy/25" strokeWidth={2} aria-hidden />
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs leading-relaxed text-lc26-navy/42">
        Dette er en leg i appen — der sendes ingen rigtige beskeder. På LykkeCup-dagen dukker op til syv små hilsner op
        her.
      </p>

      <div className="mt-8 text-center">
        <Link
          href="/lykkecup26"
          className="text-sm font-medium text-lc26-teal underline-offset-2 hover:underline"
        >
          Tilbage til forsiden
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <button type="button" className="absolute inset-0 bg-lc26-navy/45 backdrop-blur-[2px]" aria-label="Luk" onClick={() => setOpen(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(85dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 bg-white shadow-2xl"
            style={{ borderColor: BRAND }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-[rgb(223_103_99/0.1)] px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar def={open} size="md" />
                <div className="min-w-0">
                  <p id={titleId} className="truncate text-sm font-semibold text-lc26-navy">
                    {open.fromName}
                  </p>
                  <p className="truncate text-xs text-lc26-navy/50">{open.subject}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-white/80 hover:text-lc26-navy"
                aria-label="Luk"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-lc26-navy/85 sm:px-5 sm:py-5">
              {open.body.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
            <div className="border-t border-stone-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
                style={{ backgroundColor: BRAND }}
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
