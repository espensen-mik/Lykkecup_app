"use client";

import { Mail, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLc26Inbox, type Lc26InboxRow } from "@/components/lykkecup26/use-lc26-inbox";

const BRAND = "#df6763";
const HIDE_TOAST_KEY = "lc26-inbox-toast-hidden";

function pickToastRow(rows: Lc26InboxRow[]): Lc26InboxRow | null {
  return rows.find((r) => r.status === "unread") ?? null;
}

export function Lc26InboxToast() {
  const titleId = useId();
  const { rows, unreadCount, markRead } = useLc26Inbox();
  const [mounted, setMounted] = useState(false);
  const [toastHidden, setToastHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  /** Snapshot af beskeden modalen blev åbnet med (så indhold ikke hopper når markRead kører). */
  const [modalMessage, setModalMessage] = useState<Lc26InboxRow | null>(null);

  const toastRow = useMemo(() => pickToastRow(rows), [rows]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (unreadCount === 0) {
      try {
        sessionStorage.removeItem(HIDE_TOAST_KEY);
      } catch {
        /* ignore */
      }
      setToastHidden(false);
      setModalOpen(false);
      setModalMessage(null);
      return;
    }
    try {
      setToastHidden(sessionStorage.getItem(HIDE_TOAST_KEY) === "1");
    } catch {
      setToastHidden(false);
    }
  }, [unreadCount]);

  const dismissToast = useCallback(() => {
    try {
      sessionStorage.setItem(HIDE_TOAST_KEY, "1");
    } catch {
      /* ignore */
    }
    setToastHidden(true);
    setModalOpen(false);
    setModalMessage(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalMessage(null);
  }, []);

  const openModal = useCallback(() => {
    if (!toastRow) return;
    setModalMessage(toastRow);
    setModalOpen(true);
    markRead(toastRow.id);
  }, [toastRow, markRead]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!mounted) return null;
  if (modalOpen && !modalMessage) return null;
  if (!modalOpen && (unreadCount === 0 || !toastRow || toastHidden)) return null;

  return (
    <>
      {!modalOpen && toastRow && !toastHidden ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-lg transition-[opacity,transform] duration-300 ease-out">
            <div
              className="flex items-center gap-3 rounded-2xl border-2 bg-white py-3 pl-3 pr-2 shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.18)]"
              style={{ borderColor: BRAND }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: BRAND }}
              >
                <Mail className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <button
                type="button"
                onClick={openModal}
                className="min-w-0 flex-1 rounded-xl py-1 text-left transition hover:bg-stone-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 shadow-inner">
                    {toastRow.avatarSrc ? (
                      <Image src={toastRow.avatarSrc} alt="" fill className="object-cover" sizes="44px" unoptimized />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-lc26-navy/60">
                        {toastRow.fromName
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
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-lc26-navy">
                      Du har fået en besked fra {toastRow.fromName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-lc26-navy/50">{toastRow.subject}</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={dismissToast}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-stone-100 hover:text-lc26-navy"
                aria-label="Skjul besked på forsiden"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen && modalMessage ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-lc26-navy/45 backdrop-blur-[2px]"
            aria-label="Luk"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border-2 bg-white shadow-2xl"
            style={{ borderColor: BRAND }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-[rgb(223_103_99/0.1)] px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                  {modalMessage.avatarSrc ? (
                    <Image src={modalMessage.avatarSrc} alt="" fill className="object-cover" sizes="48px" unoptimized />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-lc26-navy/60">
                      {modalMessage.fromName
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
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-semibold text-lc26-navy">
                    Besked fra {modalMessage.fromName}
                  </p>
                  <p className="text-xs text-lc26-navy/50">{modalMessage.subject}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-white/80 hover:text-lc26-navy"
                aria-label="Luk"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="max-h-[min(52vh,24rem)] overflow-y-auto px-4 py-4 text-sm leading-relaxed text-lc26-navy/85 sm:px-5 sm:py-5">
              {modalMessage.body.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-stone-100 px-4 py-3 sm:px-5">
              <Link
                href="/lykkecup26/beskeder"
                className="w-full rounded-xl border-2 py-2.5 text-center text-sm font-semibold transition hover:bg-stone-50"
                style={{ borderColor: BRAND, color: BRAND }}
                onClick={closeModal}
              >
                Åbn indbakken
              </Link>
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
                style={{ backgroundColor: BRAND }}
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
