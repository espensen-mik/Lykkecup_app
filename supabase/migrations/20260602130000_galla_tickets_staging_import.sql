-- Hjælpetabel til CSV-import: alle kolonner som text (undgår boolean ""-fejl).
-- Workflow: import CSV → galla_tickets_staging → kør galla_import_staging_to_tickets().

CREATE TABLE IF NOT EXISTS public.galla_tickets_staging (
  attendee_id text,
  security_code text,
  unique_id text,
  ticket_type text,
  ticket_product_id text,
  name text,
  email text,
  order_id text,
  order_status text,
  checked_in text
);

COMMENT ON TABLE public.galla_tickets_staging IS 'Midlertidig CSV-import (alle felter text). Tøm efter galla_import_staging_to_tickets().';

ALTER TABLE public.galla_tickets_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "galla_tickets_staging_authenticated_all" ON public.galla_tickets_staging;
CREATE POLICY "galla_tickets_staging_authenticated_all"
  ON public.galla_tickets_staging
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.galla_parse_checked_in_text(raw text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL OR btrim(raw) = '' THEN false
    WHEN lower(btrim(raw)) IN ('1', 'true', 't', 'yes', 'y', 'ja') THEN true
    WHEN lower(btrim(raw)) IN ('0', 'false', 'f', 'no', 'n', 'nej') THEN false
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.galla_import_staging_to_tickets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted bigint;
  v_skipped bigint;
BEGIN
  INSERT INTO public.galla_tickets (
    attendee_id,
    security_code,
    unique_id,
    ticket_type,
    ticket_product_id,
    name,
    email,
    order_id,
    order_status,
    checked_in,
    checked_in_at
  )
  SELECT
    s.attendee_id::bigint,
    btrim(s.security_code),
    nullif(btrim(s.unique_id), ''),
    nullif(btrim(s.ticket_type), ''),
    nullif(btrim(s.ticket_product_id), '')::bigint,
    coalesce(nullif(btrim(s.name), ''), ''),
    nullif(btrim(s.email), ''),
    nullif(btrim(s.order_id), '')::bigint,
    coalesce(nullif(btrim(s.order_status), ''), ''),
    public.galla_parse_checked_in_text(s.checked_in),
    CASE
      WHEN public.galla_parse_checked_in_text(s.checked_in) THEN now()
      ELSE NULL
    END
  FROM public.galla_tickets_staging s
  WHERE btrim(coalesce(s.attendee_id, '')) ~ '^[0-9]+$'
    AND btrim(coalesce(s.security_code, '')) <> ''
  ON CONFLICT (attendee_id) DO UPDATE SET
    security_code = EXCLUDED.security_code,
    unique_id = EXCLUDED.unique_id,
    ticket_type = EXCLUDED.ticket_type,
    ticket_product_id = EXCLUDED.ticket_product_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    order_id = EXCLUDED.order_id,
    order_status = EXCLUDED.order_status,
    checked_in = EXCLUDED.checked_in,
    checked_in_at = EXCLUDED.checked_in_at,
    updated_at = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*)::bigint INTO v_skipped
  FROM public.galla_tickets_staging s
  WHERE btrim(coalesce(s.attendee_id, '')) !~ '^[0-9]+$'
     OR btrim(coalesce(s.security_code, '')) = '';

  TRUNCATE public.galla_tickets_staging;

  RETURN jsonb_build_object(
    'inserted_or_updated', v_inserted,
    'skipped_invalid_rows', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.galla_import_staging_to_tickets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.galla_import_staging_to_tickets() TO authenticated;
