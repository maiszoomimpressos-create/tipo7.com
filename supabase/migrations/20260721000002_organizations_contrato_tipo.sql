-- Tipo de contrato da organização — cobrança/gestão de mensalidade fica para depois
-- (painel do admin ainda não existe, isso só prepara o campo).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS contrato_tipo          TEXT CHECK (contrato_tipo IN ('pontual','mensal')),
  ADD COLUMN IF NOT EXISTS mensalidade_valida_ate  DATE;
