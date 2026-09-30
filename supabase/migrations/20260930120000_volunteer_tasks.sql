-- Opgaver til frivillige (fx "Guldskranke – Formiddag, 8.00–12.00") og hvem der er sat på dem.
-- En frivillig kan have flere opgaver. Kun KontrolCenter-brugere har adgang.
-- Tilbagerulning: supabase/rollback/20260930120000_volunteer_tasks_rollback.sql

begin;

create table public.volunteer_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  period_label text check (period_label is null or char_length(period_label) <= 60),
  starts_at time not null,
  ends_at time not null,
  capacity integer check (capacity is null or capacity between 1 and 500),
  description text check (description is null or char_length(description) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.volunteer_task_assignments (
  task_id uuid not null references public.volunteer_tasks(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, volunteer_id)
);

create index volunteer_tasks_event_idx on public.volunteer_tasks (event_id, starts_at, name);
create index volunteer_task_assignments_volunteer_idx on public.volunteer_task_assignments (volunteer_id);
create index volunteer_task_assignments_event_idx on public.volunteer_task_assignments (event_id);

-- Opgave, frivillig og tildeling skal høre til samme arrangement.
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

create trigger volunteer_task_assignments_check_event
  before insert or update on public.volunteer_task_assignments
  for each row execute function public.volunteer_task_assignments_check_event();

create trigger volunteer_tasks_set_updated_at
  before update on public.volunteer_tasks
  for each row execute function public.set_updated_at();

create trigger archived_event_guard
  before insert or update or delete on public.volunteer_tasks
  for each row execute function public.guard_archived_event_write();

create trigger archived_event_guard
  before insert or update or delete on public.volunteer_task_assignments
  for each row execute function public.guard_archived_event_write();

alter table public.volunteer_tasks enable row level security;
alter table public.volunteer_task_assignments enable row level security;

revoke all on public.volunteer_tasks from anon, public;
revoke all on public.volunteer_task_assignments from anon, public;
grant select, insert, update, delete on public.volunteer_tasks to authenticated;
grant select, insert, update, delete on public.volunteer_task_assignments to authenticated;

create policy volunteer_tasks_all_authenticated on public.volunteer_tasks
  for all to authenticated using (true) with check (true);
create policy volunteer_task_assignments_all_authenticated on public.volunteer_task_assignments
  for all to authenticated using (true) with check (true);

commit;

select
  (select count(*) from pg_tables where schemaname = 'public'
     and tablename in ('volunteer_tasks', 'volunteer_task_assignments')) as nye_tabeller,
  (select count(*) from pg_trigger where tgname = 'archived_event_guard') as beskyttede_tabeller;
