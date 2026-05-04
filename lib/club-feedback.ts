import type { SupabaseClient } from "@supabase/supabase-js";
import { UNKNOWN_CLUB_LABEL } from "@/lib/clubs";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { ClubFeedbackInternalMessage, ClubFeedbackRow } from "@/types/club-feedback";

/** Samme nøgle som `groupPlayersByClub` bruger til klubnavn. */
export function clubKeyFromFeedbackHomeClub(home_club: string | null | undefined): string {
  const t = home_club?.trim();
  return t && t.length > 0 ? t : UNKNOWN_CLUB_LABEL;
}

function normalizeClubFeedbackRow(r: ClubFeedbackRow): ClubFeedbackRow {
  return {
    ...r,
    author_phone: r.author_phone ?? null,
    ll_status_text: r.ll_status_text ?? null,
    ll_status_created_at: r.ll_status_created_at ?? null,
    ll_status_author_id: r.ll_status_author_id ?? null,
    ll_status_author_name: r.ll_status_author_name ?? null,
    ll_status_author_avatar_url: r.ll_status_author_avatar_url ?? null,
    handled_at: r.handled_at ?? null,
    handled_by: r.handled_by ?? null,
  };
}

export async function fetchClubFeedbackForEvent(): Promise<{
  comments: ClubFeedbackRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("club_feedback")
    .select(
      "id, event_id, home_club, author_name, author_phone, comment_text, created_at, ll_status_text, ll_status_created_at, ll_status_author_id, ll_status_author_name, ll_status_author_avatar_url, handled_at, handled_by",
    )
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return { comments: [], error: error.message };
  }

  const rows = (data ?? []) as ClubFeedbackRow[];
  return {
    comments: rows.map((r) => normalizeClubFeedbackRow(r)),
    error: null,
  };
}

/**
 * Kommentarer-siden: samme rækker som `fetchClubFeedbackForEvent`, plus intern tråd pr. feedback.
 * Kræver indlogget Supabase-klient (server cookies), så RLS/grants for `club_feedback_internal_messages` gælder.
 */
export async function fetchClubFeedbackForKontrolcenter(client: SupabaseClient): Promise<{
  comments: ClubFeedbackRow[];
  error: string | null;
}> {
  const { data, error } = await client
    .from("club_feedback")
    .select(
      "id, event_id, home_club, author_name, author_phone, comment_text, created_at, ll_status_text, ll_status_created_at, ll_status_author_id, ll_status_author_name, ll_status_author_avatar_url, handled_at, handled_by",
    )
    .eq("event_id", LYKKECUP_EVENT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return { comments: [], error: error.message };
  }

  const rows = (data ?? []) as ClubFeedbackRow[];
  const ids = rows.map((r) => r.id).filter(Boolean);
  const threadByFeedback = new Map<string, ClubFeedbackInternalMessage[]>();

  if (ids.length > 0) {
    const { data: msgData, error: msgError } = await client
      .from("club_feedback_internal_messages")
      .select("id, club_feedback_id, body, author_id, author_name, author_avatar_url, created_at")
      .eq("event_id", LYKKECUP_EVENT_ID)
      .in("club_feedback_id", ids)
      .order("created_at", { ascending: true });

    if (msgError) {
      return { comments: [], error: msgError.message };
    }

    for (const m of (msgData ?? []) as ClubFeedbackInternalMessage[]) {
      const list = threadByFeedback.get(m.club_feedback_id) ?? [];
      list.push(m);
      threadByFeedback.set(m.club_feedback_id, list);
    }
  }

  return {
    comments: rows.map((r) => ({
      ...normalizeClubFeedbackRow(r),
      internal_thread: threadByFeedback.get(r.id) ?? [],
    })),
    error: null,
  };
}

/** Antal kommentarer for arrangementet, som endnu ikke er markeret som håndteret. */
export async function fetchUnhandledClubFeedbackCount(): Promise<number> {
  const { count, error } = await supabase
    .from("club_feedback")
    .select("id", { count: "exact", head: true })
    .eq("event_id", LYKKECUP_EVENT_ID)
    .is("handled_at", null);

  if (error) return 0;
  return count ?? 0;
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
