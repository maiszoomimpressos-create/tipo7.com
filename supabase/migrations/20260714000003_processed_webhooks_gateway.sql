-- Adiciona colunas de gateway e status MP na tabela processed_webhooks.
-- gateway: identifica qual gateway gerou o webhook ('mercadopago' ou 'pagbank').
-- mp_status: status normalizado do Mercado Pago (mantido para idempotência MP).
ALTER TABLE processed_webhooks
  ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS mp_status TEXT;
