-- Audit log for player edits from KontrolCenter.
-- Tracks what changed, when, and by whom.

create table if not exists public.player_change_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  event_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  changed_by_name text
);

create index if not exists player_change_log_player_idx
  on public.player_change_log (player_id, changed_at desc);

comment on table public.player_change_log is 'Historik over manuelle ændringer af spillere i KontrolCenter.';

create or replace function public.log_player_update_changes()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  if actor_id is not null then
    select coalesce(nullif(trim(full_name), ''), 'Ukendt bruger')
      into actor_name
      from public.profiles
      where id = actor_id
      limit 1;
  end if;

  if actor_name is null then
    actor_name := 'Ukendt bruger';
  end if;

  if new.name is distinct from old.name then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'name', old.name, new.name, actor_id, actor_name);
  end if;

  if new.home_club is distinct from old.home_club then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'home_club', old.home_club, new.home_club, actor_id, actor_name);
  end if;

  if new.birthdate is distinct from old.birthdate then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'birthdate', old.birthdate::text, new.birthdate::text, actor_id, actor_name);
  end if;

  if new.age is distinct from old.age then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'age', old.age::text, new.age::text, actor_id, actor_name);
  end if;

  if new.gender is distinct from old.gender then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'gender', old.gender, new.gender, actor_id, actor_name);
  end if;

  if new.level is distinct from old.level then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'level', old.level, new.level, actor_id, actor_name);
  end if;

  if new.preferences is distinct from old.preferences then
    insert into public.player_change_log (player_id, event_id, field_name, old_value, new_value, changed_by, changed_by_name)
    values (new.id, new.event_id, 'preferences', old.preferences::text, new.preferences::text, actor_id, actor_name);
  end if;

  return new;
end;
$$;

drop trigger if exists players_track_change_log on public.players;
create trigger players_track_change_log
  after update on public.players
  for each row
  execute procedure public.log_player_update_changes();

alter table public.player_change_log enable row level security;

drop policy if exists "player_change_log_authenticated_select" on public.player_change_log;
create policy "player_change_log_authenticated_select"
  on public.player_change_log
  for select
  to authenticated
  using (true);

drop policy if exists "player_change_log_authenticated_insert" on public.player_change_log;
create policy "player_change_log_authenticated_insert"
  on public.player_change_log
  for insert
  to authenticated
  with check (true);
