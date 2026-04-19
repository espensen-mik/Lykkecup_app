-- Time-for-time visninger på en given kalenderdag (Europe/Copenhagen).

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
    WHERE v.created_at >= b.t_start AND v.created_at < b.t_end
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

REVOKE ALL ON FUNCTION public.get_lc_analytics_hourly_views(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lc_analytics_hourly_views(date) TO authenticated;
