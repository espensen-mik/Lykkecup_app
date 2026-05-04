import type { Metadata } from "next";
import { ListerExportClient } from "@/components/lister-export-client";
import { fetchListerExportData } from "@/lib/lister";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lister",
  description: "Udskriv lister over hold og spillere — LykkeCup KontrolCenter",
};

export default async function ListerPage() {
  const { teams, players, error } = await fetchListerExportData();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Eksport
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Lister
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Byg lister til udskrift eller PDF: holdnavne, spillere grupperet efter hold, ét hold ad gangen, samt fuld
          spillerliste og spillere uden hold.
        </p>
      </header>

      <ListerExportClient teams={teams} players={players} fetchError={error} />
    </div>
  );
}
