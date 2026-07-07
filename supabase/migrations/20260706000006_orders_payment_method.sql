-- Adiciona método de pagamento ao pedido (presencial = dinheiro/pix/cartao)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('dinheiro', 'pix', 'cartao', 'cortesia', 'online'));
