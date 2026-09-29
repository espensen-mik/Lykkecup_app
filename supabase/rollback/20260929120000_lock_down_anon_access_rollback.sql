-- Nødrulning af 20260929120000_lock_down_anon_access.sql.
-- Genskaber den åbne tilstand fra før migrationen. Kør kun, hvis den offentlige
-- app eller KontrolCenter holder op med at virke, og kun indtil fejlen er fundet.

begin;

drop policy if exists players_select_anon on public.players;
drop policy if exists players_all_authenticated on public.players;
drop policy if exists coaches_select_anon on public.coaches;
drop policy if exists coaches_all_authenticated on public.coaches;
drop policy if exists teams_select_anon on public.teams;
drop policy if exists teams_all_authenticated on public.teams;
drop policy if exists team_members_select_anon on public.team_members;
drop policy if exists team_members_all_authenticated on public.team_members;
drop policy if exists team_coaches_select_anon on public.team_coaches;
drop policy if exists team_coaches_all_authenticated on public.team_coaches;
drop policy if exists club_feedback_select_anon on public.club_feedback;
drop policy if exists club_feedback_all_authenticated on public.club_feedback;
drop policy if exists events_select_anon on public.events;
drop policy if exists events_all_authenticated on public.events;
drop policy if exists level_schedule_settings_all_authenticated on public.level_schedule_settings;
drop policy if exists clubs_all_authenticated on public.clubs;

alter table public.players disable row level security;
alter table public.coaches disable row level security;
alter table public.teams disable row level security;
alter table public.team_members disable row level security;
alter table public.team_coaches disable row level security;
alter table public.club_feedback disable row level security;
alter table public.events disable row level security;
alter table public.venues disable row level security;
alter table public.level_schedule_settings disable row level security;
alter table public.clubs disable row level security;

grant all on table public.players to anon;
grant all on table public.coaches to anon;
grant all on table public.teams to anon;
grant all on table public.team_members to anon;
grant all on table public.team_coaches to anon;
grant select, references, trigger, truncate on table public.club_feedback to anon;
grant all on table public.events to anon;
grant all on table public.venues to anon;
grant all on table public.level_schedule_settings to anon;
grant all on table public.clubs to anon;

grant execute on function public.galla_import_staging_to_tickets() to public, anon;
grant execute on function public.get_lc_analytics_summary() to public, anon;
grant execute on function public.get_lc_analytics_hourly_views(date) to public, anon;

commit;
