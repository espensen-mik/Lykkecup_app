import { MapPin } from "lucide-react";
import { Lykkecup26PageHero } from "@/components/lykkecup26/lykkecup26-page-hero";

const PLACEHOLDER_MAPS = [
  {
    title: "Oversigtskort — MCH",
    body: "Her kommer et samlet kort over Messecenter Herning med indgange, hallområder og fælles faciliteter.",
  },
  {
    title: "Boxen & omklædning",
    body: "Pladsholder til et kort med tribuner, scenen og nærmeste toiletter og omklædning.",
  },
  {
    title: "Parkering & ankomst",
    body: "Pladsholder til p-pladser, cykelparkering og vejvisning fra motorvejen.",
  },
] as const;

export function Lykkecup26FindMch() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Lykkecup26PageHero />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            Find rundt i MCH
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-snug text-lc26-navy/55">
            Her finder du snart kort og oversigter, så spillere og familier nemt kan orientere sig i Messecenter Herning. Teksten
            og grafikken nedenfor er pladsholdere.
          </p>
        </header>

        <ul className="mt-10 space-y-5">
          {PLACEHOLDER_MAPS.map((item) => (
            <li key={item.title}>
              <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm">
                <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-gradient-to-br from-stone-100/95 to-stone-50 px-6 text-center sm:aspect-[2/1]">
                  <MapPin className="h-10 w-10 text-lc26-teal/45" strokeWidth={1.5} aria-hidden />
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-lc26-navy/40">Grafisk kort kommer</p>
                </div>
                <div className="border-t border-stone-100 p-5 sm:p-6">
                  <h2 className="text-base font-semibold text-lc26-navy">{item.title}</h2>
                  <p className="mt-2 text-sm leading-snug text-lc26-navy/55">{item.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
