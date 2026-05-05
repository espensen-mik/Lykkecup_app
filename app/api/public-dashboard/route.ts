import { NextResponse } from "next/server";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import { fetchHolddannelseProgress } from "@/lib/holddannelse";

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

function ageBuckets(players: PlayerRow[]): { label: string; count: number }[] {
  type Acc = { count: number; sortKey: number };
  const map = new Map<string, Acc>();
  const add = (label: string, sortKey: number) => {
    const cur = map.get(label);
    if (cur) cur.count += 1;
    else map.set(label, { count: 1, sortKey });
  };

  for (const p of players) {
    const raw = p.age;
    if (raw == null || Number.isNaN(Number(raw))) {
      add("Ukendt", 10_000);
      continue;
    }
    const age = Math.floor(Number(raw));
    if (age < 0 || age > 120) {
      add("Ukendt", 10_000);
      continue;
    }
    if (age >= 25) add("25+", 25);
    else add(String(age), age);
  }

  return Array.from(map.entries())
    .map(([label, { count, sortKey }]) => ({ label, count, sortKey }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ label, count }) => ({ label, count }));
}

export async function GET() {
  const [playersRes, coachesRes, progressRes] = await Promise.all([
    supabase.from("players").select("id, age, home_club").eq("event_id", LYKKECUP_EVENT_ID),
    supabase.from("coaches").select("id, home_club").eq("event_id", LYKKECUP_EVENT_ID),
    fetchHolddannelseProgress(),
  ]);

  if (playersRes.error) {
    return NextResponse.json({ error: playersRes.error.message }, { status: 500 });
  }
  if (coachesRes.error) {
    return NextResponse.json({ error: coachesRes.error.message }, { status: 500 });
  }
  if (progressRes.error || !progressRes.progress) {
    return NextResponse.json(
      { error: progressRes.error ?? "Kunne ikke hente holddannelsesstatus." },
      { status: 500 },
    );
  }

  const players = (playersRes.data ?? []) as PlayerRow[];
  const coaches = (coachesRes.data ?? []) as CoachRow[];

  const clubs = new Set<string>();
  for (const p of players) {
    const c = normalizeClub(p.home_club);
    if (c) clubs.add(c.toLocaleLowerCase("da"));
  }
  for (const c0 of coaches) {
    const c = normalizeClub(c0.home_club);
    if (c) clubs.add(c.toLocaleLowerCase("da"));
  }

  const ageRows = ageBuckets(players);

  return NextResponse.json(
    {
      totals: {
        players: players.length,
        coaches: coaches.length,
        clubs: clubs.size,
      },
      progress: progressRes.progress,
      ageDistribution: ageRows,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
