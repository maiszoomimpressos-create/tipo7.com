-- =============================================================
-- MIGRATION: processed_webhooks
-- Tabela de idempotência para webhooks do Mercado Pago.
-- Garante que um webhook processado duas vezes não gere
-- ingressos duplicados nem atualize o pedido duas vezes.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id   TEXT        NOT NULL UNIQUE,
  order_id     TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Somente o service role pode acessar esta tabela
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_service_only" ON public.processed_webhooks USING (false);

-- Índice para lookup rápido por payment_id
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_payment ON public.processed_webhooks(payment_id);
