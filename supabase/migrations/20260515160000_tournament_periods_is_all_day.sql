-- «Hele dagen»-periode: planlægning følger bane-tilgængelighed, ikke Formiddag/Eftermiddag-vinduer.

alter table public.tournament_periods
  add column if not exists is_all_day boolean not null default false;

comment on column public.tournament_periods.is_all_day is
  'Når sand: puljens kampe må placeres i hele banernes tilgængelighed (start/slut er kun visning).';

insert into public.tournament_periods (event_id, name, start_time, end_time, sort_order, is_all_day)
select
  'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
  'Hele dagen',
  '2000-01-01T06:00:00.000Z'::timestamptz,
  '2000-01-01T22:00:00.000Z'::timestamptz,
  2,
  true
where not exists (
  select 1
  from public.tournament_periods tp
  where tp.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid
    and (tp.is_all_day = true or lower(trim(tp.name)) = lower('Hele dagen'))
);
