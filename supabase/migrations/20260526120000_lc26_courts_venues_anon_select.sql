-- LykkeCup 26: offentlig læsning af baner og haller til spiller-kampprogram (Hvor).
-- Matcher mønsteret i 20260515150000_matches_anon_select_lc26.sql.

grant select on table public.courts to anon;
grant select on table public.venues to anon;

drop policy if exists courts_select_anon_lc26 on public.courts;
drop policy if exists venues_select_anon_lc26 on public.venues;

create policy courts_select_anon_lc26
  on public.courts
  for select
  to anon
  using (
    event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid
    or venue_id in (
      select id
      from public.venues
      where event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid
    )
  );

create policy venues_select_anon_lc26
  on public.venues
  for select
  to anon
  using (event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid);
