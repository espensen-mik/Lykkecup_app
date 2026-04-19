-- Retter typiske årsager til at ingen rækker lander trods RLS-politikker:
-- 1) Manglende INSERT-rettigheder for API-rollerne anon / authenticated
-- 2) PostgREST har ikke genindlæst skema efter manuel tabel-oprettelse

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.lc_analytics_page_views TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
