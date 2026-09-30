-- Frivillige: tilmelding via lykkecup.dk/frivillig og administration i KontrolCenter.
-- Offentligheden kan kun indsende via submit_volunteer_signup(); tabellerne kan ikke læses af anon.
-- Tilbagerulning: supabase/rollback/20260930100000_volunteers_rollback.sql

begin;

create table public.volunteer_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  leader_volunteer_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.volunteers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid references public.volunteer_teams(id) on delete set null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
  email text not null check (char_length(email) between 3 and 320 and email like '%@%'),
  phone text not null check (char_length(btrim(phone)) between 4 and 40),
  birthdate date,
  participation text check (participation is null or char_length(participation) <= 200),
  availability text check (availability is null or char_length(availability) <= 200),
  availability_note text check (availability_note is null or char_length(availability_note) <= 1000),
  tshirt_size text check (tshirt_size is null or char_length(tshirt_size) <= 20),
  task_wish text check (task_wish is null or char_length(task_wish) <= 1000),
  buddy_wish text check (buddy_wish is null or char_length(buddy_wish) <= 1000),
  dietary_needs text check (dietary_needs is null or char_length(dietary_needs) <= 1000),
  photo_consent boolean,
  other_info text check (other_info is null or char_length(other_info) <= 4000),
  gdpr_consent_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 4000),
  source text not null default 'manual' check (source in ('web', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.volunteer_teams
  add constraint volunteer_teams_leader_fkey
  foreign key (leader_volunteer_id) references public.volunteers(id) on delete set null;

create index volunteers_event_idx on public.volunteers (event_id, last_name, first_name);
create index volunteers_team_idx on public.volunteers (team_id);
create index volunteer_teams_event_idx on public.volunteer_teams (event_id, sort_order, name);

-- Teamet skal høre til samme arrangement som den frivillige, og lederen skal være medlem af teamet.
create or replace function public.volunteers_check_team()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is not null and not exists (
    select 1 from public.volunteer_teams t where t.id = new.team_id and t.event_id = new.event_id
  ) then
    raise exception 'Teamet hører til et andet arrangement.';
  end if;
  if tg_op = 'UPDATE' and new.team_id is distinct from old.team_id then
    update public.volunteer_teams set leader_volunteer_id = null
    where leader_volunteer_id = new.id and id is distinct from new.team_id;
  end if;
  return new;
end;
$$;

create trigger volunteers_check_team
  before insert or update of team_id, event_id on public.volunteers
  for each row execute function public.volunteers_check_team();

create or replace function public.volunteer_teams_check_leader()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.leader_volunteer_id is not null and not exists (
    select 1 from public.volunteers v where v.id = new.leader_volunteer_id and v.team_id = new.id
  ) then
    raise exception 'Teamlederen skal være medlem af teamet.';
  end if;
  return new;
end;
$$;

create trigger volunteer_teams_check_leader
  before insert or update of leader_volunteer_id on public.volunteer_teams
  for each row execute function public.volunteer_teams_check_leader();

create trigger volunteers_set_updated_at
  before update on public.volunteers
  for each row execute function public.set_updated_at();

create trigger volunteer_teams_set_updated_at
  before update on public.volunteer_teams
  for each row execute function public.set_updated_at();

-- Arkivlås som på de øvrige årstabeller.
create trigger archived_event_guard
  before insert or update or delete on public.volunteers
  for each row execute function public.guard_archived_event_write();

create trigger archived_event_guard
  before insert or update or delete on public.volunteer_teams
  for each row execute function public.guard_archived_event_write();

-- Adgang: kun KontrolCenter-brugere.
alter table public.volunteers enable row level security;
alter table public.volunteer_teams enable row level security;

revoke all on public.volunteers from anon, public;
revoke all on public.volunteer_teams from anon, public;
grant select, insert, update, delete on public.volunteers to authenticated;
grant select, insert, update, delete on public.volunteer_teams to authenticated;

create policy volunteers_all_authenticated on public.volunteers
  for all to authenticated using (true) with check (true);
create policy volunteer_teams_all_authenticated on public.volunteer_teams
  for all to authenticated using (true) with check (true);

-- Offentlig tilmelding. Returnerer kun ok/fejl, aldrig data.
create or replace function public.submit_volunteer_signup(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_birthdate date,
  p_participation text,
  p_availability text,
  p_availability_note text,
  p_tshirt_size text,
  p_task_wish text,
  p_buddy_wish text,
  p_dietary_needs text,
  p_photo_consent boolean,
  p_other_info text,
  p_gdpr_consent boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (select 1 from public.events where id = p_event_id and status = 'active') then
    raise exception 'Tilmeldingen er ikke åben.';
  end if;
  if p_gdpr_consent is not true then
    raise exception 'Samtykke mangler.';
  end if;
  if (
    select count(*) from public.volunteers
    where event_id = p_event_id and lower(email) = v_email and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'For mange tilmeldinger fra samme e-mail. Prøv igen senere.';
  end if;

  insert into public.volunteers (
    event_id, first_name, last_name, email, phone, birthdate, participation, availability,
    availability_note, tshirt_size, task_wish, buddy_wish, dietary_needs, photo_consent,
    other_info, gdpr_consent_at, source
  ) values (
    p_event_id, btrim(p_first_name), btrim(p_last_name), v_email, btrim(p_phone), p_birthdate,
    nullif(btrim(p_participation), ''), nullif(btrim(p_availability), ''),
    nullif(btrim(p_availability_note), ''), nullif(btrim(p_tshirt_size), ''),
    nullif(btrim(p_task_wish), ''), nullif(btrim(p_buddy_wish), ''),
    nullif(btrim(p_dietary_needs), ''), p_photo_consent, nullif(btrim(p_other_info), ''),
    now(), 'web'
  );
end;
$$;

revoke all on function public.submit_volunteer_signup(
  uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, text, boolean
) from public;
grant execute on function public.submit_volunteer_signup(
  uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, text, boolean
) to anon, authenticated;

commit;

select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('volunteers', 'volunteer_teams')) as nye_tabeller,
  (select count(*) from pg_trigger where tgname = 'archived_event_guard') as beskyttede_tabeller;
