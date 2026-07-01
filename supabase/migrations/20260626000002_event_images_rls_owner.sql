-- Correção CRIT-02: Storage RLS do bucket event-images
-- Substitui a política permissiva (qualquer autenticado) por verificação de propriedade:
-- somente o criador do evento pode fazer upload/update/delete na pasta do evento.

DROP POLICY IF EXISTS "event-images: insert" ON storage.objects;
DROP POLICY IF EXISTS "event-images: update" ON storage.objects;
DROP POLICY IF EXISTS "event-images: delete" ON storage.objects;

CREATE POLICY "event-images: insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND auth.uid() = (
    SELECT created_by FROM public.events
    WHERE id = split_part(name, '/', 1)::UUID
  )
);

CREATE POLICY "event-images: update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND auth.uid() = (
    SELECT created_by FROM public.events
    WHERE id = split_part(name, '/', 1)::UUID
  )
);

CREATE POLICY "event-images: delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
  AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND auth.uid() = (
    SELECT created_by FROM public.events
    WHERE id = split_part(name, '/', 1)::UUID
  )
);
