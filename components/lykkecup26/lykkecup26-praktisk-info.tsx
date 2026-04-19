import { ChevronDown } from "lucide-react";
import { Lc26GuestExperienceCta } from "@/components/lykkecup26/lc26-guest-experience-cta";
import { Lykkecup26PageHero } from "@/components/lykkecup26/lykkecup26-page-hero";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Åbningstider",
    body: "Pladsholder: Her beskrives hvornår hallen, café og sekretariat typisk er åbne under LykkeCup. Ret tider og tilføj undtagelser, når programmet er fastlagt.",
  },
  {
    title: "Parkering og transport",
    body: "Pladsholder: Kort om P-pladser, handicapparkering, bus og tog til Herning. Link til rejseplan kan tilføjes senere.",
  },
  {
    title: "Mad og drikke",
    body: "Pladsholder: Hvor man kan købe måltider, snacks og kaffe — og om det er tilladt at medbringe mad i hallen.",
  },
  {
    title: "Toiletter og tilgængelighed",
    body: "Pladsholder: Her kommer vejledning om handicaptoiletter, elevatorer og hvor man finder rolige zoner ved behov.",
  },
  {
    title: "Førstehjælp og tryghed",
    body: "Pladsholder: Kontakt til arrangører, vagter og hvor førstehjælp findes under arrangementet.",
  },
  {
    title: "Vejr og medbringe",
    body: "Pladsholder: Forslag til tøj, sko og ting man kan have i tasken — samt hvor garderobe eller bagage kan stilles.",
  },
  {
    title: "Kontakt under cuppen",
    body: "Pladsholder: Telefon, e-mail eller informationsdisk — udfyldes med rigtige kontakter, når de foreligger.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Hvor finder jeg kampprogrammet?",
    a: "Pladsholder: Beskriv hvor programmet vises — fx app, web, opslag i hallen eller på storskærm.",
  },
  {
    q: "Må jeg tage billeder og film?",
    a: "Pladsholder: Korte retningslinjer for privat brug og evt. deling på sociale medier.",
  },
  {
    q: "Hvad gør jeg, hvis jeg mister min spiller?",
    a: "Pladsholder: Mødested, kontaktpersoner og hvordan man melder sig til informationsdisken.",
  },
  {
    q: "Er der wifi?",
    a: "Pladsholder: Om der tilbydes gæste-wifi, og hvordan man logger på.",
  },
  {
    q: "Kan jeg købe billetter på dagen?",
    a: "Pladsholder: Billetinfo, priser og betalingsformer — tilpasses når salget er på plads.",
  },
];

export function Lykkecup26PraktiskInfo() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Lykkecup26PageHero />

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            Praktisk info
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-snug text-lc26-navy/55">
            Korte pladsholdere til praktiske emner. Erstat teksterne med endeligt indhold, når det er klar.
          </p>
        </header>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="scroll-mt-24">
              <h2 className="text-lg font-semibold tracking-tight text-lc26-navy">{s.title}</h2>
              <p className="mt-2 text-sm leading-snug text-lc26-navy/60">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-stone-200/90 pt-12 dark:border-gray-800">
          <Lc26GuestExperienceCta />
        </div>

        <section className="mt-14 border-t border-stone-200/90 pt-12" aria-labelledby="lc26-faq-heading">
          <h2 id="lc26-faq-heading" className="text-xl font-semibold tracking-tight text-lc26-navy">
            Spørgsmål og svar
          </h2>
          <p className="mt-2 text-sm leading-snug text-lc26-navy/50">
            Tryk på et spørgsmål for at se et foreløbigt svar. Alt nedenfor er pladsholdertekst.
          </p>

          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-stone-200/90 bg-white shadow-sm open:border-lc26-teal/25 open:shadow-[0_12px_40px_-24px_rgb(22_51_88/0.35)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-left text-[0.9375rem] font-semibold text-lc26-navy transition hover:bg-stone-50/80 sm:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 pr-2">{item.q}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-lc26-teal/70 transition-transform duration-200 group-open:rotate-180"
                    strokeWidth={2}
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-stone-100 px-4 pb-4 pt-1 text-sm leading-snug text-lc26-navy/65 sm:px-5 sm:pb-5">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
