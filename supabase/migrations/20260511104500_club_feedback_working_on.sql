-- Kommentarer: "Arbejder på denne" live-status pr. kommentar i KontrolCenter.
alter table public.club_feedback
  add column if not exists working_on_user_id uuid references auth.users (id) on delete set null,
  add column if not exists working_on_name text,
  add column if not exists working_on_avatar_url text,
  add column if not exists working_on_at timestamptz;

create index if not exists club_feedback_working_on_event_idx
  on public.club_feedback (event_id, working_on_at desc)
  where working_on_user_id is not null;
