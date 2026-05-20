-- Puljestørrelse pr. niveau (Opsætning → Kampe): mål og valgfri maks hold pr. pulje.
alter table public.level_schedule_settings
  add column if not exists plan_target_teams_per_pool integer,
  add column if not exists plan_max_teams_per_pool integer;

comment on column public.level_schedule_settings.plan_target_teams_per_pool is
  'Mål antal hold pr. pulje (AutoPulje og anbefaling). Null = kampe/hold + 1.';
comment on column public.level_schedule_settings.plan_max_teams_per_pool is
  'Valgfri hård grænse hold pr. pulje. Null = kun systemloft (64).';

alter table public.level_schedule_settings
  add constraint level_schedule_settings_plan_target_teams_per_pool_check
    check (plan_target_teams_per_pool is null or (plan_target_teams_per_pool >= 2 and plan_target_teams_per_pool <= 99)),
  add constraint level_schedule_settings_plan_max_teams_per_pool_check
    check (plan_max_teams_per_pool is null or (plan_max_teams_per_pool >= 2 and plan_max_teams_per_pool <= 99));
