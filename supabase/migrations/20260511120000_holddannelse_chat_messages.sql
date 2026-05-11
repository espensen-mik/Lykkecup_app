-- CupChat (holddannelse_chat_messages): intern kort chat i KontrolCenter. Top-level beskeder + svar (kun ét niveau under hver tråd).
create table if not exists public.holddannelse_chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  parent_id uuid references public.holddannelse_chat_messages (id) on delete cascade,
  body text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_avatar_url text,
  created_at timestamptz not null default now(),
  constraint holddannelse_chat_messages_body_nonempty check (char_length(trim(body)) > 0)
);

create index if not exists holddannelse_chat_messages_event_parent_created_idx
  on public.holddannelse_chat_messages (event_id, parent_id, created_at desc);

create index if not exists holddannelse_chat_messages_event_top_created_idx
  on public.holddannelse_chat_messages (event_id, created_at desc)
  where parent_id is null;

comment on table public.holddannelse_chat_messages is 'Intern CupChat i KontrolCenter; nyeste top-level først, svar under hver tråd.';

grant select, insert on table public.holddannelse_chat_messages to authenticated;

alter table public.holddannelse_chat_messages enable row level security;

drop policy if exists holddannelse_chat_messages_select_authenticated
  on public.holddannelse_chat_messages;
drop policy if exists holddannelse_chat_messages_insert_authenticated
  on public.holddannelse_chat_messages;

create policy holddannelse_chat_messages_select_authenticated
  on public.holddannelse_chat_messages
  for select
  to authenticated
  using (true);

create policy holddannelse_chat_messages_insert_authenticated
  on public.holddannelse_chat_messages
  for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and char_length(trim(body)) > 0
    and (
      parent_id is null
      or exists (
        select 1
        from public.holddannelse_chat_messages p
        where p.id = holddannelse_chat_messages.parent_id
          and p.event_id = holddannelse_chat_messages.event_id
          and p.parent_id is null
      )
    )
  );
