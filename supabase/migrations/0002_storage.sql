-- Evara Studios — storage buckets and policies. Idempotent: safe to re-run.
-- Buckets are public-read on purpose (storefront photography). Uploads,
-- replacements and deletions are restricted to administrators, and each
-- bucket enforces a file size limit and an image-only MIME allow-list.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('homepage-images', 'homepage-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('founder-images', 'founder-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('collection-images', 'collection-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "evara: admin read objects" on storage.objects;
drop policy if exists "evara: admin upload objects" on storage.objects;
drop policy if exists "evara: admin update objects" on storage.objects;
drop policy if exists "evara: admin delete objects" on storage.objects;

-- Public buckets serve files by URL without a policy; this select policy only
-- lets administrators list and manage objects through the API.
create policy "evara: admin read objects" on storage.objects
  for select to authenticated
  using (bucket_id in ('product-images', 'homepage-images', 'founder-images', 'collection-images')
         and (select public.is_admin()));

create policy "evara: admin upload objects" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'homepage-images', 'founder-images', 'collection-images')
              and (select public.is_admin()));

create policy "evara: admin update objects" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'homepage-images', 'founder-images', 'collection-images')
         and (select public.is_admin()))
  with check (bucket_id in ('product-images', 'homepage-images', 'founder-images', 'collection-images')
              and (select public.is_admin()));

create policy "evara: admin delete objects" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'homepage-images', 'founder-images', 'collection-images')
         and (select public.is_admin()));
