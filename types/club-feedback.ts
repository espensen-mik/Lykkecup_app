/** Én intern besked i admin-tråden til en trænerkommentar. */
export type ClubFeedbackInternalMessage = {
  id: string;
  club_feedback_id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
};

export type ClubFeedbackRow = {
  id: string;
  event_id: string;
  home_club: string;
  author_name: string;
  /** Valgfrit; gemmes men vises ikke på den offentlige coach-feedback-side. */
  author_phone?: string | null;
  comment_text: string;
  created_at: string;
  /** @deprecated Enkeltfelt — vises som historik; nye svar bruger `internal_thread`. */
  ll_status_text?: string | null;
  ll_status_created_at?: string | null;
  ll_status_author_id?: string | null;
  ll_status_author_name?: string | null;
  ll_status_author_avatar_url?: string | null;
  handled_at?: string | null;
  handled_by?: string | null;
  /** Fyldes kun i KontrolCenter-fetch (indlogget session). */
  internal_thread?: ClubFeedbackInternalMessage[];
};
