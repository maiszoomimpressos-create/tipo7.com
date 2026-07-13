-- Adiciona colunas de gateway e dados PagBank na tabela orders.
-- gateway: identifica qual gateway processou o pedido.
-- pagbank_charge_id: ID da cobrança retornado pelo PagBank.
-- pagbank_pix_qr_code: código copia-e-cola do PIX PagBank.
-- pagbank_pix_expires_at: data de expiração do QR PIX PagBank.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS pagbank_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS pagbank_pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pagbank_pix_expires_at TIMESTAMPTZ;
