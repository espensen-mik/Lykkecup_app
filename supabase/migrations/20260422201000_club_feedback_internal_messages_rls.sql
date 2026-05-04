-- RLS på club_feedback_internal_messages blokerer INSERT uden politikker (fejl: "violates row-level security policy").
alter table public.club_feedback_internal_messages enable row level security;

drop policy if exists club_feedback_internal_messages_select_authenticated
  on public.club_feedback_internal_messages;
drop policy if exists club_feedback_internal_messages_insert_authenticated
  on public.club_feedback_internal_messages;

create policy club_feedback_internal_messages_select_authenticated
  on public.club_feedback_internal_messages
  for select
  to authenticated
  using (true);

create policy club_feedback_internal_messages_insert_authenticated
  on public.club_feedback_internal_messages
  for insert
  to authenticated
  with check (true);
