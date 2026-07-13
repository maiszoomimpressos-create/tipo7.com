-- Suporte a operadores sem cadastro no sistema
ALTER TABLE caixas
  ADD COLUMN IF NOT EXISTS nome_operador TEXT;
