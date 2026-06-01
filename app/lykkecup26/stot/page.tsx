import type { Metadata } from "next";
import { Lykkecup26PageHero } from "@/components/lykkecup26/lykkecup26-page-hero";
import { Lc26FundraisingEmbed } from "@/components/lykkecup26/lc26-fundraising-embed";

export const metadata: Metadata = {
  title: "Støt LykkeLiga · LykkeCup 26",
  description: "Giv et fast årligt bidrag til LykkeLiga via OnlineFundraising.",
};

export default function StotLykkeLigaPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Lykkecup26PageHero imageSrc="/lykkecupheader1.webp" />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            Støt LykkeLiga
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-snug text-lc26-navy/55">
            Din støtte gør en forskel for inkluderende håndbold og fællesskab i LykkeLiga.
          </p>
        </header>

        <div className="mt-10">
          <Lc26FundraisingEmbed />
        </div>
      </div>
    </div>
  );
}
