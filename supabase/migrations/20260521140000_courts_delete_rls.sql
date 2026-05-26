-- Slet baner fra Opsætning → Haller & baner (inkl. afhængigheder håndteres i app).

grant select, insert, update, delete on table public.courts to authenticated;
grant select, insert, update, delete on table public.court_availability to authenticated;
grant select, insert, update, delete on table public.court_breaks to authenticated;

alter table public.courts enable row level security;
alter table public.court_availability enable row level security;
alter table public.court_breaks enable row level security;

drop policy if exists courts_select_authenticated on public.courts;
drop policy if exists courts_insert_authenticated on public.courts;
drop policy if exists courts_update_authenticated on public.courts;
drop policy if exists courts_delete_authenticated on public.courts;

create policy courts_select_authenticated on public.courts for select to authenticated using (true);
create policy courts_insert_authenticated on public.courts for insert to authenticated with check (true);
create policy courts_update_authenticated on public.courts for update to authenticated using (true) with check (true);
create policy courts_delete_authenticated on public.courts for delete to authenticated using (true);

drop policy if exists court_availability_select_authenticated on public.court_availability;
drop policy if exists court_availability_insert_authenticated on public.court_availability;
drop policy if exists court_availability_update_authenticated on public.court_availability;
drop policy if exists court_availability_delete_authenticated on public.court_availability;

create policy court_availability_select_authenticated on public.court_availability for select to authenticated using (true);
create policy court_availability_insert_authenticated on public.court_availability for insert to authenticated with check (true);
create policy court_availability_update_authenticated on public.court_availability for update to authenticated using (true) with check (true);
create policy court_availability_delete_authenticated on public.court_availability for delete to authenticated using (true);

drop policy if exists court_breaks_select_authenticated on public.court_breaks;
drop policy if exists court_breaks_insert_authenticated on public.court_breaks;
drop policy if exists court_breaks_update_authenticated on public.court_breaks;
drop policy if exists court_breaks_delete_authenticated on public.court_breaks;

create policy court_breaks_select_authenticated on public.court_breaks for select to authenticated using (true);
create policy court_breaks_insert_authenticated on public.court_breaks for insert to authenticated with check (true);
create policy court_breaks_update_authenticated on public.court_breaks for update to authenticated using (true) with check (true);
create policy court_breaks_delete_authenticated on public.court_breaks for delete to authenticated using (true);
