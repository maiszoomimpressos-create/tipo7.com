-- Slides do carrossel exibidos na segunda tela da bilheteria
CREATE TABLE IF NOT EXISTS carrossel_slides (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  image_url       text         NOT NULL,
  storage_path    text         NOT NULL,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE carrossel_slides ENABLE ROW LEVEL SECURITY;

-- Dono da organização gerencia os próprios slides
CREATE POLICY "owner_all" ON carrossel_slides
  FOR ALL
  USING   (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()));

-- Segunda tela pode ler sem autenticação
CREATE POLICY "public_read" ON carrossel_slides
  FOR SELECT USING (true);

-- Bucket público para imagens do carrossel (max 5 MB por imagem)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'carrossel',
  'carrossel',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Qualquer usuário autenticado pode fazer upload no bucket
CREATE POLICY "carrossel_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'carrossel');

-- Leitura pública
CREATE POLICY "carrossel_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'carrossel');

-- Usuário autenticado pode deletar (a API valida a posse antes)
CREATE POLICY "carrossel_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'carrossel');
