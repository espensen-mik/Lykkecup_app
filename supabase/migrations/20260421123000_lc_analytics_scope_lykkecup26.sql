-- Begræns analyse-funktioner til kun LykkeCup26-app-stier.
-- Inkluderer /lykkecup26 og undersider /lykkecup26/*

CREATE OR REPLACE FUNCTION public.get_lc_analytics_summary()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'uniqueVisitors', (
      SELECT COUNT(DISTINCT visitor_id)::bigint
      FROM public.lc_analytics_page_views
      WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
    ),
    'totalViews', (
      SELECT COUNT(*)::bigint
      FROM public.lc_analytics_page_views
      WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
    ),
    'paths', COALESCE(
      (
        SELECT json_agg(json_build_object('path', q.path, 'views', q.views))
        FROM (
          SELECT path, COUNT(*)::bigint AS views
          FROM public.lc_analytics_page_views
          WHERE path = '/lykkecup26' OR path LIKE '/lykkecup26/%'
          GROUP BY path
          ORDER BY COUNT(*) DESC
          LIMIT 100
        ) q
      ),
      '[]'::json
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_lc_analytics_hourly_views(
  p_day date DEFAULT (timezone('Europe/Copenhagen', now()))::date
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      (p_day::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_start,
      ((p_day + 1)::timestamp AT TIME ZONE 'Europe/Copenhagen') AS t_end
  ),
  hours AS (SELECT generate_series(0, 23) AS hr),
  counts AS (
    SELECT
      EXTRACT(HOUR FROM (v.created_at AT TIME ZONE 'Europe/Copenhagen'))::integer AS hr,
      COUNT(*)::bigint AS views
    FROM public.lc_analytics_page_views v
    CROSS JOIN bounds b
    WHERE v.created_at >= b.t_start
      AND v.created_at < b.t_end
      AND (v.path = '/lykkecup26' OR v.path LIKE '/lykkecup26/%')
    GROUP BY 1
  )
  SELECT COALESCE(
    (
      SELECT json_agg(json_build_object('hour', h.hr, 'views', COALESCE(c.views, 0)) ORDER BY h.hr)
      FROM hours h
      LEFT JOIN counts c ON c.hr = h.hr
    ),
    '[]'::json
  );
$$;
