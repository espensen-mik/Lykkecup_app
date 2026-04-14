import { UNKNOWN_CLUB_LABEL } from "@/lib/clubs";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { ClubFeedbackRow } from "@/types/club-feedback";

/** Samme nøgle som `groupPlayersByClub` bruger til klubnavn. */
export function clubKeyFromFeedbackHomeClub(home_club: string | null | undefined): string {
  const t = home_club?.trim();
  return t && t.length > 0 ? t : UNKNOWN_CLUB_LABEL;
}

export async function fetchClubFeedbackForEvent(): Promise<{
  comments: ClubFeedbackRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("club_feedback")
    .select(
      "id, event_id, home_club, author_name, comment_text, created_at, ll_status_text, ll_status_created_at, ll_status_author_id, ll_status_author_name, ll_status_author_avatar_url, handled_at, handled_by",
    )
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return { comments: [], error: error.message };
  }

  const rows = (data ?? []) as ClubFeedbackRow[];
  return {
    comments: rows.map((r) => ({
      ...r,
      ll_status_text: r.ll_status_text ?? null,
      ll_status_created_at: r.ll_status_created_at ?? null,
      ll_status_author_id: r.ll_status_author_id ?? null,
      ll_status_author_name: r.ll_status_author_name ?? null,
      ll_status_author_avatar_url: r.ll_status_author_avatar_url ?? null,
      handled_at: r.handled_at ?? null,
      handled_by: r.handled_by ?? null,
    })),
    error: null,
  };
}

/** Sandt hvis mindst én kommentar for arrangementet er oprettet inden for de seneste `hours` timer. */
export async function hasClubFeedbackInLastHours(hours: number): Promise<boolean> {
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();
  const { count, error } = await supabase
    .from("club_feedback")
    .select("id", { count: "exact", head: true })
    .eq("event_id", LYKKECUP_EVENT_ID)
    .gte("created_at", sinceIso);

  if (error) return false;
  return (count ?? 0) > 0;
}

/** Antal trænerkommentarer i alt og inden for de seneste `hours` timer (til dashboard-KPI’er). */
export async function fetchClubFeedbackCounts(hoursRecent = 24): Promise<{
  total: number;
  recent: number;
  error: string | null;
}> {
  const sinceIso = new Date(Date.now() - hoursRecent * 60 * 60 * 1000).toISOString();

  const [totalRes, recentRes] = await Promise.all([
    supabase
      .from("club_feedback")
      .select("id", { count: "exact", head: true })
      .eq("event_id", LYKKECUP_EVENT_ID),
    supabase
      .from("club_feedback")
      .select("id", { count: "exact", head: true })
      .eq("event_id", LYKKECUP_EVENT_ID)
      .gte("created_at", sinceIso),
  ]);

  const err = totalRes.error?.message ?? recentRes.error?.message ?? null;
  if (err) {
    return { total: 0, recent: 0, error: err };
  }

  return {
    total: totalRes.count ?? 0,
    recent: recentRes.count ?? 0,
    error: null,
  };
}

/** Kommentarer grupperet efter klub (matcher klubkort), nyeste først pr. klub. */
export function indexFeedbackByClub(comments: ClubFeedbackRow[]): Map<string, ClubFeedbackRow[]> {
  const map = new Map<string, ClubFeedbackRow[]>();
  for (const r of comments) {
    const key = clubKeyFromFeedbackHomeClub(r.home_club);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return map;
}
