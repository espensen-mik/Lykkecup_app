-- Fjerner LykkeCup 2027 og de nye kolonner igen. Rører ikke 2026-data.
-- ADVARSEL: Alt, der er oprettet under 2027 (også spillere og hold), slettes.

begin;

do $$
begin
  if exists (
    select 1 from public.galla_tickets where event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3'
  ) then
    raise exception 'Der findes Galla-billetter på 2027. Tilbagerulning afbrudt.';
  end if;
end $$;

-- Tabeller uden fremmednøgle til events ryddes eksplicit; resten følger med via ON DELETE CASCADE.
delete from public.kontrolcenter_event_settings where event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3';
delete from public.tournament_periods where event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3';
delete from public.level_court_settings where event_id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3';
delete from public.events where id = 'a73a3acb-5424-4140-baf2-a6e2f00103a3';

drop index if exists public.galla_tickets_event_id_idx;
alter table public.galla_tickets drop column if exists event_id;

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  drop column if exists wp_event_id,
  drop column if exists public_path,
  drop column if exists status;

commit;
