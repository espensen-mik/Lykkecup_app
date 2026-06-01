"use client";

import { ExternalLink } from "lucide-react";
import { LC26_FUNDRAISING_URL } from "@/lib/lc26-fundraising";

type Props = {
  /** Minimum højde på indlejret formular (OF indhold varierer). */
  minHeight?: number;
};

/**
 * Indlejrer OnlineFundraising-formular via iframe.
 * Har fallback-link til fuld skærm — anbefales hvis betaling (fx MobilePay) fejler i iframe.
 */
export function Lc26FundraisingEmbed({ minHeight = 1280 }: Props) {
  return (
    <div className="flex flex-col">
      <p className="mx-auto mb-5 max-w-md text-center text-sm leading-relaxed text-lc26-navy/55">
        Udfyld formularen herunder for at støtte LykkeLiga med et fast årligt bidrag. Virker betalingen ikke
        i appen, kan du åbne formularen i browseren i stedet.
      </p>

      <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-100/80">
        <iframe
          src={LC26_FUNDRAISING_URL}
          title="Støt LykkeLiga — donation via OnlineFundraising"
          className="block w-full border-0"
          style={{ minHeight: `${minHeight}px` }}
          loading="lazy"
          allow="payment *; fullscreen"
        />
      </div>

      <p className="mt-5 text-center">
        <a
          href={LC26_FUNDRAISING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-lc26-teal/30 bg-lc26-teal/[0.08] px-4 py-2.5 text-sm font-semibold text-lc26-teal transition hover:bg-lc26-teal/15"
        >
          Åbn formularen i fuld skærm
          <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </a>
      </p>
    </div>
  );
}
