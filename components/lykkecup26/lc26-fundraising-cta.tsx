import { ExternalLink, Heart } from "lucide-react";
import { LC26_FUNDRAISING_URL } from "@/lib/lc26-fundraising";

export function Lc26FundraisingCta() {
  return (
    <div className="rounded-2xl border border-lc26-teal/25 bg-gradient-to-b from-lc26-teal/[0.08] to-white px-6 py-10 text-center shadow-sm sm:px-8 sm:py-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lc26-teal/15 text-lc26-teal">
        <Heart className="h-7 w-7" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-lc26-navy/60">
        Giv et fast årligt bidrag til LykkeLiga. Du sendes videre til vores sikre betalingsside hos
        OnlineFundraising — det åbner i en ny fane i browseren.
      </p>
      <a
        href={LC26_FUNDRAISING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-lc26-teal px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#008f72] active:scale-[0.98] sm:w-auto sm:min-w-[16rem]"
      >
        Gå til støtteformular
        <ExternalLink className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      </a>
      <p className="mt-4 text-[11px] leading-snug text-lc26-navy/45">
        MobilePay og betalingskort · du vender tilbage til appen bagefter
      </p>
    </div>
  );
}
