-- Chave pro dono ligar/desligar a pausa automática de venda online (20/08/2026).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pausa_venda_automatica boolean NOT NULL DEFAULT true;
