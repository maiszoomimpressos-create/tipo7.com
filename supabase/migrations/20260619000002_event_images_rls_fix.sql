-- Substitui as políticas complexas por versões simples
-- A segurança de dono do evento já é garantida pelo servidor (server component)

-- Remove políticas anteriores que possam estar bloqueando
DROP POLICY IF EXISTS "event-images upload"                   ON storage.objects;
DROP POLICY IF EXISTS "event-images: upload autenticado"      ON storage.objects;
DROP POLICY IF EXISTS "event-images delete"                   ON storage.objects;
DROP POLICY IF EXISTS "event-images: delete autenticado"      ON storage.objects;
DROP POLICY IF EXISTS "event-images read"                     ON storage.objects;
DROP POLICY IF EXISTS "event-images: leitura pública"         ON storage.objects;
DROP POLICY IF EXISTS "event-images: update autenticado"      ON storage.objects;

-- Leitura pública (bucket público)
CREATE POLICY "event-images: select"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Upload: qualquer usuário autenticado
CREATE POLICY "event-images: insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
);

-- Atualizar (re-upload do mesmo arquivo)
CREATE POLICY "event-images: update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
);

-- Deletar
CREATE POLICY "event-images: delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images'
  AND auth.role() = 'authenticated'
);
