-- Fjerner opgaver til frivillige. Alle opgaver og tildelinger slettes.
begin;

drop table if exists public.volunteer_task_assignments;
drop table if exists public.volunteer_tasks;
drop function if exists public.volunteer_task_assignments_check_event();

commit;
