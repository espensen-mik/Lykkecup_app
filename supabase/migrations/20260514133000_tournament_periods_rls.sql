-- RLS for tournament_periods (matches level_court_settings / holddannelse patterns).

create or replace function public.tournament_periods_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tournament_periods_set_updated_at on public.tournament_periods;
create trigger tournament_periods_set_updated_at
  before update on public.tournament_periods
  for each row execute function public.tournament_periods_set_updated_at();

grant select, insert, update, delete on table public.tournament_periods to authenticated;

alter table public.tournament_periods enable row level security;

drop policy if exists tournament_periods_select_authenticated on public.tournament_periods;
drop policy if exists tournament_periods_insert_authenticated on public.tournament_periods;
drop policy if exists tournament_periods_update_authenticated on public.tournament_periods;
drop policy if exists tournament_periods_delete_authenticated on public.tournament_periods;

create policy tournament_periods_select_authenticated
  on public.tournament_periods
  for select
  to authenticated
  using (true);

create policy tournament_periods_insert_authenticated
  on public.tournament_periods
  for insert
  to authenticated
  with check (true);

create policy tournament_periods_update_authenticated
  on public.tournament_periods
  for update
  to authenticated
  using (true)
  with check (true);

create policy tournament_periods_delete_authenticated
  on public.tournament_periods
  for delete
  to authenticated
  using (true);
