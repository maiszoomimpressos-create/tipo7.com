-- Banners promocionais do sistema — imagens de divulgação da própria
-- plataforma (não de um evento específico), exibidas junto no carrossel
-- de destaques da home.
CREATE TABLE IF NOT EXISTS system_banners (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
