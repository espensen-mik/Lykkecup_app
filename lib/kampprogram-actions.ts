"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/auth-server";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import { TURNERING_EVENT_ID } from "@/lib/turnering";
import type { TurneringActionResult } from "@/lib/turnering-actions";

export async function deleteOrphanMatchesAction(): Promise<
  TurneringActionResult & { deleted?: number }
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Du skal være logget ind." };
  }

  const eventId = TURNERING_EVENT_ID;
  const [matchesRes, teamsRes, poolsRes] = await Promise.all([
    supabase.from("matches").select("id, pool_id, team_a_id, team_b_id").eq("event_id", eventId),
    supabase.from("teams").select("id").eq("event_id", eventId),
    supabase.from("pools").select("id").eq("event_id", eventId),
  ]);

  const err = matchesRes.error?.message ?? teamsRes.error?.message ?? poolsRes.error?.message ?? null;
  if (err) return { ok: false, message: err };

  const teamIds = new Set(((teamsRes.data ?? []) as { id: string }[]).map((t) => t.id));
  const poolIds = new Set(((poolsRes.data ?? []) as { id: string }[]).map((p) => p.id));

  const orphanIds: string[] = [];
  for (const row of (matchesRes.data ?? []) as Array<{
    id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
  }>) {
    if (isOrphanKampprogramMatch(
      { teamAId: row.team_a_id, teamBId: row.team_b_id, poolId: row.pool_id },
      teamIds,
      poolIds,
    )) {
      orphanIds.push(row.id);
    }
  }

  if (orphanIds.length === 0) {
    return { ok: true, message: "Ingen forældreløse kampe at slette.", deleted: 0 };
  }

  const { error } = await supabase.from("matches").delete().eq("event_id", eventId).in("id", orphanIds);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/kampprogram");
  revalidatePath("/turnering");
  revalidatePath("/turnering/plan");

  return {
    ok: true,
    message: `${orphanIds.length} forældreløse kampe blev slettet.`,
    deleted: orphanIds.length,
  };
}
