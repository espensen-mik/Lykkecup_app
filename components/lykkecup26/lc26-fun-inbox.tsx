"use client";

import { Mail, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";

const STORAGE_KEY = "lc26-fun-inbox-dismissed";
const BRAND = "#df6763";

/** Ét fast eksempel — billede ligger som `public/nikolaj.jpg` (det du har uploadet). */
const NIKOLAJ_MESSAGE = {
  name: "Nikolaj Jakobsen",
  preview: "En hilsen før LykkeCup …",
  imageSrc: "/nikolaj.jpg",
  body: `Hej med dig. Jeg vil bare lige ønske dig et godt LykkeCup. Jeg glæder mig til at se dig på håndboldbanen. Jeg holder øje med om du er blevet bedre siden sidste år!

Kærlig hilsen Nikolaj`,
} as const;

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function Lc26FunInboxTeaser() {
  const titleId = useId();
  const [hydrated, setHydrated] = useState(false);
  const [show, setShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (readDismissed()) return;
    setShow(true);
  }, []);

  const dismissAll = useCallback(() => {
    writeDismissed();
    setShow(false);
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, dismissAll]);

  if (!hydrated || !show) return null;

  const { name, preview, imageSrc, body } = NIKOLAJ_MESSAGE;

  return (
    <>
      {!modalOpen ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-lg transition-[transform,opacity] duration-300 ease-out">
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
                onClick={() => setModalOpen(true)}
                className="min-w-0 flex-1 rounded-xl py-1 text-left transition hover:bg-stone-50 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100 shadow-inner">
                    <Image
                      src={imageSrc}
                      alt={`Portrait af ${name}`}
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-lc26-navy">
                      Du har fået en besked fra {name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-lc26-navy/50">{preview}</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={dismissAll}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-stone-100 hover:text-lc26-navy"
                aria-label="Luk besked"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-lc26-navy/45 backdrop-blur-[2px]"
            aria-label="Luk"
            onClick={dismissAll}
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
                  <Image src={imageSrc} alt={`Portrait af ${name}`} fill className="object-cover" sizes="48px" />
                </div>
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-semibold text-lc26-navy">
                    Besked fra {name}
                  </p>
                  <p className="text-xs text-lc26-navy/50">LykkeCup 26 · hyggelig hilsen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissAll}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lc26-navy/50 transition hover:bg-white/80 hover:text-lc26-navy"
                aria-label="Luk"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-4 py-4 text-sm leading-relaxed text-lc26-navy/85 sm:px-5 sm:py-5">
              {body.split("\n\n").map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : undefined}>
                  {para}
                </p>
              ))}
            </div>
            <div className="border-t border-stone-100 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={dismissAll}
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
