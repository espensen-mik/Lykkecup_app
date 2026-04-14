import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlayerDetailContent } from "@/components/player-detail-content";
import { fetchAssignedTeamNameForPlayer, fetchPlayerById } from "@/lib/players";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { player } = await fetchPlayerById(id);
  if (!player) {
    return { title: "Spiller ikke fundet — LykkeCup KontrolCenter" };
  }
  return {
    title: `${player.name} — LykkeCup KontrolCenter`,
    description: `Spillerdetaljer for ${player.name}`,
  };
}

export default async function PlayerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [{ player, error }, assignedTeamName] = await Promise.all([
    fetchPlayerById(id),
    fetchAssignedTeamNameForPlayer(id),
  ]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="mb-8 inline-flex text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
        >
          ← Tilbage til spillere
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse spiller: {error}
        </div>
      </div>
    );
  }

  if (!player) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Link
        href="/"
        className="mb-8 inline-flex text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
      >
        ← Tilbage til spillere
      </Link>

      <div className="rounded-lg border border-lc-border bg-white p-6 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none sm:p-8">
        <PlayerDetailContent player={player} assignedTeamName={assignedTeamName} />
      </div>
    </div>
  );
}
