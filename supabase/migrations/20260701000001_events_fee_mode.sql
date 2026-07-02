-- Adiciona modo de cobrança da taxa ao evento
-- 'promotor'  → taxa descontada do repasse ao promotor (comprador paga o preço de face)
-- 'comprador' → taxa adicionada ao preço para o comprador (promotor recebe o valor de face)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS fee_mode TEXT DEFAULT 'promotor'
    CHECK (fee_mode IN ('promotor', 'comprador'));
