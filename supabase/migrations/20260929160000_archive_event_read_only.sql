-- Skrivebeskyttet arkiv: rækker, der hører til et arrangement med status 'archived', kan ikke
-- oprettes, ændres eller slettes. Gælder alle roller, også SECURITY DEFINER-funktioner og SQL Editor.
-- Nødåbning i én transaktion:  begin; set local lc.allow_archived_writes = 'on'; ...; commit;
-- App Indhold (lc26_*), analytics og importtabeller er bevidst ikke omfattet.
-- Tilbagerulning: supabase/rollback/20260929160000_archive_event_read_only_rollback.sql

begin;

create or replace function public.event_is_archived(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'archived' from public.events where id = p_event_id), false);
$$;

create or replace function public.guard_archived_event_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if current_setting('lc.allow_archived_writes', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'holddannelse_chat_message_likes' then
    if tg_op <> 'INSERT' then
      select m.event_id into v_old from public.holddannelse_chat_messages m where m.id = old.message_id;
    end if;
    if tg_op <> 'DELETE' then
      select m.event_id into v_new from public.holddannelse_chat_messages m where m.id = new.message_id;
    end if;
  else
    if tg_op <> 'INSERT' then v_old := (to_jsonb(old) ->> 'event_id')::uuid; end if;
    if tg_op <> 'DELETE' then v_new := (to_jsonb(new) ->> 'event_id')::uuid; end if;
  end if;

  if public.event_is_archived(v_old) or public.event_is_archived(v_new) then
    raise exception 'Arrangementet er arkiveret og kan ikke ændres.'
      using errcode = 'P0001', hint = 'Vælg et aktivt år i KontrolCenter.';
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.guard_archived_event_write() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'club_feedback', 'club_feedback_internal_messages', 'coach_change_log', 'coaches',
    'court_availability', 'court_breaks', 'courts', 'galla_tickets',
    'holddannelse_chat_message_likes', 'holddannelse_chat_messages', 'kontrolcenter_event_settings',
    'level_court_settings', 'level_schedule_settings', 'lykkecup26_clubs', 'matches',
    'player_change_log', 'players', 'pools', 'team_coaches', 'team_members', 'teams',
    'tournament_periods', 'venues'
  ] loop
    execute format('drop trigger if exists archived_event_guard on public.%I', t);
    execute format(
      'create trigger archived_event_guard before insert or update or delete on public.%I
         for each row execute function public.guard_archived_event_write()',
      t
    );
  end loop;
end $$;

-- Et arkiveret arrangement kan ikke slettes (sletning ville kaskadere til alle dets data).
create or replace function public.guard_archived_event_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'archived' and current_setting('lc.allow_archived_writes', true) is distinct from 'on' then
    raise exception 'Et arkiveret arrangement kan ikke slettes.';
  end if;
  return old;
end;
$$;

drop trigger if exists archived_event_delete_guard on public.events;
create trigger archived_event_delete_guard
  before delete on public.events
  for each row execute function public.guard_archived_event_delete();

update public.events set status = 'archived' where id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

commit;

-- Oversigt efter kørsel: 2026 skal stå som archived og have 23 beskyttede tabeller.
select e.name, e.status,
  (select count(*) from pg_trigger where tgname = 'archived_event_guard') as beskyttede_tabeller
from public.events e
order by e.starts_on;
