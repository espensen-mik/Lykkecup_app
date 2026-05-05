-- Consolidate free-text clubs into a canonical lookup table for LykkeCup26.
-- This removes duplicate-looking names (e.g. hidden spaces) without losing player data.

create or replace function public.normalize_club_name(v text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(
      regexp_replace(
        replace(
          replace(
            replace(
              replace(coalesce(v, ''), chr(8203), ''), -- zero-width space
              chr(8204), ''                            -- zero-width non-joiner
            ),
            chr(8205), ''                              -- zero-width joiner
          ),
          chr(160), ' '                                -- non-breaking space
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.normalize_club_key(v text)
returns text
language sql
immutable
as $$
  select lower(coalesce(public.normalize_club_name(v), ''));
$$;

create table if not exists public.lykkecup26_clubs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  name text not null,
  normalized_key text generated always as (public.normalize_club_key(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lykkecup26_clubs_event_key_unique unique (event_id, normalized_key)
);

comment on table public.lykkecup26_clubs is 'LykkeCup26 clubs (canonical klubnavne pr. event).';

create index if not exists lykkecup26_clubs_event_idx on public.lykkecup26_clubs (event_id);

alter table public.lykkecup26_clubs enable row level security;

drop policy if exists lykkecup26_clubs_select_authenticated on public.lykkecup26_clubs;
create policy lykkecup26_clubs_select_authenticated
  on public.lykkecup26_clubs
  for select
  to authenticated
  using (true);

drop policy if exists lykkecup26_clubs_insert_authenticated on public.lykkecup26_clubs;
create policy lykkecup26_clubs_insert_authenticated
  on public.lykkecup26_clubs
  for insert
  to authenticated
  with check (true);

drop policy if exists lykkecup26_clubs_update_authenticated on public.lykkecup26_clubs;
create policy lykkecup26_clubs_update_authenticated
  on public.lykkecup26_clubs
  for update
  to authenticated
  using (true)
  with check (true);

alter table public.players add column if not exists club_id uuid;
alter table public.coaches add column if not exists club_id uuid;
alter table public.club_feedback add column if not exists club_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'players_club_id_fkey'
  ) then
    alter table public.players
      add constraint players_club_id_fkey
      foreign key (club_id) references public.lykkecup26_clubs(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'coaches_club_id_fkey'
  ) then
    alter table public.coaches
      add constraint coaches_club_id_fkey
      foreign key (club_id) references public.lykkecup26_clubs(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'club_feedback_club_id_fkey'
  ) then
    alter table public.club_feedback
      add constraint club_feedback_club_id_fkey
      foreign key (club_id) references public.lykkecup26_clubs(id) on delete set null;
  end if;
end $$;

create index if not exists players_club_id_idx on public.players (club_id);
create index if not exists coaches_club_id_idx on public.coaches (club_id);
create index if not exists club_feedback_club_id_idx on public.club_feedback (club_id);

with raw as (
  select event_id, public.normalize_club_name(home_club) as club_name
  from public.players
  union all
  select event_id, public.normalize_club_name(home_club) as club_name
  from public.coaches
  union all
  select event_id, public.normalize_club_name(home_club) as club_name
  from public.club_feedback
),
grouped as (
  select
    event_id,
    public.normalize_club_key(club_name) as normalized_key,
    min(club_name) as canonical_name
  from raw
  where club_name is not null
  group by event_id, public.normalize_club_key(club_name)
)
insert into public.lykkecup26_clubs (event_id, name)
select event_id, canonical_name
from grouped
on conflict (event_id, normalized_key)
do update set
  name = excluded.name,
  updated_at = now();

update public.players p
set club_id = c.id
from public.lykkecup26_clubs c
where c.event_id = p.event_id
  and c.normalized_key = public.normalize_club_key(p.home_club)
  and p.home_club is not null;

update public.coaches c0
set club_id = c.id
from public.lykkecup26_clubs c
where c.event_id = c0.event_id
  and c.normalized_key = public.normalize_club_key(c0.home_club)
  and c0.home_club is not null;

update public.club_feedback f
set club_id = c.id
from public.lykkecup26_clubs c
where c.event_id = f.event_id
  and c.normalized_key = public.normalize_club_key(f.home_club)
  and f.home_club is not null;

-- Rewrite text fields to canonical name (removes duplicate visual clubs).
update public.players p
set home_club = c.name
from public.lykkecup26_clubs c
where p.club_id = c.id
  and p.home_club is distinct from c.name;

update public.coaches c0
set home_club = c.name
from public.lykkecup26_clubs c
where c0.club_id = c.id
  and c0.home_club is distinct from c.name;

update public.club_feedback f
set home_club = c.name
from public.lykkecup26_clubs c
where f.club_id = c.id
  and f.home_club is distinct from c.name;

create or replace function public.sync_club_reference()
returns trigger
language plpgsql
as $$
declare
  normalized_name text;
  club_row public.lykkecup26_clubs%rowtype;
begin
  if NEW.event_id is null then
    return NEW;
  end if;

  if NEW.home_club is not null and public.normalize_club_name(NEW.home_club) is not null then
    normalized_name := public.normalize_club_name(NEW.home_club);
    insert into public.lykkecup26_clubs (event_id, name)
    values (NEW.event_id, normalized_name)
    on conflict (event_id, normalized_key) do update
      set updated_at = now()
    returning * into club_row;

    if club_row.id is null then
      select * into club_row
      from public.lykkecup26_clubs
      where event_id = NEW.event_id
        and normalized_key = public.normalize_club_key(normalized_name)
      limit 1;
    end if;

    NEW.club_id := club_row.id;
    NEW.home_club := club_row.name;
    return NEW;
  end if;

  if NEW.club_id is not null then
    select * into club_row
    from public.lykkecup26_clubs
    where id = NEW.club_id
      and event_id = NEW.event_id
    limit 1;

    if club_row.id is not null then
      NEW.home_club := club_row.name;
    else
      NEW.club_id := null;
      NEW.home_club := null;
    end if;
    return NEW;
  end if;

  NEW.home_club := null;
  return NEW;
end;
$$;

drop trigger if exists players_sync_club_reference on public.players;
create trigger players_sync_club_reference
before insert or update of home_club, club_id, event_id
on public.players
for each row
execute procedure public.sync_club_reference();

drop trigger if exists coaches_sync_club_reference on public.coaches;
create trigger coaches_sync_club_reference
before insert or update of home_club, club_id, event_id
on public.coaches
for each row
execute procedure public.sync_club_reference();

drop trigger if exists club_feedback_sync_club_reference on public.club_feedback;
create trigger club_feedback_sync_club_reference
before insert or update of home_club, club_id, event_id
on public.club_feedback
for each row
execute procedure public.sync_club_reference();
