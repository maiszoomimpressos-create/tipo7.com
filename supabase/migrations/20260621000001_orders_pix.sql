-- Colunas para armazenar dados do pagamento PIX (QR code gerado pelo MP)
alter table public.orders
  add column if not exists pix_qr_code        text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists pix_expires_at     timestamptz;
