import type { Metadata } from "next";
import { ListerExportClient } from "@/components/lister-export-client";
import { fetchListerExportData } from "@/lib/lister";
import { fetchKampprogramBundle } from "@/lib/kampprogram-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lister",
  description: "CSV og udskrift — spillere og trænere efter klub — LykkeCup KontrolCenter",
};

export default async function ListerPage() {
  const [{ teams, players, coaches, error }, kampprogram] = await Promise.all([
    fetchListerExportData(),
    fetchKampprogramBundle(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Eksport
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Lister
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Her på siden kan du få stillet din hedeste liste-drøm. Gå liste-amok med enten print eller csv (til fx excel). Siden er særligt udviklet til Rikke Nielsen. 
        </p>
      </header>

      <ListerExportClient
        teams={teams}
        players={players}
        coaches={coaches}
        fetchError={error}
        kampprogramMatches={kampprogram.matches}
        kampprogramTeamDetails={kampprogram.teamDetails}
      />
    </div>
  );
}
