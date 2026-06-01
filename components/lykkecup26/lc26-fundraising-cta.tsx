import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { LC26_FUNDRAISING_URL } from "@/lib/lc26-fundraising";

export function Lc26FundraisingCta() {
  return (
    <div className="rounded-2xl border border-lc26-teal/25 bg-gradient-to-b from-lc26-teal/[0.08] to-white px-6 py-10 text-center shadow-sm sm:px-8 sm:py-12">
      <Image
        src="/lykkeligasupport.svg"
        alt="LykkeLiga Support"
        width={200}
        height={200}
        className="mx-auto h-auto w-[min(100%,12.5rem)]"
        priority
      />

      <h1 className="mt-6 text-balance text-2xl font-semibold leading-snug tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
        Meld dig ind i Danmarks lykkeligste FanKlub
      </h1>

      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-lc26-navy/65 sm:text-[0.9375rem]">
        LykkeLiga Support er for de allermest hardcore LykkeLigans — den eneste fanklub, hvor dit hold{" "}
        <span className="font-semibold text-lc26-navy">ALTID</span> vinder. Det koster{" "}
        <span className="font-semibold text-lc26-navy">250 kr.</span> om året
      </p>

      <a
        href={LC26_FUNDRAISING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-lc26-teal px-6 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-[#008f72] active:scale-[0.98] sm:w-auto sm:min-w-[18rem]"
      >
        Meld dig ind i Fanklubben her
        <ExternalLink className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      </a>

      <p className="mt-4 text-[11px] leading-snug text-lc26-navy/45">
        Sikker betaling via OnlineFundraising · åbner i ny fane
      </p>
    </div>
  );
}
