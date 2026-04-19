-- LykkeCup 26: offentlige «beskeder» til appen /lykkecup26 (indbakke + toast).
-- Kør i Supabase SQL Editor (eller via migration), derefter opret Storage-bucket som beskrevet nederst.

CREATE TABLE IF NOT EXISTS public.lc26_public_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sender_name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  avatar_url text,
  available_at timestamptz NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc26_public_messages_event_available
  ON public.lc26_public_messages (event_id, available_at, sort_order);

COMMENT ON TABLE public.lc26_public_messages IS 'Planlagte beskeder til LykkeCup 26-webappen (offentlig læsning når available_at er passeret).';

CREATE OR REPLACE FUNCTION public.lc26_public_messages_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lc26_public_messages_touch_updated_at ON public.lc26_public_messages;
CREATE TRIGGER lc26_public_messages_touch_updated_at
  BEFORE UPDATE ON public.lc26_public_messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.lc26_public_messages_set_updated_at();

ALTER TABLE public.lc26_public_messages ENABLE ROW LEVEL SECURITY;

-- Offentlig app (anon): må læse alle planlagte beskeder for LykkeCup 26 (låsning styres i UI ud fra available_at)
DROP POLICY IF EXISTS "lc26_public_messages_anon_select_released" ON public.lc26_public_messages;
DROP POLICY IF EXISTS "lc26_public_messages_anon_select_event" ON public.lc26_public_messages;
CREATE POLICY "lc26_public_messages_anon_select_event"
  ON public.lc26_public_messages
  FOR SELECT
  TO anon
  USING (event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid);

-- Indloggede KontrolCenter-brugere: fuldt overblik og redigering
DROP POLICY IF EXISTS "lc26_public_messages_authenticated_select" ON public.lc26_public_messages;
CREATE POLICY "lc26_public_messages_authenticated_select"
  ON public.lc26_public_messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lc26_public_messages_authenticated_insert" ON public.lc26_public_messages;
CREATE POLICY "lc26_public_messages_authenticated_insert"
  ON public.lc26_public_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "lc26_public_messages_authenticated_update" ON public.lc26_public_messages;
CREATE POLICY "lc26_public_messages_authenticated_update"
  ON public.lc26_public_messages
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "lc26_public_messages_authenticated_delete" ON public.lc26_public_messages;
CREATE POLICY "lc26_public_messages_authenticated_delete"
  ON public.lc26_public_messages
  FOR DELETE
  TO authenticated
  USING (true);

-- Storage: opret bucket `lc26_message_avatars` i Dashboard, kør derefter supabase/lc26_message_avatars_storage.sql
