"use client";

import { Mail, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";

const STORAGE_KEY = "lc26-fun-inbox-dismissed";
const BRAND = "#df6763";

type FunMessage = {
  id: string;
  name: string;
  /** Kort linje under avataren i toasten */
  preview: string;
  body: string;
  avatarSrc?: string;
  initials: string;
  avatarBg: string;
};

const MESSAGES: FunMessage[] = [
  {
    id: "nikolaj",
    name: "Nikolaj Jakobsen",
    preview: "En hilsen før LykkeCup …",
    body: `Hej med dig. Jeg vil bare lige ønske dig et godt LykkeCup. Jeg glæder mig til at se dig på håndboldbanen. Jeg holder øje med om du er blevet bedre siden sidste år!

Kærlig hilsen Nikolaj`,
    avatarSrc: "/nikolaj.jpg",
    initials: "NJ",
    avatarBg: "bg-stone-300",
  },
  {
    id: "lotte",
    name: "Lotte Kærså",
    preview: "Husk vandflasken i morgen …",
    body: "Hej! Jeg håber, du har pakket det hele — og husk at strække ud før kampdag. Vi ses i hallen!",
    initials: "LK",
    avatarBg: "bg-rose-200 text-rose-900",
  },
  {
    id: "mads",
    name: "Mads Jørgensen",
    preview: "Klap en ekstra gang …",
    body: "Psst … hvis du ser en, der er lidt nervøs på sidelinjen, så giv dem et smil. Det betyder mere end du tror. God fornøjelse!",
    initials: "MJ",
    avatarBg: "bg-sky-200 text-sky-900",
  },
  {
    id: "sofie",
    name: "Sofie Brandt",
    preview: "Tak for sidst …",
    body: "Tak for sidst i kiosken — i år lover jeg at holde igen på hornet, hvis det bliver tæt på slutfløjt. Kram og god cup!",
    initials: "SB",
    avatarBg: "bg-violet-200 text-violet-900",
  },
  {
    id: "anders",
    name: "Anders Hviid",
    preview: "Banen er klar …",
    body: "Banen er fejet, stregerne er tørre, og jeg har fundet den pæne fløjte frem. Vi ses til opvarmning!",
    initials: "AH",
    avatarBg: "bg-amber-200 text-amber-900",
  },
  {
    id: "emma",
    name: "Emma Dahl",
    preview: "Familiehjørnet …",
    body: "Hvis du leder efter et stille sted mellem kampene, så kig forbi familiehjørnet — der er kaffe og plads til at lande.",
    initials: "ED",
    avatarBg: "bg-emerald-200 text-emerald-900",
  },
];

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
  const [choice, setChoice] = useState<FunMessage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (readDismissed()) return;
    const i = Math.floor(Math.random() * MESSAGES.length);
    setChoice(MESSAGES[i] ?? null);
  }, []);

  const dismissAll = useCallback(() => {
    writeDismissed();
    setChoice(null);
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

  if (!hydrated || !choice) return null;

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
                    {choice.avatarSrc ? (
                      <Image
                        src={choice.avatarSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <span
                        className={`flex h-full w-full items-center justify-center text-[11px] font-bold ${choice.avatarBg}`}
                      >
                        {choice.initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-lc26-navy">
                      Du har fået en besked fra {choice.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-lc26-navy/50">{choice.preview}</p>
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
                  {choice.avatarSrc ? (
                    <Image src={choice.avatarSrc} alt="" fill className="object-cover" sizes="48px" />
                  ) : (
                    <span
                      className={`flex h-full w-full items-center justify-center text-xs font-bold ${choice.avatarBg}`}
                    >
                      {choice.initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-semibold text-lc26-navy">
                    Besked fra {choice.name}
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
              {choice.body.split("\n\n").map((para, i) => (
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
