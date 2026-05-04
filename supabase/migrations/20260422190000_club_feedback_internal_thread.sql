-- Intern diskussionstråd pr. trænerkommentar (KontrolCenter). Flere admins, flere beskeder hver.
create table if not exists public.club_feedback_internal_messages (
  id uuid primary key default gen_random_uuid(),
  club_feedback_id uuid not null references public.club_feedback (id) on delete cascade,
  event_id uuid not null,
  body text not null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  author_avatar_url text,
  created_at timestamptz not null default now(),
  constraint club_feedback_internal_messages_body_nonempty check (char_length(trim(body)) > 0)
);

create index if not exists club_feedback_internal_messages_feedback_idx
  on public.club_feedback_internal_messages (club_feedback_id, created_at);

create index if not exists club_feedback_internal_messages_event_idx
  on public.club_feedback_internal_messages (event_id);

comment on table public.club_feedback_internal_messages is 'Intern admin-tråd pr. club_feedback-række; ikke synlig på coach-feedback.';

-- Kun indloggede KontrolCenter-brugere (authenticated) læser/skriver.
grant select, insert on table public.club_feedback_internal_messages to authenticated;
