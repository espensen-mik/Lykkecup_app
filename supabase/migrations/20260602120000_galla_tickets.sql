-- LykkeCup Galla: billetter fra WordPress/Event Tickets CSV + hurtig QR check-in.
--
-- CSV-import (Supabase Table Editor → galla_tickets → Import CSV):
--   Map: attendee_id, security_code, unique_id, ticket_type, ticket_product_id,
--        name, email, order_id, order_status, checked_in
--   Tomme checked_in → false (eller lad feltet være tom; default er false).
--   attendee_id skal matche ticket_id fra QR-URL.

CREATE TABLE IF NOT EXISTS public.galla_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id bigint NOT NULL,
  security_code text NOT NULL,
  unique_id text,
  ticket_type text,
  ticket_product_id bigint,
  name text NOT NULL DEFAULT '',
  email text,
  order_id bigint,
  order_status text NOT NULL DEFAULT '',
  checked_in boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz,
  checked_in_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT galla_tickets_attendee_id_key UNIQUE (attendee_id)
);

CREATE INDEX IF NOT EXISTS galla_tickets_security_code_idx ON public.galla_tickets (security_code);
CREATE INDEX IF NOT EXISTS galla_tickets_checked_in_idx ON public.galla_tickets (checked_in);
CREATE INDEX IF NOT EXISTS galla_tickets_order_status_idx ON public.galla_tickets (order_status);
CREATE INDEX IF NOT EXISTS galla_tickets_name_lower_idx ON public.galla_tickets (lower(name));
CREATE INDEX IF NOT EXISTS galla_tickets_email_lower_idx ON public.galla_tickets (lower(email));
CREATE INDEX IF NOT EXISTS galla_tickets_unique_id_idx ON public.galla_tickets (unique_id);

COMMENT ON TABLE public.galla_tickets IS 'LykkeCup Galla — WordPress/Event Tickets export til QR check-in (event_id 16899).';

CREATE OR REPLACE FUNCTION public.galla_tickets_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS galla_tickets_touch_updated_at ON public.galla_tickets;
CREATE TRIGGER galla_tickets_touch_updated_at
  BEFORE UPDATE ON public.galla_tickets
  FOR EACH ROW
  EXECUTE PROCEDURE public.galla_tickets_set_updated_at();

ALTER TABLE public.galla_tickets ENABLE ROW LEVEL SECURITY;

-- Kun indloggede KontrolCenter-brugere: læsning til statistik og manuel søgning.
DROP POLICY IF EXISTS "galla_tickets_authenticated_select" ON public.galla_tickets;
CREATE POLICY "galla_tickets_authenticated_select"
  ON public.galla_tickets
  FOR SELECT
  TO authenticated
  USING (true);

-- Check-in sker kun via RPC (SECURITY DEFINER) — ingen direkte UPDATE for klienter.

CREATE OR REPLACE FUNCTION public.galla_check_in_ticket(
  p_attendee_id bigint,
  p_security_code text,
  p_event_id bigint,
  p_checked_in_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.galla_tickets%ROWTYPE;
  v_updated public.galla_tickets%ROWTYPE;
  v_code text := trim(coalesce(p_security_code, ''));
BEGIN
  IF p_event_id IS DISTINCT FROM 16899 THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'wrong_event_id'
    );
  END IF;

  IF p_attendee_id IS NULL OR v_code = '' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'parse_error'
    );
  END IF;

  SELECT * INTO v_row FROM public.galla_tickets WHERE attendee_id = p_attendee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'not_found',
      'attendee_id', p_attendee_id
    );
  END IF;

  IF v_row.security_code IS DISTINCT FROM v_code THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'wrong_security_code',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type
    );
  END IF;

  IF lower(trim(v_row.order_status)) IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Ugyldig billet',
      'reason', 'not_completed',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type
    );
  END IF;

  IF v_row.checked_in THEN
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'message', 'Allerede checket ind',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type,
      'checked_in_at', v_row.checked_in_at
    );
  END IF;

  UPDATE public.galla_tickets
  SET
    checked_in = true,
    checked_in_at = now(),
    checked_in_by = nullif(trim(coalesce(p_checked_in_by, '')), ''),
    updated_at = now()
  WHERE attendee_id = p_attendee_id
    AND checked_in = false
    AND security_code = v_code
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.galla_tickets WHERE attendee_id = p_attendee_id;
    RETURN jsonb_build_object(
      'status', 'already_checked_in',
      'message', 'Allerede checket ind',
      'attendee_id', p_attendee_id,
      'name', v_row.name,
      'ticket_type', v_row.ticket_type,
      'checked_in_at', v_row.checked_in_at
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'approved',
    'message', 'Godkendt – Deltager checket ind',
    'attendee_id', v_updated.attendee_id,
    'name', v_updated.name,
    'ticket_type', v_updated.ticket_type,
    'checked_in_at', v_updated.checked_in_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.galla_check_in_ticket(bigint, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.galla_check_in_ticket(bigint, text, bigint, text) TO authenticated;
