-- Venues: fix missing authenticated policy (anon SELECT already exists via
-- 20260526120000_lc26_courts_venues_anon_select.sql).
-- Authenticated users need full access for admin CRUD (Haller & Baner workspace).

grant select, insert, update, delete on table public.venues to authenticated;

drop policy if exists venues_select_authenticated on public.venues;
drop policy if exists venues_insert_authenticated on public.venues;
drop policy if exists venues_update_authenticated on public.venues;
drop policy if exists venues_delete_authenticated on public.venues;

create policy venues_select_authenticated
  on public.venues for select to authenticated using (true);

create policy venues_insert_authenticated
  on public.venues for insert to authenticated with check (true);

create policy venues_update_authenticated
  on public.venues for update to authenticated using (true) with check (true);

create policy venues_delete_authenticated
  on public.venues for delete to authenticated using (true);
