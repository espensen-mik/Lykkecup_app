import { Lc26SavePageShortcut } from "@/components/lykkecup26/lc26-save-page-shortcut";
import { Lykkecup26PageHero } from "@/components/lykkecup26/lykkecup26-page-hero";
import { LC26_LYKKE_LAGKAGE_HREF, normalizeLc26ImageUrl, type Lc26ProgramContent } from "@/lib/lc26-page-content";

/** Skiftende hvid og lys teal — samme som Dagens program. */
const PROGRAM_CARD_STYLES = [
  "border-stone-200/90 bg-white",
  "border-lc26-teal/25 bg-lc26-teal/[0.07]",
] as const;

export function LykkeLagkageProgram({
  title = "Lykke & Lagkage",
  intro = "Kære gæst til LykkeCup. Velkommen til en særlig dag med håndbold i verdensklasse, musik og Danmarks lykkeligste VIP-event.",
  heroImageUrl = "/lykkecupheader4.webp",
  content,
}: {
  title?: string;
  intro?: string;
  heroImageUrl?: string | null;
  content?: Lc26ProgramContent;
}) {
  const schedule = content?.schedule?.length ? content.schedule : [];
  const normalizedHero = normalizeLc26ImageUrl(heroImageUrl);
  const heroSrc =
    !normalizedHero || normalizedHero === "/Lykkeoglagkage.jpg" ? "/lykkecupheader4.webp" : normalizedHero;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Lykkecup26PageHero imageSrc={heroSrc} priority />

      <div className="lc26-vip mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header>
          <p className="lc26-vip-kicker text-xs font-semibold uppercase tracking-[0.14em] text-lc26-gold-dark">
            VIP · LykkeCup 26
          </p>
          <h1 className="lc26-vip-title mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="lc26-vip-intro mx-auto mt-3 max-w-md text-sm leading-relaxed text-lc26-navy/55">{intro}</p>
        </header>

        <div className="mt-8">
          <Lc26SavePageShortcut pagePath={LC26_LYKKE_LAGKAGE_HREF} label={title} />
        </div>

        <div className="mt-10">
          <ol className="space-y-3 sm:space-y-4">
            {schedule.map((item, index) => (
              <li key={`${item.time}-${item.title}`}>
                <div
                  className={`relative flex gap-3 rounded-2xl border p-4 shadow-sm sm:gap-5 sm:p-5 ${PROGRAM_CARD_STYLES[index % PROGRAM_CARD_STYLES.length]}`}
                >
                  <div className="flex w-[4.25rem] shrink-0 items-start justify-center pt-0.5 sm:w-[4.5rem]">
                    <span className="font-semibold tabular-nums tracking-tight text-lc26-navy/90">{item.time}</span>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-stone-100 pl-3 sm:pl-4">
                    <p className="text-base font-semibold leading-snug text-lc26-navy">{item.title}</p>
                    {item.location ? (
                      <p className="mt-1 text-sm leading-snug text-lc26-navy/50">{item.location}</p>
                    ) : null}
                    {item.note ? (
                      <p className="mt-1 text-sm leading-snug text-lc26-navy/50">{item.note}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
