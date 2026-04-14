import { PlayersAdmin } from "@/components/players-admin";
import { fetchPlayersForEvent } from "@/lib/players";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { players, error } = await fetchPlayersForEvent();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Deltagere
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Spillere
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Alle spillere til dette arrangement — søg og filtrér på listen.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="p-6 sm:p-8">
          <PlayersAdmin players={players} fetchError={error} />
        </div>
      </div>
    </div>
  );
}
