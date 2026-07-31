-- Bucket pra logo de organização (casa de show com marca própria). Mesmo
-- padrão de path/permissão do bucket carrossel: {organization_id}/arquivo,
-- upload/delete só pra quem administra aquela organização.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-logos', 'organization-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "organization-logos_select" on storage.objects
  for select using (bucket_id = 'organization-logos');

create policy "organization-logos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'organization-logos'
    and is_org_admin((storage.foldername(name))[1]::uuid)
  );

create policy "organization-logos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'organization-logos'
    and is_org_admin((storage.foldername(name))[1]::uuid)
  );

create policy "organization-logos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'organization-logos'
    and is_org_admin((storage.foldername(name))[1]::uuid)
  );
