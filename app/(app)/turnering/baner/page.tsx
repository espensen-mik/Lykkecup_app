import type { Metadata } from "next";
import { BanerTiderWorkspace } from "@/components/turnering/baner-tider-workspace";
import { createServerSupabase } from "@/lib/auth-server";
import { fetchBanerTiderData } from "@/lib/baner-tider";
import { fetchPeriodsBundle } from "@/lib/tournament-periods";
import { fetchTurneringDashboardOverview } from "@/lib/turnering-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opsætning",
  description: "Turneringsopsætning: baner, niveauindstillinger og kampe",
};

export default async function BanerTiderPage() {
  const supabase = await createServerSupabase();
  const [bundle, overview, periodsBundle] = await Promise.all([
    fetchBanerTiderData(supabase),
    fetchTurneringDashboardOverview(),
    fetchPeriodsBundle(supabase),
  ]);
  const levels = overview.levels.map((l) => ({
    levelKey: l.levelKey,
    playerCount: l.playerCount,
    teamCount: l.teamCount,
  }));
  return <BanerTiderWorkspace initial={bundle} levels={levels} periodsBundle={periodsBundle} />;
}
