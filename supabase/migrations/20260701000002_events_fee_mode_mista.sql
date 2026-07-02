-- Adiciona opção 'mista' ao fee_mode: promotor e comprador dividem a taxa pela metade
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_fee_mode_check;
ALTER TABLE public.events ADD CONSTRAINT events_fee_mode_check
  CHECK (fee_mode IN ('promotor', 'comprador', 'mista'));
