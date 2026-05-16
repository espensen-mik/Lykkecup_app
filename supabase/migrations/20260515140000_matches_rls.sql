-- RLS for matches so Turneringsplan can insert/update court_id and times from the client.

grant select, insert, update, delete on table public.matches to authenticated;

alter table public.matches enable row level security;

drop policy if exists matches_select_authenticated on public.matches;
drop policy if exists matches_insert_authenticated on public.matches;
drop policy if exists matches_update_authenticated on public.matches;
drop policy if exists matches_delete_authenticated on public.matches;

create policy matches_select_authenticated
  on public.matches
  for select
  to authenticated
  using (true);

create policy matches_insert_authenticated
  on public.matches
  for insert
  to authenticated
  with check (true);

create policy matches_update_authenticated
  on public.matches
  for update
  to authenticated
  using (true)
  with check (true);

create policy matches_delete_authenticated
  on public.matches
  for delete
  to authenticated
  using (true);
