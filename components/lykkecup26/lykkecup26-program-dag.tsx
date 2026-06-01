import Image from "next/image";
import { Lc26GuestExperienceCta } from "@/components/lykkecup26/lc26-guest-experience-cta";
import {
  LC26_PAGE_HERO_FRAME_CLASS,
  LC26_PAGE_HERO_IMAGE_CENTER_CLASS,
  LC26_PAGE_HERO_IMAGE_SIZES,
} from "@/components/lykkecup26/lc26-page-hero-styles";
import type { Lc26ProgramContent } from "@/lib/lc26-page-content";

const CAPTION =
  "Glæd dig til at Mumle spiller medaljekoncert kl. 16.30 i Boxen";

const SCHEDULE: { time: string; title: string; note?: string }[] = [
  { time: "09.00", title: "Velkommen — hallen åbner", note: "Kaffe og morgenhygge ved indgangen" },
  { time: "10.00", title: "Håndboldkampene starter", note: "Første fløjt på alle baner" },
  { time: "11.30", title: "Pause", note: "Forfriskninger ved sidelinjen" },
  { time: "12.30", title: "Frokost", note: "Caféen er åben — se menu på opslag" },
  { time: "14.00", title: "Puljer og semifinaler", note: "Opdateret kampprogram på storskærm" },
  { time: "16.30", title: "Medaljekoncert med Mumle", note: "I Boxen — find plads i god tid" },
  { time: "18.00", title: "Middag og hygge", note: "Fælles spisning for holdene" },
  { time: "19.30", title: "Præmieoverrækkelse", note: "Hæder til dagens helte" },
  { time: "21.00", title: "Tak for i dag", note: "Vi ses i morgen" },
];

/** Skiftende hvid og lys teal. */
const PROGRAM_CARD_STYLES = [
  "border-stone-200/90 bg-white",
  "border-lc26-teal/25 bg-lc26-teal/[0.07]",
] as const;

export function Lykkecup26ProgramDag() {
  return <Lykkecup26ProgramDagWithContent />;
}

export function Lykkecup26ProgramDagWithContent({
  title = "Dagens program",
  intro = "Fra kl. 9.00 til 21.00 — tiderne kan justeres, når det endelige program foreligger.",
  heroImageUrl = "/mumle.webp",
  content,
}: {
  title?: string;
  intro?: string;
  heroImageUrl?: string | null;
  content?: Lc26ProgramContent;
}) {
  const schedule = content?.schedule?.length ? content.schedule : SCHEDULE;
  const caption = content?.caption ?? CAPTION;
  const heroSrc =
    !heroImageUrl?.trim() || heroImageUrl.trim() === "/mumle.jpg" ? "/mumle.webp" : heroImageUrl.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <figure className="w-full shrink-0">
        <div className={LC26_PAGE_HERO_FRAME_CLASS}>
          <Image
            src={heroSrc}
            alt=""
            fill
            className={LC26_PAGE_HERO_IMAGE_CENTER_CLASS}
            priority
            sizes={LC26_PAGE_HERO_IMAGE_SIZES}
          />
        </div>
        <figcaption className="border-b border-stone-200/90 bg-white px-4 py-4 text-center sm:px-6">
          <p className="mx-auto max-w-xl text-sm font-medium leading-snug text-lc26-navy/80 sm:text-[0.9375rem]">
            {caption}
          </p>
        </figcaption>
      </figure>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-snug text-lc26-navy/50">
            {intro}
          </p>
        </header>

        <div className="mt-10">
          <ol className="space-y-3 sm:space-y-4">
            {schedule.map((item, index) => (
              <li key={item.time + item.title}>
                <div
                  className={`relative flex gap-3 rounded-2xl border p-4 shadow-sm sm:gap-5 sm:p-5 ${PROGRAM_CARD_STYLES[index % PROGRAM_CARD_STYLES.length]}`}
                >
                  <div className="flex w-[4.25rem] shrink-0 items-start justify-center pt-0.5 sm:w-[4.5rem]">
                    <span className="font-semibold tabular-nums tracking-tight text-lc26-navy/90">
                      {item.time}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-stone-100 pl-3 sm:pl-4">
                    <p className="text-base font-semibold leading-snug text-lc26-navy">{item.title}</p>
                    {item.note ? (
                      <p className="mt-1 text-sm leading-snug text-lc26-navy/50">{item.note}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 border-t border-stone-200/90 pt-10 dark:border-gray-800">
          <Lc26GuestExperienceCta />
        </div>
      </div>
    </div>
  );
}
