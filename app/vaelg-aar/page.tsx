import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { selectActiveEventAction } from "@/lib/active-event-actions";
import { getRequestedEventId, listEvents } from "@/lib/active-event-server";
import { getCurrentAuthAppUser } from "@/lib/auth-server";
import { EVENT_PICKER_PATH, eventYearLabel, safeInternalPath } from "@/lib/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vælg år",
  description: "Vælg hvilket LykkeCup-år KontrolCenter skal arbejde i",
};

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function VaelgAarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);

  const user = await getCurrentAuthAppUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`${EVENT_PICKER_PATH}?next=${next}`)}`);

  const [events, remembered] = await Promise.all([listEvents(), getRequestedEventId()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-lc-border bg-white p-6 shadow-lc-card sm:p-8">
        <header>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">
            LykkeCup KontrolCenter
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Hvilket år vil du arbejde i?</h1>
          <p className="mt-2 text-sm text-gray-500">
            Du kan altid skifte år igen fra topbjælken i KontrolCenter.
          </p>
        </header>

        <ul className="mt-6 space-y-3">
          {events.map((event) => {
            const isRemembered = event.id === remembered;
            const archived = event.status === "archived";
            return (
              <li key={event.id}>
                <form action={selectActiveEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="next" value={next} />
                  <button
                    type="submit"
                    className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left transition hover:border-[#14b8a6] hover:bg-teal-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/40 ${
                      isRemembered ? "border-[#14b8a6] bg-teal-50/40" : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-3xl font-semibold tracking-tight text-gray-900">
                        {eventYearLabel(event)}
                      </span>
                      <span className="mt-1 block text-sm text-gray-500">
                        {[event.startsOn ? dateFormatter.format(new Date(event.startsOn)) : null, event.location]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {archived ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          Arkiv
                        </span>
                      ) : null}
                      {isRemembered ? (
                        <span className="rounded-full bg-[#14b8a6] px-2.5 py-0.5 text-xs font-medium text-white">
                          Sidst valgt
                        </span>
                      ) : null}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
