-- Kør EFTER bucket `lc26_page_content_images` er oprettet (public read til billeder i offentlig app).

insert into storage.buckets (id, name, public)
values ('lc26_page_content_images', 'lc26_page_content_images', true)
on conflict (id) do nothing;

drop policy if exists "lc26_page_content_images_public_read" on storage.objects;
create policy "lc26_page_content_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'lc26_page_content_images');

drop policy if exists "lc26_page_content_images_auth_upload" on storage.objects;
create policy "lc26_page_content_images_auth_upload"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'lc26_page_content_images');

drop policy if exists "lc26_page_content_images_auth_update" on storage.objects;
create policy "lc26_page_content_images_auth_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'lc26_page_content_images')
  with check (bucket_id = 'lc26_page_content_images');

drop policy if exists "lc26_page_content_images_auth_delete" on storage.objects;
create policy "lc26_page_content_images_auth_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'lc26_page_content_images');
