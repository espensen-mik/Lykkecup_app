-- Turneringsperioder (fx Formiddag / Eftermiddag) og pulje-tilknytning.

create table if not exists public.tournament_periods (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  name text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_periods_time_order check (end_time > start_time)
);

create index if not exists tournament_periods_event_sort_idx
  on public.tournament_periods (event_id, sort_order, name);

comment on table public.tournament_periods is
  'Tidsperioder for turneringen (fx Formiddag). Puljer spiller kampe inden for periodens vindue.';

alter table public.pools
  add column if not exists period_id uuid references public.tournament_periods (id) on delete set null;

create index if not exists pools_period_id_idx on public.pools (period_id);

comment on column public.pools.period_id is
  'Hvilken turneringsperiode puljens kampe skal ligge i.';

alter table public.matches
  add column if not exists round_index integer;

comment on column public.matches.round_index is
  'Rækkefølge på banen inden for perioden (scheduler).';

-- Standardperioder for LykkeCup-event (kan redigeres i app).
insert into public.tournament_periods (event_id, name, start_time, end_time, sort_order)
select
  'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
  v.name,
  v.start_time::timestamptz,
  v.end_time::timestamptz,
  v.sort_order
from (
  values
    ('Formiddag', '2000-01-01T08:00:00.000Z', '2000-01-01T12:00:00.000Z', 0),
    ('Eftermiddag', '2000-01-01T12:00:00.000Z', '2000-01-01T17:00:00.000Z', 1)
) as v (name, start_time, end_time, sort_order)
where not exists (
  select 1
  from public.tournament_periods tp
  where tp.event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid
);
