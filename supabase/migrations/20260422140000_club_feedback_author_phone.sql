-- Optional phone from coach on public coach-feedback page; shown only in KontrolCenter.
-- Run in Supabase SQL Editor if migrations are not applied automatically.

alter table public.club_feedback
  add column if not exists author_phone text;

comment on column public.club_feedback.author_phone is 'Valgfrit telefonnummer fra træner; vises ikke på den offentlige coach-feedback-side.';
