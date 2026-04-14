export type ClubFeedbackRow = {
  id: string;
  event_id: string;
  home_club: string;
  author_name: string;
  comment_text: string;
  created_at: string;
  /** Intern status fra LykkeLiga-admin (efter migration) */
  ll_status_text?: string | null;
  ll_status_created_at?: string | null;
  ll_status_author_id?: string | null;
  ll_status_author_name?: string | null;
  ll_status_author_avatar_url?: string | null;
  handled_at?: string | null;
  handled_by?: string | null;
};
