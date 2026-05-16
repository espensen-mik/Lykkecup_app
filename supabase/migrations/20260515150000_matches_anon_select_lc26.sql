-- LykkeCup 26: offentlig læsning af planlagte kampe (spiller-kampprogram).
-- Kun kampe med bane og starttid for arrangementet ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf.

grant select on table public.matches to anon;

drop policy if exists matches_select_anon_lc26_scheduled on public.matches;

create policy matches_select_anon_lc26_scheduled
  on public.matches
  for select
  to anon
  using (
    event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid
    and court_id is not null
    and start_time is not null
  );
