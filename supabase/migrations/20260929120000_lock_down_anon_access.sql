-- Lukker offentlig (anon) adgang til tabeller, der manglede RLS.
-- Før: anon havde ALL-grants og ingen RLS på players, coaches, teams, team_members,
-- team_coaches, club_feedback, events, venues, level_schedule_settings og clubs.
-- Efter: anon kan kun læse de kolonner, den offentlige app og /coach-feedback bruger.
-- Indloggede brugere (authenticated) beholder fuld adgang som i dag; offentlig
-- tilmelding er slået fra, så authenticated = inviterede brugere.

begin;

-- players: offentlig app viser navn, klub, alder og niveau
alter table public.players enable row level security;
revoke all on table public.players from anon;
grant select (id, event_id, name, home_club, age, level) on table public.players to anon;
drop policy if exists players_select_anon on public.players;
drop policy if exists players_all_authenticated on public.players;
create policy players_select_anon on public.players for select to anon using (true);
create policy players_all_authenticated on public.players for all to authenticated using (true) with check (true);

-- coaches: offentlig app viser kun navn og klub (ikke e-mail, telefon, fødselsdato)
alter table public.coaches enable row level security;
revoke all on table public.coaches from anon;
grant select (id, event_id, name, home_club) on table public.coaches to anon;
drop policy if exists coaches_select_anon on public.coaches;
drop policy if exists coaches_all_authenticated on public.coaches;
create policy coaches_select_anon on public.coaches for select to anon using (true);
create policy coaches_all_authenticated on public.coaches for all to authenticated using (true) with check (true);

-- teams, team_members, team_coaches: ingen persondata, men anon må kun læse
alter table public.teams enable row level security;
revoke all on table public.teams from anon;
grant select on table public.teams to anon;
drop policy if exists teams_select_anon on public.teams;
drop policy if exists teams_all_authenticated on public.teams;
create policy teams_select_anon on public.teams for select to anon using (true);
create policy teams_all_authenticated on public.teams for all to authenticated using (true) with check (true);

alter table public.team_members enable row level security;
revoke all on table public.team_members from anon;
grant select on table public.team_members to anon;
drop policy if exists team_members_select_anon on public.team_members;
drop policy if exists team_members_all_authenticated on public.team_members;
create policy team_members_select_anon on public.team_members for select to anon using (true);
create policy team_members_all_authenticated on public.team_members for all to authenticated using (true) with check (true);

alter table public.team_coaches enable row level security;
revoke all on table public.team_coaches from anon;
grant select on table public.team_coaches to anon;
drop policy if exists team_coaches_select_anon on public.team_coaches;
drop policy if exists team_coaches_all_authenticated on public.team_coaches;
create policy team_coaches_select_anon on public.team_coaches for select to anon using (true);
create policy team_coaches_all_authenticated on public.team_coaches for all to authenticated using (true) with check (true);

-- club_feedback: /coach-feedback læser kommentarer, men ikke telefonnummer og interne felter
alter table public.club_feedback enable row level security;
revoke all on table public.club_feedback from anon;
grant select (id, event_id, home_club, author_name, comment_text, created_at, handled_at, handled_by)
  on table public.club_feedback to anon;
drop policy if exists club_feedback_select_anon on public.club_feedback;
drop policy if exists club_feedback_all_authenticated on public.club_feedback;
create policy club_feedback_select_anon on public.club_feedback for select to anon using (true);
create policy club_feedback_all_authenticated on public.club_feedback for all to authenticated using (true) with check (true);

-- events: må gerne læses offentligt, men ikke ændres
alter table public.events enable row level security;
revoke all on table public.events from anon;
grant select on table public.events to anon;
drop policy if exists events_select_anon on public.events;
drop policy if exists events_all_authenticated on public.events;
create policy events_select_anon on public.events for select to anon using (true);
create policy events_all_authenticated on public.events for all to authenticated using (true) with check (true);

-- venues: policies findes allerede (anon select + authenticated CRUD), RLS var blot ikke slået til
alter table public.venues enable row level security;
revoke all on table public.venues from anon;
grant select on table public.venues to anon;

-- level_schedule_settings og clubs: bruges kun i KontrolCenter
alter table public.level_schedule_settings enable row level security;
revoke all on table public.level_schedule_settings from anon;
drop policy if exists level_schedule_settings_all_authenticated on public.level_schedule_settings;
create policy level_schedule_settings_all_authenticated on public.level_schedule_settings for all to authenticated using (true) with check (true);

alter table public.clubs enable row level security;
revoke all on table public.clubs from anon;
drop policy if exists clubs_all_authenticated on public.clubs;
create policy clubs_all_authenticated on public.clubs for all to authenticated using (true) with check (true);

-- Funktioner der kun bruges fra KontrolCenter / SQL editor
revoke execute on function public.galla_import_staging_to_tickets() from public, anon;
grant execute on function public.galla_import_staging_to_tickets() to authenticated, service_role;

revoke execute on function public.get_lc_analytics_summary() from public, anon;
grant execute on function public.get_lc_analytics_summary() to authenticated, service_role;

revoke execute on function public.get_lc_analytics_hourly_views(date) from public, anon;
grant execute on function public.get_lc_analytics_hourly_views(date) to authenticated, service_role;

commit;
