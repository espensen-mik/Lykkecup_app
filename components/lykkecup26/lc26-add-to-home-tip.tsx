"use client";

import { Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "lc26-add-to-home-tip-seen-v1";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

function isPhoneBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const phone = /Android|iPhone|iPod|Windows Phone/i.test(ua);
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (phone && Math.min(window.screen.width, window.screen.height) > 520);
  return phone && !tablet;
}

type PhonePlatform = "ios" | "android" | "other";

function detectPhonePlatform(): PhonePlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const TIP_BODY: Record<PhonePlatform, string> = {
  ios: "Tryk på Del-knappen (firkant med pil op) og vælg «Føj til hjemmeskærm». Så gemmes LykkeCup som en rigtig app på din telefon.",
  android:
    "Tryk menuen (⋮), vælg «Føj til hjemmeskærm» og «Åbn som web app». Så gemmes LykkeCup som en rigtig app på din telefon.",
  other:
    "Tilføj siden til hjemmeskærmen fra browserens menu. Så gemmes LykkeCup som en rigtig app på din telefon.",
};

export function Lc26AddToHomeTip() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<PhonePlatform>("other");

  useEffect(() => {
    if (isStandaloneDisplay() || !isPhoneBrowser()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }
    setPlatform(detectPhonePlatform());
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[250] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      role="dialog"
      aria-labelledby="lc26-a2hs-tip-title"
      aria-describedby="lc26-a2hs-tip-body"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-lc26-teal/30 bg-white p-4 shadow-[0_20px_50px_-20px_rgb(22_51_88/0.45)] ring-1 ring-lc26-teal/10 sm:max-w-md">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lc26-teal/10 text-lc26-teal">
            <Smartphone className="h-5 w-5" strokeWidth={1.85} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p id="lc26-a2hs-tip-title" className="text-sm font-semibold text-lc26-navy">
              Lykkeligt App Tip
            </p>
            <p id="lc26-a2hs-tip-body" className="mt-1.5 text-sm leading-snug text-lc26-navy/70">
              {TIP_BODY[platform]}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-lc26-teal px-5 text-sm font-semibold text-white transition hover:bg-[#008f72] active:scale-[0.98]"
            >
              Forstået
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lc26-navy/40 transition hover:bg-stone-100 hover:text-lc26-navy/70"
            aria-label="Luk tip"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
