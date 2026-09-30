-- Fjerner frivillig-funktionen. ADVARSEL: sletter alle frivillige og teams.

begin;

drop function if exists public.submit_volunteer_signup(
  uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, text, boolean
);
drop table if exists public.volunteers cascade;
drop table if exists public.volunteer_teams cascade;
drop function if exists public.volunteers_check_team();
drop function if exists public.volunteer_teams_check_leader();

commit;
