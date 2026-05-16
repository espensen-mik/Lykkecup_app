-- RLS for pools (create/edit puljer from KontrolCenter).

grant select, insert, update, delete on table public.pools to authenticated;

alter table public.pools enable row level security;

drop policy if exists pools_select_authenticated on public.pools;
drop policy if exists pools_insert_authenticated on public.pools;
drop policy if exists pools_update_authenticated on public.pools;
drop policy if exists pools_delete_authenticated on public.pools;

create policy pools_select_authenticated
  on public.pools
  for select
  to authenticated
  using (true);

create policy pools_insert_authenticated
  on public.pools
  for insert
  to authenticated
  with check (true);

create policy pools_update_authenticated
  on public.pools
  for update
  to authenticated
  using (true)
  with check (true);

create policy pools_delete_authenticated
  on public.pools
  for delete
  to authenticated
  using (true);
