import { ExternalLink, Heart } from "lucide-react";
import { LC26_DONATION_URL } from "@/lib/lc26-fundraising";

export function Lc26DonationCta() {
  return (
    <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-b from-rose-50 to-white px-6 py-10 text-center shadow-sm sm:px-8 sm:py-12">
      <Heart
        className="mx-auto h-16 w-16 fill-[#df6763] text-[#df6763] sm:h-20 sm:w-20"
        strokeWidth={1.5}
        aria-hidden
      />

      <h2 className="mt-6 text-balance text-2xl font-semibold leading-snug tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
        Giv donation til LykkeLiga
      </h2>

      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-lc26-navy/65 sm:text-[0.9375rem]">
        LykkeLiga får ingen økonomisk biddrag fra idrætsorganisationerne ligesom spillernes fulde kontingent går i
        de lokale klubkasser. Derfor har vi brug for finde penge til vores aktiviteter på anden vis. Private donationer
        spiller en afgørende rolle. Hjælp os med at sprede lykke med en valgfri donation.
      </p>

      <a
        href={LC26_DONATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#df6763] px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#c95550] active:scale-[0.98] sm:w-auto sm:min-w-[18rem]"
      >
        Giv din donation her
        <ExternalLink className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      </a>

      <p className="mt-4 text-[11px] leading-snug text-lc26-navy/45">
        Sikker betaling via OnlineFundraising · åbner i ny fane
      </p>
    </div>
  );
}
