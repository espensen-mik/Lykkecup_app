-- Niveau → foretrukken banetype (mini / kort / stor) for kapacitetsberegning og senere scheduler.

create table if not exists public.level_court_settings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  level text not null,
  court_type public.court_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_court_settings_level_nonempty check (char_length(trim(level)) > 0),
  constraint level_court_settings_event_level_unique unique (event_id, level)
);

create index if not exists level_court_settings_event_id_idx on public.level_court_settings (event_id);

comment on table public.level_court_settings is 'Per event: hvilken bane-størrelse et niveau skal planlægges på — LykkeCup Regnemaskine og global scheduler.';

create or replace function public.level_court_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists level_court_settings_set_updated_at on public.level_court_settings;
create trigger level_court_settings_set_updated_at
  before update on public.level_court_settings
  for each row execute function public.level_court_settings_set_updated_at();

grant select, insert, update, delete on table public.level_court_settings to authenticated;

alter table public.level_court_settings enable row level security;

drop policy if exists level_court_settings_select_authenticated on public.level_court_settings;
drop policy if exists level_court_settings_insert_authenticated on public.level_court_settings;
drop policy if exists level_court_settings_update_authenticated on public.level_court_settings;
drop policy if exists level_court_settings_delete_authenticated on public.level_court_settings;

create policy level_court_settings_select_authenticated
  on public.level_court_settings
  for select
  to authenticated
  using (true);

create policy level_court_settings_insert_authenticated
  on public.level_court_settings
  for insert
  to authenticated
  with check (true);

create policy level_court_settings_update_authenticated
  on public.level_court_settings
  for update
  to authenticated
  using (true)
  with check (true);

create policy level_court_settings_delete_authenticated
  on public.level_court_settings
  for delete
  to authenticated
  using (true);
