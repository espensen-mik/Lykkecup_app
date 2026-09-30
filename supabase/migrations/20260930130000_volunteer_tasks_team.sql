-- Opgaver hører til et team, og kun teamets medlemmer kan sættes på teamets opgaver.
-- Kræver 20260930120000_volunteer_tasks.sql.
-- Tilbagerulning: supabase/rollback/20260930130000_volunteer_tasks_team_rollback.sql

begin;

alter table public.volunteer_tasks
  add column if not exists team_id uuid references public.volunteer_teams(id) on delete restrict;

create index if not exists volunteer_tasks_team_idx on public.volunteer_tasks (team_id, starts_at);

-- Opgavens team skal høre til samme arrangement. Skifter opgaven team, fjernes de frivillige,
-- som ikke er med i det nye team.
create or replace function public.volunteer_tasks_check_team()
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
    delete from public.volunteer_task_assignments a
    using public.volunteers v
    where a.task_id = new.id and v.id = a.volunteer_id and v.team_id is distinct from new.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists volunteer_tasks_check_team on public.volunteer_tasks;
create trigger volunteer_tasks_check_team
  before insert or update of team_id, event_id on public.volunteer_tasks
  for each row execute function public.volunteer_tasks_check_team();

-- Tildeling: samme arrangement, og den frivillige skal være med i opgavens team.
create or replace function public.volunteer_task_assignments_check_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_task_team uuid;
begin
  select t.team_id into v_task_team from public.volunteer_tasks t where t.id = new.task_id and t.event_id = new.event_id;
  if not found or not exists (select 1 from public.volunteers v where v.id = new.volunteer_id and v.event_id = new.event_id) then
    raise exception 'Opgaven og den frivillige hører til forskellige arrangementer.';
  end if;
  if v_task_team is not null and not exists (
    select 1 from public.volunteers v where v.id = new.volunteer_id and v.team_id = v_task_team
  ) then
    raise exception 'Den frivillige skal være med i opgavens team.';
  end if;
  return new;
end;
$$;

-- Skifter en frivillig team, fjernes vedkommende fra opgaver i det gamle team.
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
    delete from public.volunteer_task_assignments a
    using public.volunteer_tasks t
    where a.volunteer_id = new.id and t.id = a.task_id and t.team_id is not null
      and t.team_id is distinct from new.team_id;
  end if;
  return new;
end;
$$;

commit;

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'volunteer_tasks' and column_name = 'team_id') as team_kolonne,
  (select count(*) from public.volunteer_tasks where team_id is null) as opgaver_uden_team;
