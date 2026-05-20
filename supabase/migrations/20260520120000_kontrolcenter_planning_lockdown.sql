-- KontrolCenter: global planlægnings-lockdown (Holddannelse + Turnering).

create table if not exists public.kontrolcenter_event_settings (
  event_id uuid primary key,
  planning_lockdown boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.kontrolcenter_event_settings is
  'Én række pr. turnering/event — globale KontrolCenter-indstillinger.';
comment on column public.kontrolcenter_event_settings.planning_lockdown is
  'Når true: Holddannelse og Turnering (puljer, kampe, opsætning) er skrivebeskyttet. App Indhold påvirkes ikke.';

insert into public.kontrolcenter_event_settings (event_id, planning_lockdown)
values ('ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid, false)
on conflict (event_id) do nothing;

grant select, insert, update on table public.kontrolcenter_event_settings to authenticated;

alter table public.kontrolcenter_event_settings enable row level security;

drop policy if exists kontrolcenter_event_settings_select_authenticated on public.kontrolcenter_event_settings;
create policy kontrolcenter_event_settings_select_authenticated
  on public.kontrolcenter_event_settings
  for select
  to authenticated
  using (true);

drop policy if exists kontrolcenter_event_settings_insert_admin on public.kontrolcenter_event_settings;
create policy kontrolcenter_event_settings_insert_admin
  on public.kontrolcenter_event_settings
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists kontrolcenter_event_settings_update_admin on public.kontrolcenter_event_settings;
create policy kontrolcenter_event_settings_update_admin
  on public.kontrolcenter_event_settings
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
