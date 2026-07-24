-- =============================================================
-- Fechamento de caixa em duas etapas (bilheteria E estacionamento —
-- decisão do usuário 24/07/2026: "onde existir caixa, essa regra sempre
-- tem que ter"):
--   1. Operador conta o dinheiro → caixa fica 'fechamento_pendente'
--   2. Dono do evento valida a contagem → caixa vira 'fechado'
-- Ninguém fecha o próprio caixa sozinho de forma definitiva — o dono
-- sempre confirma antes, porque é ele quem recebe o dinheiro físico.
-- =============================================================

ALTER TABLE public.caixas DROP CONSTRAINT IF EXISTS caixas_status_check;
ALTER TABLE public.caixas ADD CONSTRAINT caixas_status_check
  CHECK (status = ANY (ARRAY['aberto'::text, 'fechamento_pendente'::text, 'fechado'::text]));

ALTER TABLE public.caixa_fechamento
  ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validado_em  TIMESTAMPTZ;
