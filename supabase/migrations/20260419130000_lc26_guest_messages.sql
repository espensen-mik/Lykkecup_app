-- LykkeCup 26: gæstebog / hilsner fra deltagere (offentlig indsendelse, kun KontrolCenter læser).

CREATE TABLE IF NOT EXISTS public.lc26_guest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  display_name text NOT NULL,
  role_hint text NOT NULL DEFAULT '',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lc26_guest_messages_display_name_len CHECK (char_length(display_name) <= 200),
  CONSTRAINT lc26_guest_messages_role_hint_len CHECK (char_length(role_hint) <= 200),
  CONSTRAINT lc26_guest_messages_body_len CHECK (char_length(body) <= 8000 AND char_length(body) >= 1)
);

CREATE INDEX IF NOT EXISTS lc26_guest_messages_event_created
  ON public.lc26_guest_messages (event_id, created_at DESC);

COMMENT ON TABLE public.lc26_guest_messages IS 'Hilsner fra deltagere til LykkeLiga (KontrolCenter /beskeder).';

ALTER TABLE public.lc26_guest_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lc26_guest_messages_anon_insert_event" ON public.lc26_guest_messages;
CREATE POLICY "lc26_guest_messages_anon_insert_event"
  ON public.lc26_guest_messages
  FOR INSERT
  TO anon
  WITH CHECK (event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid);

DROP POLICY IF EXISTS "lc26_guest_messages_authenticated_select" ON public.lc26_guest_messages;
CREATE POLICY "lc26_guest_messages_authenticated_select"
  ON public.lc26_guest_messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lc26_guest_messages_authenticated_delete" ON public.lc26_guest_messages;
CREATE POLICY "lc26_guest_messages_authenticated_delete"
  ON public.lc26_guest_messages
  FOR DELETE
  TO authenticated
  USING (true);
