-- Kampe der bruger flere på hinanden følgende runder (fx ROCK: to halvlege à 9 min = 2 runder).

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'level_schedule_settings'
      and c.relkind = 'r'
  ) then
    alter table public.level_schedule_settings
      add column if not exists rounds_per_match integer not null default 1;

    alter table public.level_schedule_settings
      drop constraint if exists level_schedule_settings_rounds_per_match_check;

    alter table public.level_schedule_settings
      add constraint level_schedule_settings_rounds_per_match_check
      check (rounds_per_match >= 1 and rounds_per_match <= 4);
  end if;
end $$;
