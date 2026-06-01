import type { Metadata } from "next";
import { Lykkecup26PageHero } from "@/components/lykkecup26/lykkecup26-page-hero";
import { Lc26FundraisingCta } from "@/components/lykkecup26/lc26-fundraising-cta";

export const metadata: Metadata = {
  title: "LykkeLiga Support · LykkeCup 26",
  description:
    "Meld dig ind i Danmarks lykkeligste FanKlub — LykkeLiga Support for 250 kr. om året.",
};

export default function StotLykkeLigaPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Lykkecup26PageHero imageSrc="/lykkecupheader1.webp" />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">
          LykkeCup 26
        </p>

        <div className="mt-6">
          <Lc26FundraisingCta />
        </div>
      </div>
    </div>
  );
}
