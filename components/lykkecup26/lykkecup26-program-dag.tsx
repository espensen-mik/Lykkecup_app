import Image from "next/image";
import { Lc26GuestExperienceCta } from "@/components/lykkecup26/lc26-guest-experience-cta";

const CAPTION =
  "Glæd dig til at Mumle spiller medaljekoncert kl. 16.30 i Boxen";

const SCHEDULE: { time: string; title: string; note?: string; highlight?: boolean }[] = [
  { time: "09.00", title: "Velkommen — hallen åbner", note: "Kaffe og morgenhygge ved indgangen" },
  { time: "10.00", title: "Håndboldkampene starter", note: "Første fløjt på alle baner" },
  { time: "11.30", title: "Pause", note: "Forfriskninger ved sidelinjen" },
  { time: "12.30", title: "Frokost", note: "Caféen er åben — se menu på opslag" },
  { time: "14.00", title: "Puljer og semifinaler", note: "Opdateret kampprogram på storskærm" },
  {
    time: "16.30",
    title: "Medaljekoncert med Mumle",
    note: "I Boxen — find plads i god tid",
    highlight: true,
  },
  { time: "18.00", title: "Middag og hygge", note: "Fælles spisning for holdene" },
  { time: "19.30", title: "Præmieoverrækkelse", note: "Hæder til dagens helte" },
  { time: "21.00", title: "Tak for i dag", note: "Vi ses i morgen" },
];

export function Lykkecup26ProgramDag() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <figure className="w-full shrink-0">
        <div className="relative h-44 w-full overflow-hidden sm:h-52">
          <Image
            src="/mumle.jpg"
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>
        <figcaption className="border-b border-stone-200/90 bg-white px-4 py-4 text-center sm:px-6">
          <p className="mx-auto max-w-xl text-sm font-medium leading-snug text-lc26-navy/80 sm:text-[0.9375rem]">
            {CAPTION}
          </p>
        </figcaption>
      </figure>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            Dagens program
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-snug text-lc26-navy/50">
            Fra kl. 9.00 til 21.00 — tiderne kan justeres, når det endelige program foreligger.
          </p>
        </header>

        <div className="mt-10">
          <ol className="space-y-3 sm:space-y-4">
            {SCHEDULE.map((item) => (
              <li key={item.time + item.title}>
                <div
                  className={`relative flex gap-3 rounded-2xl border p-4 shadow-sm transition sm:gap-5 sm:p-5 ${
                    item.highlight
                      ? "border-lc26-teal/45 bg-gradient-to-br from-lc26-teal/[0.07] to-white ring-1 ring-lc26-teal/15"
                      : "border-stone-200/90 bg-white"
                  }`}
                >
                  <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5 sm:w-[4.5rem]">
                    <span
                      className={`font-semibold tabular-nums tracking-tight ${
                        item.highlight ? "text-lc26-teal" : "text-lc26-navy/85"
                      }`}
                    >
                      {item.time}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
                        item.highlight ? "bg-lc26-teal shadow-[0_0_0_3px_rgb(0_161_130/0.2)]" : "bg-stone-300"
                      }`}
                      aria-hidden
                    />
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
