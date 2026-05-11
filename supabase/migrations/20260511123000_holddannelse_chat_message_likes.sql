-- CupChat: thumbs-up likes per besked (top-level og svar).

create table if not exists public.holddannelse_chat_message_likes (
  message_id uuid not null references public.holddannelse_chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists holddannelse_chat_message_likes_message_idx
  on public.holddannelse_chat_message_likes (message_id);

comment on table public.holddannelse_chat_message_likes is 'Synes godt om på CupChat-beskeder; én like per bruger per besked.';

grant select, insert, delete on table public.holddannelse_chat_message_likes to authenticated;

alter table public.holddannelse_chat_message_likes enable row level security;

drop policy if exists holddannelse_chat_message_likes_select_authenticated
  on public.holddannelse_chat_message_likes;
drop policy if exists holddannelse_chat_message_likes_insert_authenticated
  on public.holddannelse_chat_message_likes;
drop policy if exists holddannelse_chat_message_likes_delete_own
  on public.holddannelse_chat_message_likes;

create policy holddannelse_chat_message_likes_select_authenticated
  on public.holddannelse_chat_message_likes
  for select
  to authenticated
  using (true);

create policy holddannelse_chat_message_likes_insert_authenticated
  on public.holddannelse_chat_message_likes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.holddannelse_chat_messages m
      where m.id = message_id
    )
  );

create policy holddannelse_chat_message_likes_delete_own
  on public.holddannelse_chat_message_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);
