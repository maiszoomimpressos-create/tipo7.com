-- Módulos de venda ativos no evento (independente de "atributos" informativos,
-- que só exibem selo na página pública — event_attributes/event_attribute_values).
-- Ingressos é o comportamento histórico, por isso nasce ligado por padrão.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS modulo_ingressos      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modulo_estacionamento BOOLEAN NOT NULL DEFAULT false;
