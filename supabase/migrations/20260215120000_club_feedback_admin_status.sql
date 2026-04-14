-- Internal admin workflow for trænerkommentarer (Kommentarer i KontrolCenter).
-- Kør i Supabase SQL Editor hvis migration ikke køres automatisk.

alter table public.club_feedback
  add column if not exists ll_status_text text,
  add column if not exists ll_status_created_at timestamptz,
  add column if not exists ll_status_author_id uuid references auth.users (id) on delete set null,
  add column if not exists ll_status_author_name text,
  add column if not exists ll_status_author_avatar_url text,
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references auth.users (id) on delete set null;

comment on column public.club_feedback.ll_status_text is 'Status fra LykkeLiga (intern note til admins)';
comment on column public.club_feedback.handled_at is 'Når kommentaren er markeret som håndteret';

-- RLS: hvis row level security er aktiveret på club_feedback, skal indloggede brugere kunne opdatere
-- interne felter. Eksempel (tilpas USING/WITH CHECK til jeres regler):
--
-- create policy "club_feedback_update_authenticated"
--   on public.club_feedback for update to authenticated
--   using (true) with check (true);
