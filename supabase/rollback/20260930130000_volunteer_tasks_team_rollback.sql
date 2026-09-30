-- Fjerner koblingen mellem opgaver og teams. Opgaver og tildelinger bevares.
begin;

drop trigger if exists volunteer_tasks_check_team on public.volunteer_tasks;
drop function if exists public.volunteer_tasks_check_team();
alter table public.volunteer_tasks drop column if exists team_id;

create or replace function public.volunteer_task_assignments_check_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.volunteer_tasks t where t.id = new.task_id and t.event_id = new.event_id)
     or not exists (select 1 from public.volunteers v where v.id = new.volunteer_id and v.event_id = new.event_id) then
    raise exception 'Opgaven og den frivillige hører til forskellige arrangementer.';
  end if;
  return new;
end;
$$;

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

commit;
