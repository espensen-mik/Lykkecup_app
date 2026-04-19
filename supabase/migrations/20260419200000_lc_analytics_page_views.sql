-- Enkel sidevisnings-analytics (unikke besøgende + hits pr. sti).

CREATE TABLE IF NOT EXISTS public.lc_analytics_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc_analytics_visitor_len CHECK (char_length(visitor_id) <= 80),
  CONSTRAINT lc_analytics_path_len CHECK (char_length(path) <= 512)
);

CREATE INDEX IF NOT EXISTS lc_analytics_page_views_path_created
  ON public.lc_analytics_page_views (path, created_at DESC);

CREATE INDEX IF NOT EXISTS lc_analytics_page_views_visitor
  ON public.lc_analytics_page_views (visitor_id);

COMMENT ON TABLE public.lc_analytics_page_views IS 'Sidevisninger fra LykkeCup-app og KontrolCenter (anonym visitor_id i browser).';

ALTER TABLE public.lc_analytics_page_views ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON TABLE public.lc_analytics_page_views TO anon, authenticated;

-- Indsæt fra offentlig app (anon) og fra KontrolCenter (authenticated)
DROP POLICY IF EXISTS "lc_analytics_insert_anon" ON public.lc_analytics_page_views;
CREATE POLICY "lc_analytics_insert_anon"
  ON public.lc_analytics_page_views
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "lc_analytics_insert_authenticated" ON public.lc_analytics_page_views;
CREATE POLICY "lc_analytics_insert_authenticated"
  ON public.lc_analytics_page_views
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ingen direkte læsning — kun via funktion nedenfor
CREATE OR REPLACE FUNCTION public.get_lc_analytics_summary()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'uniqueVisitors', (SELECT COUNT(DISTINCT visitor_id)::bigint FROM public.lc_analytics_page_views),
    'totalViews', (SELECT COUNT(*)::bigint FROM public.lc_analytics_page_views),
    'paths', COALESCE(
      (
        SELECT json_agg(json_build_object('path', q.path, 'views', q.views))
        FROM (
          SELECT path, COUNT(*)::bigint AS views
          FROM public.lc_analytics_page_views
          GROUP BY path
          ORDER BY COUNT(*) DESC
          LIMIT 100
        ) q
      ),
      '[]'::json
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_lc_analytics_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lc_analytics_summary() TO authenticated;
