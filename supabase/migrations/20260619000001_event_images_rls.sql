-- Políticas RLS para o bucket event-images
-- Leitura pública (bucket já é público)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'event-images: leitura pública'
  ) THEN
    CREATE POLICY "event-images: leitura pública"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-images');
  END IF;
END $$;

-- Upload: usuário autenticado pode enviar para a pasta do seu evento
-- Valida que o event_id no path pertence ao usuário logado
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'event-images: upload autenticado'
  ) THEN
    CREATE POLICY "event-images: upload autenticado"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'event-images'
      AND auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE e.id::text = (string_to_array(name, '/'))[1]
        AND o.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Update: dono do evento pode substituir imagens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'event-images: update autenticado'
  ) THEN
    CREATE POLICY "event-images: update autenticado"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'event-images'
      AND auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE e.id::text = (string_to_array(name, '/'))[1]
        AND o.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Delete: dono do evento pode remover imagens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'event-images: delete autenticado'
  ) THEN
    CREATE POLICY "event-images: delete autenticado"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'event-images'
      AND auth.role() = 'authenticated'
      AND EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE e.id::text = (string_to_array(name, '/'))[1]
        AND o.owner_id = auth.uid()
      )
    );
  END IF;
END $$;
