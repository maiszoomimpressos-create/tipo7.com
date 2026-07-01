-- Migration: adiciona colunas de endereço e configura storage de avatars
-- Data: 2026-06-17
-- Descrição: Permite que o usuário salve endereço completo e foto de perfil

-- ─── 1. Colunas de endereço na tabela profiles ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS zip_code      TEXT,                                        -- CEP (somente dígitos)
  ADD COLUMN IF NOT EXISTS street        TEXT,                                        -- Logradouro / rua
  ADD COLUMN IF NOT EXISTS street_number TEXT,                                        -- Número
  ADD COLUMN IF NOT EXISTS neighborhood  TEXT,                                        -- Bairro
  ADD COLUMN IF NOT EXISTS city          TEXT,                                        -- Cidade
  ADD COLUMN IF NOT EXISTS state         CHAR(2),                                     -- UF (ex: SP, RJ)
  ADD COLUMN IF NOT EXISTS address_type  TEXT CHECK (address_type IN ('casa', 'apartamento')),  -- Tipo de residência
  ADD COLUMN IF NOT EXISTS complement    TEXT;                                        -- Complemento (apto, bloco etc.)

-- ─── 2. Bucket público de avatars ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Políticas RLS do storage ─────────────────────────────────────────────

-- Usuário logado pode fazer upload somente na pasta com seu próprio ID
CREATE POLICY "avatar upload proprio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Qualquer pessoa pode ver os avatares (bucket público)
CREATE POLICY "avatar leitura publica" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Usuário logado pode atualizar o próprio avatar
CREATE POLICY "avatar update proprio" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
