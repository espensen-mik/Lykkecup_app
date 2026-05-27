-- Pools: add anon SELECT so the public anon client can read pool names and levels.
-- Pool names and levels contain no sensitive data.
-- This fixes silent failures in app-shell.tsx, perioder-panel.tsx, and baner-tider.ts
-- which use the anon client to read pools for navigation and capacity views.
-- Anon INSERT/UPDATE/DELETE remain blocked by the absence of write policies.

grant select on table public.pools to anon;

drop policy if exists pools_select_anon on public.pools;

create policy pools_select_anon
  on public.pools
  for select
  to anon
  using (event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid);
