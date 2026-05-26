import Image from "next/image";
import { Lc26SavePageShortcut } from "@/components/lykkecup26/lc26-save-page-shortcut";
import { LC26_LYKKE_LAGKAGE_HREF, type Lc26ProgramContent } from "@/lib/lc26-page-content";

export function LykkeLagkageProgram({
  title = "Lykke & Lagkage",
  intro = "Kære gæst til LykkeCup. Velkommen til en særlig dag med håndbold i verdensklasse, musik og Danmarks lykkeligste VIP-event.",
  heroImageUrl = "/Lykkeoglagkage.jpg",
  content,
}: {
  title?: string;
  intro?: string;
  heroImageUrl?: string | null;
  content?: Lc26ProgramContent;
}) {
  const schedule = content?.schedule?.length ? content.schedule : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <figure className="w-full shrink-0">
        <div className="relative h-48 w-full overflow-hidden sm:h-56">
          <Image
            src={heroImageUrl || "/Lykkeoglagkage.jpg"}
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-lc26-navy/35 via-transparent to-transparent" />
        </div>
      </figure>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-8 sm:max-w-2xl sm:px-6 sm:pb-14 sm:pt-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lc26-gold-dark">VIP · LykkeCup 26</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-lc26-navy/55">{intro}</p>
        </header>

        <div className="mt-8">
          <Lc26SavePageShortcut pagePath={LC26_LYKKE_LAGKAGE_HREF} label={title} />
        </div>

        <div className="mt-10">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-lc26-navy/45">
            Dagens program
          </h2>
          <ol className="mt-5 space-y-3 sm:space-y-4">
            {schedule.map((item) => (
              <li key={`${item.time}-${item.title}`}>
                <div
                  className={`relative flex gap-3 rounded-2xl border p-4 shadow-sm transition sm:gap-5 sm:p-5 ${
                    item.highlight
                      ? "border-lc26-gold/45 bg-gradient-to-br from-lc26-gold-soft via-white to-white ring-1 ring-lc26-gold/25"
                      : "border-stone-200/90 bg-white"
                  }`}
                >
                  <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5 sm:w-[4.5rem]">
                    <span
                      className={`font-semibold tabular-nums tracking-tight ${
                        item.highlight ? "text-lc26-gold-dark" : "text-lc26-navy/85"
                      }`}
                    >
                      {item.time}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
                        item.highlight
                          ? "bg-lc26-gold shadow-[0_0_0_3px_rgb(211_175_55/0.28)]"
                          : "bg-stone-300"
                      }`}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1 border-l border-stone-100 pl-3 sm:pl-4">
                    <p className="text-base font-semibold leading-snug text-lc26-navy">{item.title}</p>
                    {item.location ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-lc26-navy/45">
                        Sted: <span className="normal-case tracking-normal text-lc26-navy/65">{item.location}</span>
                      </p>
                    ) : null}
                    {item.note ? (
                      <p className="mt-2 text-sm leading-snug text-lc26-navy/50">{item.note}</p>
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
