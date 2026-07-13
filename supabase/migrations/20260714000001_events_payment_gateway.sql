-- Adiciona coluna payment_gateway na tabela events.
-- Define qual gateway de pagamento será usado para o evento.
-- 'mercadopago' é o padrão para manter compatibilidade com todos os eventos existentes.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT NOT NULL DEFAULT 'mercadopago'
  CHECK (payment_gateway IN ('mercadopago', 'pagbank'));
