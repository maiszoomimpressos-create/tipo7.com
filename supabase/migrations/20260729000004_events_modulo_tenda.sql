-- Módulo Tenda: evento filho com atração paga (ou não) rodando em espaço
-- diferente do pai, em dias específicos do calendário do pai. Mesma
-- convenção de modulo_ingressos/modulo_estacionamento.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS modulo_tenda BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_venda_no_caixa_pai BOOLEAN NOT NULL DEFAULT true;
