import { Lykkecup27BackgroundVideo } from "@/components/lykkecup27/lykkecup27-background-video";
import { Lykkecup27Countdown } from "@/components/lykkecup27/lykkecup27-countdown";
import { Lykkecup27SponsorLogo } from "@/components/lykkecup27/lykkecup27-sponsor-logo";
import {
  LYKKECUP_2027_DATE_LABEL,
  LYKKECUP_2027_EVENT_NAME,
  LYKKECUP_2027_LOCATION,
  LYKKECUP_2027_SPONSORS,
} from "@/lib/lykkecup27";

const DISPLAY = "font-[family-name:var(--font-lc27-display)] uppercase text-white tracking-[0.08em]";
const TEXT_SHADOW = "[text-shadow:0_1px_12px_rgb(0_0_0/0.35)]";

export function Lykkecup27Teaser({ initialDays }: { initialDays: number }) {
  return (
    <>
      <header className="relative isolate min-h-[100svh] w-full overflow-hidden">
        <Lykkecup27BackgroundVideo />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.38)_0%,rgb(0_0_0/0)_22%,rgb(0_0_0/0)_78%,rgb(0_0_0/0.32)_100%)]"
          aria-hidden
        />

        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8 sm:pt-8 lg:px-10 lg:pt-9">
          <img
            src="/lykkeliga-logo.svg"
            alt="LykkeLiga"
            width={456}
            height={169}
            className="h-9 w-auto shrink-0 brightness-0 invert sm:h-10 lg:h-11"
          />
          <h1 className={`${DISPLAY} ${TEXT_SHADOW} text-[0.9375rem] leading-snug sm:text-right sm:text-sm lg:text-base`}>
            <span className="block sm:inline">{LYKKECUP_2027_EVENT_NAME.split(" ")[0]}</span>
            <span className="hidden whitespace-pre sm:inline">{"  ·  "}</span>
            <span className="block sm:inline">
              {LYKKECUP_2027_DATE_LABEL}
              <span className="whitespace-pre">{"  ·  "}</span>
              {LYKKECUP_2027_LOCATION}
            </span>
          </h1>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:px-8 sm:pb-8 lg:px-10 lg:pb-9">
          <Lykkecup27Countdown
            initialDays={initialDays}
            className={`${DISPLAY} ${TEXT_SHADOW} text-[0.9375rem] sm:text-sm lg:text-base`}
          />
        </div>
      </header>

      <footer
        className={`bg-[linear-gradient(to_bottom,#163358_0%,#0f2442_100%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-white ${
          LYKKECUP_2027_SPONSORS.length > 0 ? "pt-20 sm:pt-24 lg:pt-28" : "pt-8"
        }`}
      >
        {LYKKECUP_2027_SPONSORS.length > 0 ? (
          <section aria-labelledby="lc27-sponsors">
            <h2 id="lc27-sponsors" className="text-xs font-semibold uppercase tracking-[0.32em] text-white/60">
              I samarbejde med
            </h2>
            <ul className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-10 [--lc27-logo-h:2rem] sm:mt-14 sm:gap-x-16 sm:[--lc27-logo-h:3.25rem] lg:gap-x-20 lg:[--lc27-logo-h:3.75rem]">
              {LYKKECUP_2027_SPONSORS.map((sponsor) => (
                <li key={sponsor.name} className="flex items-center">
                  <Lykkecup27SponsorLogo sponsor={sponsor} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className={`text-xs tracking-[0.12em] text-white/45 ${LYKKECUP_2027_SPONSORS.length > 0 ? "mt-20 sm:mt-24" : ""}`}>
          {LYKKECUP_2027_EVENT_NAME} · 5. juni · {LYKKECUP_2027_LOCATION}
        </p>
      </footer>
    </>
  );
}
