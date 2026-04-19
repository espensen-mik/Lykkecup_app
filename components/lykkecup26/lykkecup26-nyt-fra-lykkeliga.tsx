import Image from "next/image";

type Article = {
  tag: string;
  tagClass: string;
  date: string;
  dateIso: string;
  title: string;
  paragraphs: string[];
  /** Vises under hero-billedet, typisk til første artikel. */
  imageCaption?: string;
};

const ARTICLES: Article[] = [
  {
    tag: "Musik",
    tagClass: "bg-lc26-teal text-white shadow-sm",
    date: "12. april 2026",
    dateIso: "2026-04-12",
    title: "LykkeLiga udgiver 10 nye musikhits",
    imageCaption:
      "Spillere fra Vordingborg i koncentreret process med at lave lykkelig musik i efteråret 2025.",
    paragraphs: [
      "Så kan du godt skrue op, for der er ny LykkeLiga-musik til din håndboldtræning. Sammen med fem LykkeLigaklubber fra hele landet har LykkeLiga netop udgivet 10 håndboldhits. Sange som «Vi vinder LykkeCup», «Sammen med Lars er vi Superstars» og «Scoresangen» skal gøre det endnu sjovere at spille i LykkeLiga.",
      "Find alle sangene i vores helt nye webapp: LykkeMusik",
    ],
  },
  {
    tag: "Turnering",
    tagClass: "bg-lc26-navy text-white shadow-sm",
    date: "10. april 2026",
    dateIso: "2026-04-10",
    title: "Sådan forbereder vi os på en tryg og fair LykkeCup",
    paragraphs: [
      "Dommere, frivillige og klubber gennemgår de samme retningslinjer hvert år — med små justeringer, når erfaringerne fra sidste sæson viser, at noget kan gøres endnu bedre.",
      "Pladsholder: Indsæt konkrete punkter om fair play, pauser og hvordan vi tager hånd om spillere, der har brug for lidt ekstra støtte på dagen.",
      "Tredje afsnit kan bruges til citat fra turneringsleder eller link til de fulde regler på lykkeliga.dk.",
    ],
  },
  {
    tag: "Fællesskab",
    tagClass: "bg-emerald-800 text-white shadow-sm",
    date: "8. april 2026",
    dateIso: "2026-04-08",
    title: "«Vi vinder sammen» — når hele hallen hepper",
    paragraphs: [
      "LykkeCup handler ikke kun om resultattavlen. Mange familier fortæller, at de husker højtaleren, highfives på gangene og de andre hold, der bliver ved med at klappe, når en kamp er afgjort.",
      "Denne artikel er skrevet som eksempel på en længere reportage. Erstat med rigtige citater og fotos, når I er klar.",
    ],
  },
  {
    tag: "Interview",
    tagClass: "bg-violet-800 text-white shadow-sm",
    date: "5. april 2026",
    dateIso: "2026-04-05",
    title: "Tre spørgsmål til årets værtsklub før dørene åbner",
    paragraphs: [
      "Vi har bedt en kontaktperson fra værtsklubben om at dele sine forventninger til weekenden. Indtil interviewet er godkendt, står deres svar som pladsholdertekst her.",
      "Brug det andet afsnit til at uddybe, hvordan frivillige fordeles mellem kiosk, baner og velkomst — eller fjern afsnittet, hvis historien skal være kortere.",
    ],
  },
  {
    tag: "Arrangement",
    tagClass: "bg-amber-800 text-white shadow-sm",
    date: "1. april 2026",
    dateIso: "2026-04-01",
    title: "Åbningsceremoni og fælles foto — tider og mødested",
    paragraphs: [
      "Alle hold inviteres til et kort fælles øjeblik, før den første kamp fløjtes. Her kommer præcis tid, sted og hvordan man melder sit hold til fotografen.",
      "Pladsholder: Opdater med endelig tid i programmet og evt. QR-kode til tilmelding.",
    ],
  },
];

export function Lykkecup26NytFraLykkeliga() {
  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-12 pt-8 sm:max-w-2xl sm:px-6 sm:pb-16 sm:pt-10">
      <header className="border-b border-stone-200/90 pb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.75rem]">
          Nyt fra LykkeLiga
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-snug text-lc26-navy/55">
          Seneste nyt, reportager og praktiske historier fra LykkeLiga og LykkeCup. Artiklerne nedenfor er pladsholdere — udskift tekst og billeder, når indholdet er klar.
        </p>
      </header>

      <div className="mt-10 space-y-12 sm:space-y-14">
        {ARTICLES.map((article) => (
          <article
            key={article.title}
            className="overflow-hidden border border-stone-200/90 bg-white shadow-[0_16px_48px_-28px_rgb(22_51_88/0.22)]"
          >
            <figure className="m-0">
              <div className="relative aspect-[16/10] w-full sm:aspect-[2/1]">
                <Image
                  src="/musik.jpg"
                  alt=""
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 42rem"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-lc26-navy/35 via-transparent to-lc26-navy/10" aria-hidden />
                <span
                  className={`absolute left-3 top-3 z-10 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] sm:left-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs ${article.tagClass}`}
                >
                  {article.tag}
                </span>
              </div>
              {article.imageCaption ? (
                <figcaption className="border-b border-stone-100 bg-stone-50/95 px-4 py-2.5 text-center text-xs leading-snug text-lc26-navy/65 sm:px-5 sm:py-3 sm:text-[0.8125rem]">
                  {article.imageCaption}
                </figcaption>
              ) : null}
            </figure>

            <div className="px-5 py-6 sm:px-7 sm:py-8">
              <time dateTime={article.dateIso} className="text-xs font-medium uppercase tracking-[0.06em] text-lc26-navy/45">
                {article.date}
              </time>
              <h2 className="mt-2 text-pretty text-xl font-bold leading-[1.2] tracking-[-0.02em] text-lc26-navy sm:text-2xl sm:leading-tight">
                {article.title}
              </h2>
              <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
                {article.paragraphs.map((p, i) => (
                  <p key={i} className="text-[0.9375rem] leading-relaxed text-lc26-navy/70">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
