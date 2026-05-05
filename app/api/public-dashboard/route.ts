import { NextResponse } from "next/server";
import { fetchHolddannelseProgress } from "@/lib/holddannelse";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";

type PlayerRow = {
  id: string;
  age: number | null;
  home_club: string | null;
};

type CoachRow = {
  id: string;
  home_club: string | null;
};

function normalizeClub(value: string | null): string | null {
  const t = value?.trim();
  return t && t.length > 0 ? t : null;
}

function averageAge(rows: { age: number | null }[]): number | null {
  const nums = rows
    .map((r) => r.age)
    .filter((a): a is number => typeof a === "number" && !Number.isNaN(a));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, a) => s + a, 0) / nums.length) * 10) / 10;
}

export async function GET() {
  const [playersRes, coachesRes, progressRes, commentsTotalRes, commentsHandledRes] = await Promise.all([
    supabase.from("players").select("id, age, home_club").eq("event_id", LYKKECUP_EVENT_ID),
    supabase.from("coaches").select("id, home_club, age").eq("event_id", LYKKECUP_EVENT_ID),
    fetchHolddannelseProgress(),
    supabase
      .from("club_feedback")
      .select("id", { count: "exact", head: true })
      .eq("event_id", LYKKECUP_EVENT_ID),
    supabase
      .from("club_feedback")
      .select("id", { count: "exact", head: true })
      .eq("event_id", LYKKECUP_EVENT_ID)
      .not("handled_at", "is", null),
  ]);

  if (playersRes.error) {
    return NextResponse.json({ error: playersRes.error.message }, { status: 500 });
  }
  if (coachesRes.error) {
    return NextResponse.json({ error: coachesRes.error.message }, { status: 500 });
  }
  if (commentsTotalRes.error) {
    return NextResponse.json({ error: commentsTotalRes.error.message }, { status: 500 });
  }
  if (commentsHandledRes.error) {
    return NextResponse.json({ error: commentsHandledRes.error.message }, { status: 500 });
  }
  if (progressRes.error || !progressRes.progress) {
    return NextResponse.json(
      { error: progressRes.error ?? "Kunne ikke hente holddannelsesstatus." },
      { status: 500 },
    );
  }

  const players = (playersRes.data ?? []) as PlayerRow[];
  const coaches = (coachesRes.data ?? []) as (CoachRow & { age: number | null })[];

  const clubs = new Set<string>();
  for (const p of players) {
    const c = normalizeClub(p.home_club);
    if (c) clubs.add(c.toLocaleLowerCase("da"));
  }
  for (const c0 of coaches) {
    const c = normalizeClub(c0.home_club);
    if (c) clubs.add(c.toLocaleLowerCase("da"));
  }

  return NextResponse.json(
    {
      totals: {
        players: players.length,
        coaches: coaches.length,
        clubs: clubs.size,
        commentsTotal: commentsTotalRes.count ?? 0,
        commentsHandled: commentsHandledRes.count ?? 0,
      },
      averages: {
        playersAge: averageAge(players),
        coachesAge: averageAge(coaches),
      },
      progress: progressRes.progress,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
