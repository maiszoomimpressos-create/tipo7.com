-- URL da imagem do QR PIX gerada pelo PagBank (qr_codes[0].links, rel
-- QRCODE.PNG) — a resposta do PagBank não traz o QR em base64 como o
-- Mercado Pago, só o link pra imagem já pronta.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pagbank_pix_qr_code_image_url TEXT;
