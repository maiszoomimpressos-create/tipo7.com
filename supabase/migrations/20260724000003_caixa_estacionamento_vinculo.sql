-- Permite vincular um caixa a um estacionamento específico do evento —
-- útil quando há mais de um local de estacionamento (cada um com seu
-- próprio caixa/operador), pra saber de relance qual caixa é de qual local.
-- Nulo = caixa genérico do evento (bilheteria, ou estacionamento único).
ALTER TABLE public.caixas
  ADD COLUMN IF NOT EXISTS estacionamento_id UUID REFERENCES public.estacionamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_caixas_estacionamento_id ON public.caixas(estacionamento_id);
