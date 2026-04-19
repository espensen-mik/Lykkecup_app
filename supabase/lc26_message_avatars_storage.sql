-- Kør EFTER bucket `lc26_message_avatars` er oprettet (public read anbefales til avatars i webappen).

INSERT INTO storage.buckets (id, name, public)
VALUES ('lc26_message_avatars', 'lc26_message_avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "lc26_msg_avatars_public_read" ON storage.objects;
CREATE POLICY "lc26_msg_avatars_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'lc26_message_avatars');

DROP POLICY IF EXISTS "lc26_msg_avatars_auth_upload" ON storage.objects;
CREATE POLICY "lc26_msg_avatars_auth_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lc26_message_avatars');

DROP POLICY IF EXISTS "lc26_msg_avatars_auth_update" ON storage.objects;
CREATE POLICY "lc26_msg_avatars_auth_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lc26_message_avatars')
  WITH CHECK (bucket_id = 'lc26_message_avatars');

DROP POLICY IF EXISTS "lc26_msg_avatars_auth_delete" ON storage.objects;
CREATE POLICY "lc26_msg_avatars_auth_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'lc26_message_avatars');
