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
    .select("id, event_id, home_club, author_name, comment_text, created_at")
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return { comments: [], error: error.message };
  }

  return {
    comments: (data ?? []) as ClubFeedbackRow[],
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
