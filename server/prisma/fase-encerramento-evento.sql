-- Encerramento de evento (20/08/2026) — ver project_token_pin_acesso_caixa na memória.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_forcado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS encerrado_por uuid,
  ADD COLUMN IF NOT EXISTS encerrado_pendencias_snapshot jsonb;
