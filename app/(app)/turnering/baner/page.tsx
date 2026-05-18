import type { Metadata } from "next";
import { BanerTiderWorkspace } from "@/components/turnering/baner-tider-workspace";
import { createServerSupabase } from "@/lib/auth-server";
import { fetchBanerTiderData } from "@/lib/baner-tider";
import { computePeriodCapacityHints } from "@/lib/period-capacity";
import { fetchPeriodsBundle } from "@/lib/tournament-periods";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import { fetchTurneringDashboardOverview } from "@/lib/turnering-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opsætning",
  description: "Turneringsopsætning: baner, niveauindstillinger og kampe",
};

export default async function BanerTiderPage() {
  const supabase = await createServerSupabase();
  const [bundle, overview, periodsBundle, teamsRes, matchesRes, poolsRes] = await Promise.all([
    fetchBanerTiderData(supabase),
    fetchTurneringDashboardOverview(),
    fetchPeriodsBundle(supabase),
    supabase.from("teams").select("pool_id, level").eq("event_id", TURNERING_EVENT_ID),
    supabase.from("matches").select("pool_id, court_id").eq("event_id", TURNERING_EVENT_ID),
    supabase.from("pools").select("id, level").eq("event_id", TURNERING_EVENT_ID),
  ]);
  const capacityHints = computePeriodCapacityHints(
    periodsBundle,
    (teamsRes.data ?? []) as { pool_id: string | null; level: string | null }[],
    (matchesRes.data ?? []) as { pool_id: string; court_id: string | null }[],
    bundle,
  );
  const levels = overview.levels.map((l) => ({
    levelKey: l.levelKey,
    playerCount: l.playerCount,
    teamCount: l.teamCount,
  }));
  const pools = (poolsRes.data ?? []) as { id: string; level: string | null }[];
  const teams = (teamsRes.data ?? []) as { pool_id: string | null }[];

  return (
    <BanerTiderWorkspace
      initial={bundle}
      levels={levels}
      pools={pools}
      teams={teams}
      periodsBundle={periodsBundle}
      capacityHints={capacityHints}
    />
  );
}
