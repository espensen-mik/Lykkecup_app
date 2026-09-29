-- Ophæver det skrivebeskyttede arkiv. Data røres ikke.

begin;

do $$
declare
  t text;
begin
  for t in select c.relname from pg_trigger g join pg_class c on c.oid = g.tgrelid where g.tgname = 'archived_event_guard' loop
    execute format('drop trigger if exists archived_event_guard on public.%I', t);
  end loop;
end $$;

drop trigger if exists archived_event_delete_guard on public.events;
drop function if exists public.guard_archived_event_delete();
drop function if exists public.guard_archived_event_write();
drop function if exists public.event_is_archived(uuid);

update public.events set status = 'active' where id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf';

commit;
