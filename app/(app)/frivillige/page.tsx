import type { Metadata } from "next";
import { VolunteersAdmin } from "@/components/frivillige/volunteers-admin";
import { getActiveEvent } from "@/lib/active-event-server";
import { createServerSupabase } from "@/lib/auth-server";
import { fetchVolunteerEmailHistory } from "@/lib/volunteer-mail-history";
import { fetchVolunteersBundle, volunteersEnabledFor } from "@/lib/volunteers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frivillige",
  description: "Frivillige og teams — LykkeCup KontrolCenter",
};

export default async function FrivilligePage() {
  const [supabase, event] = await Promise.all([createServerSupabase(), getActiveEvent()]);

  if (!volunteersEnabledFor(event)) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-lg border border-lc-border bg-white p-8 text-center shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Frivillige</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Frivillige-funktionen blev ikke brugt i {event.name}. Den findes fra LykkeCup 2027.
          </p>
        </div>
      </div>
    );
  }

  const [{ volunteers, teams, tasks, assignments, error }, mailHistory] = await Promise.all([
    fetchVolunteersBundle(supabase, event.id),
    fetchVolunteerEmailHistory(supabase, event.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Deltagere
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Frivillige
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Tilmeldinger fra <span className="font-medium text-gray-700 dark:text-gray-300">lykkecup.dk/frivillig</span> og
          manuelt oprettede frivillige. Inddel dem i teams, sæt dem på opgaver og send mails.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="p-6 sm:p-8">
          <VolunteersAdmin
            volunteers={volunteers}
            teams={teams}
            tasks={tasks}
            assignments={assignments}
            mailHistory={mailHistory.emails}
            mailHistoryError={mailHistory.error}
            fetchError={error}
            readOnly={event.status === "archived"}
          />
        </div>
      </div>
    </div>
  );
}
