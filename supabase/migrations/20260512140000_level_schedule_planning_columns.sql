-- Planlægningsfelter til LykkeCup Regnemaskine (nullable = app-defaults i UI).

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
      add column if not exists plan_target_players_per_team integer,
      add column if not exists plan_matches_per_team integer;
    execute format(
      'comment on column public.level_schedule_settings.plan_target_players_per_team is %L',
      'Planlægning (Regnemaskine): mål-spillere pr. hold; null = brug standard i app.'
    );
    execute format(
      'comment on column public.level_schedule_settings.plan_matches_per_team is %L',
      'Planlægning (Regnemaskine): kampe pr. hold; null = brug standard i app.'
    );
  end if;
end $$;
