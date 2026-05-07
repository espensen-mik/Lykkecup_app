import type { Metadata } from "next";
import { ClubsLiveList } from "@/components/clubs-live-list";
import { fetchClubFeedbackForEvent } from "@/lib/club-feedback";
import { fetchPlayersForEvent, LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klubber",
  description: "Spillere grupperet efter klub",
};

export default async function KlubberPage() {
  const [playersRes, feedbackRes, membersRes] = await Promise.all([
    fetchPlayersForEvent(),
    fetchClubFeedbackForEvent(),
    supabase.from("team_members").select("player_id").eq("event_id", LYKKECUP_EVENT_ID),
  ]);
  const { players, error } = playersRes;
  const feedbackLoadError = feedbackRes.error;
  const membersLoadError = membersRes.error?.message ?? null;
  const assignedPlayerIds = ((membersRes.data ?? []) as { player_id: string }[]).map(
    (row) => row.player_id,
  );

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Klubber
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse spillere: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 lg:space-y-11">
      <ClubsLiveList
        initialPlayers={players}
        comments={feedbackRes.comments}
        assignedPlayerIds={assignedPlayerIds}
        feedbackLoadError={feedbackLoadError}
        membersLoadError={membersLoadError}
      />
    </div>
  );
}
