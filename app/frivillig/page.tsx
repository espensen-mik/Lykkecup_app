import type { Metadata } from "next";
import { CalendarDays, Heart, Hourglass, ListChecks, MapPin, UsersRound } from "lucide-react";
import Image from "next/image";
import { VolunteerHighlightVideo } from "@/components/frivillige/volunteer-highlight-video";
import { VolunteerSignupForm } from "@/components/frivillige/volunteer-signup-form";
import { eventShortDateLabel } from "@/lib/events";
import { supabase } from "@/lib/supabase";
import { VOLUNTEER_SIGNUP_EVENT_ID } from "@/lib/volunteers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bliv frivillig · LykkeCup 2027",
  description: "LykkeCup er årets lykkeligste dag. Bliv frivillig og vær med til at skabe den.",
  openGraph: {
    title: "Bliv frivillig til LykkeCup",
    description: "LykkeCup er årets lykkeligste dag. Bliv frivillig og vær med til at skabe den.",
    images: ["/Frontpage.jpg"],
  },
};

const DISPLAY = "font-[family-name:var(--font-lc27-display)] uppercase tracking-[0.06em]";

const longDate = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const PERKS = [
  { icon: Heart, title: "Skab lykke", text: "Lykkecup er årets største dag for familierne i LykkeLiga" },
  { icon: UsersRound, title: "Lykkeligt fællesskab", text: "Du får lov at mærke Danmarks nok lykkeligste fællesskab, helt tæt på" },
  {
    icon: ListChecks,
    title: "Masser af spændende opgaver",
    text: "Lykken skabes på mange måder - og der er spændende opgaver til alle profiler",
  },
];

function PerkList({ className }: { className: string }) {
  return (
    <div className={className}>
      <ul className="grid gap-3">
        {PERKS.map((perk) => (
          <li key={perk.title} className="flex items-start gap-4 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#22b573]/20 text-[#5ee0a4] ring-1 ring-[#5ee0a4]/25">
              <perk.icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{perk.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-white/65">{perk.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <VolunteerHighlightVideo />
    </div>
  );
}

export default async function FrivilligPage() {
  const { data: event } = await supabase
    .from("events")
    .select("name, starts_on, location, status")
    .eq("id", VOLUNTEER_SIGNUP_EVENT_ID)
    .maybeSingle();
  const open = event?.status === "active";
  const dateText = event?.starts_on ? longDate.format(new Date(event.starts_on)) : null;

  return (
    <main className="relative isolate min-h-[100svh] text-white">
      <div className="fixed inset-0 -z-10" aria-hidden>
        <Image src="/Frontpage.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgb(15_36_66/0.92)_0%,rgb(15_36_66/0.72)_45%,rgb(15_36_66/0.55)_100%)]" />
        <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-[#22b573]/25 blur-[120px]" />
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8 lg:px-12">
        <img src="/lykkeliga-logo.svg" alt="LykkeLiga" width={456} height={169} className="h-9 w-auto brightness-0 invert sm:h-10" />
        <p className={`${DISPLAY} hidden text-sm text-white/80 sm:block`}>{event?.name ?? "LykkeCup"}</p>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-16 lg:px-12 lg:pt-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,38rem)]">
        <section className="lg:sticky lg:top-12 lg:self-start">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ring-1 ring-white/20 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#22b573] shadow-[0_0_12px_#22b573]" aria-hidden />
            Bliv frivillig til LykkeCup
          </p>
          <h1 className={`${DISPLAY} mt-6 text-[2.5rem] leading-[1.02] [text-shadow:0_2px_30px_rgb(0_0_0/0.35)] sm:text-6xl xl:text-7xl`}>
            Lykken
            <br />
            skaber vi
            <br />
            <span className="text-[#5ee0a4]">sammen</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
            LykkeCup er årets lykkeligste dag, hvor næsten 1000 LykkeLiga-spillere samles til sæsonafslutning i Herning. En
            hel dag med håndbold, hyldest og highfives. LykkeCup bliver lykkelig på grund af dygtige frivillige - vil du
            være med?
          </p>

          {dateText || event?.location ? (
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
              {dateText ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur-md">
                  <CalendarDays className="h-4 w-4 text-[#5ee0a4]" aria-hidden />
                  {dateText}
                </span>
              ) : null}
              {event?.location ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur-md">
                  <MapPin className="h-4 w-4 text-[#5ee0a4]" aria-hidden />
                  {event.location}
                </span>
              ) : null}
            </div>
          ) : null}

          <PerkList className="mt-10 hidden max-w-lg gap-3 lg:grid" />
        </section>

        <section aria-label="Tilmelding">
          {open ? (
            <VolunteerSignupForm eventDateLabel={eventShortDateLabel(event?.starts_on ?? null)} />
          ) : (
            <div className="rounded-3xl bg-white/10 p-10 text-center ring-1 ring-white/20 backdrop-blur-xl">
              <Hourglass className="mx-auto h-10 w-10 text-[#5ee0a4]" aria-hidden />
              <h2 className="mt-4 text-xl font-semibold">Tilmeldingen er ikke åben lige nu</h2>
              <p className="mt-2 text-sm text-white/70">Kig forbi igen senere — vi glæder os til at se dig.</p>
            </div>
          )}

          <PerkList className="mt-8 grid gap-3 lg:hidden" />
        </section>
      </div>

      <p className="pb-10 text-center text-xs tracking-[0.12em] text-white/40">{event?.name ?? "LykkeCup"} · Lykkeliga</p>
    </main>
  );
}
