-- Nicho declarado no cadastro (usado pra decidir os módulos padrão e o vocabulário do painel)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS nicho TEXT CHECK (nicho IN ('eventos','estacionamento','ambos'));
