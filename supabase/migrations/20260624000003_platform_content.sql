-- Tabela para textos gerenciáveis da plataforma (termos, privacidade, etc.)
CREATE TABLE IF NOT EXISTS public.platform_content (
  key        TEXT PRIMARY KEY,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Linhas padrão já criadas vazias
INSERT INTO public.platform_content (key, content) VALUES
  ('termos',      ''),
  ('privacidade', '')
ON CONFLICT (key) DO NOTHING;

-- RLS: leitura pública, escrita bloqueada (feita via service role pela API admin)
ALTER TABLE public.platform_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_content_public_read"
  ON public.platform_content FOR SELECT
  USING (true);
