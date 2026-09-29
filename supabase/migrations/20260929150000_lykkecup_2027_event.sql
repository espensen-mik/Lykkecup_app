-- LykkeCup 2027: arrangement-metadata, 2027-rækken og kopi af 2026-opsætningen.
-- Spillere, trænere, hold, puljer og kampe kopieres ikke. Intet i 2026 ændres ud over nye kolonner.
-- Tilbagerulning: supabase/rollback/20260929150000_lykkecup_2027_event_rollback.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. Nye kolonner på events
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists status text not null default 'active',
  add column if not exists public_path text,
  add column if not exists wp_event_id bigint;

alter table public.events
  drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check check (status in ('active', 'archived'));

comment on column public.events.status is 'active = kan redigeres i KontrolCenter; archived = skrivebeskyttet arkiv.';
comment on column public.events.public_path is 'Sti til arrangementets offentlige app, fx /lykkecup26.';
comment on column public.events.wp_event_id is 'WordPress Event Tickets event-id (billetter og Galla).';

update public.events
set public_path = '/lykkecup26',
    wp_event_id = 16899
where id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

-- ---------------------------------------------------------------------------
-- 2. LykkeCup 2027
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.events
    where id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3' or slug = 'lykkecup-2027'
  ) then
    raise exception 'LykkeCup 2027 findes allerede. Migrationen er afbrudt uden ændringer.';
  end if;
end $$;

insert into public.events (id, slug, name, starts_on, ends_on, location, status)
values (
  'a73a3acb-5424-4140-baf2-a6e2f00103a3',
  'lykkecup-2027',
  'LykkeCup 2027',
  '2027-06-05',
  '2027-06-05',
  'Herning',
  'active'
);

insert into public.kontrolcenter_event_settings (event_id, planning_lockdown)
values ('a73a3acb-5424-4140-baf2-a6e2f00103a3', false);

-- ---------------------------------------------------------------------------
-- 3. Galla-billetter knyttes til et arrangement
-- ---------------------------------------------------------------------------
-- Standardværdien holder den nuværende import (galla_import_staging_to_tickets) på 2026.
alter table public.galla_tickets
  add column if not exists event_id uuid not null
    default 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'
    references public.events(id) on delete restrict;

create index if not exists galla_tickets_event_id_idx on public.galla_tickets (event_id);

-- ---------------------------------------------------------------------------
-- 4. Kopi af 2026-opsætningen til 2027
-- ---------------------------------------------------------------------------
insert into public.venues (event_id, name, sort_order)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', v.name, v.sort_order
from public.venues v
where v.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.courts (event_id, venue_id, name, sort_order, court_type, is_active)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', v27.id, c.name, c.sort_order, c.court_type, c.is_active
from public.courts c
join public.venues v26 on v26.id = c.venue_id
join public.venues v27
  on v27.event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3' and v27.name = v26.name
where c.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

create temporary table court_map_2027 on commit drop as
select c26.id as old_id, c27.id as new_id
from public.courts c26
join public.venues v26 on v26.id = c26.venue_id
join public.venues v27
  on v27.event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3' and v27.name = v26.name
join public.courts c27 on c27.venue_id = v27.id and c27.name = c26.name
where c26.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.court_availability (event_id, court_id, start_time, end_time)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', m.new_id, a.start_time, a.end_time
from public.court_availability a
join court_map_2027 m on m.old_id = a.court_id
where a.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.court_breaks (event_id, court_id, label, start_time, end_time)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', m.new_id, b.label, b.start_time, b.end_time
from public.court_breaks b
join court_map_2027 m on m.old_id = b.court_id
where b.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.tournament_periods (event_id, name, start_time, end_time, sort_order, is_all_day)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', p.name, p.start_time, p.end_time, p.sort_order, p.is_all_day
from public.tournament_periods p
where p.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.level_court_settings (event_id, level, court_type)
select 'a73a3acb-5424-4140-baf2-a6e2f00103a3', s.level, s.court_type
from public.level_court_settings s
where s.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

insert into public.level_schedule_settings (
  event_id, level, match_duration_minutes, break_between_matches_minutes,
  plan_target_players_per_team, plan_matches_per_team, rounds_per_match,
  plan_target_teams_per_pool, plan_max_teams_per_pool
)
select
  'a73a3acb-5424-4140-baf2-a6e2f00103a3', s.level, s.match_duration_minutes, s.break_between_matches_minutes,
  s.plan_target_players_per_team, s.plan_matches_per_team, s.rounds_per_match,
  s.plan_target_teams_per_pool, s.plan_max_teams_per_pool
from public.level_schedule_settings s
where s.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

-- Kopien skal have lige så mange rækker som 2026; ellers rulles alt tilbage.
do $$
declare
  t text;
  n26 bigint;
  n27 bigint;
begin
  foreach t in array array[
    'venues', 'courts', 'court_availability', 'court_breaks',
    'tournament_periods', 'level_court_settings', 'level_schedule_settings'
  ] loop
    execute format('select count(*) from public.%I where event_id = $1', t)
      into n26 using 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid;
    execute format('select count(*) from public.%I where event_id = $1', t)
      into n27 using 'a73a3acb-5424-4140-baf2-a6e2f00103a3'::uuid;
    if n26 <> n27 then
      raise exception 'Kopi af % fejlede: 2026 har %, 2027 har %', t, n26, n27;
    end if;
  end loop;
end $$;

commit;

-- Oversigt efter kørsel
select e.name as arrangement, e.status, e.public_path, e.wp_event_id,
  (select count(*) from public.venues x where x.event_id = e.id) as haller,
  (select count(*) from public.courts x where x.event_id = e.id) as baner,
  (select count(*) from public.court_availability x where x.event_id = e.id) as banetider,
  (select count(*) from public.tournament_periods x where x.event_id = e.id) as perioder,
  (select count(*) from public.level_court_settings x where x.event_id = e.id) as niveau_baner,
  (select count(*) from public.level_schedule_settings x where x.event_id = e.id) as niveau_tider,
  (select count(*) from public.players x where x.event_id = e.id) as spillere,
  (select count(*) from public.teams x where x.event_id = e.id) as hold,
  (select count(*) from public.galla_tickets x where x.event_id = e.id) as galla_billetter
from public.events e
order by e.starts_on;
