-- Divide a permissão única "gerenciar_estacionamento" em entrada/saída —
-- precisa de migration própria porque ALTER TYPE ... ADD VALUE não pode
-- rodar na mesma transação que código que já usa o novo valor (mesmo
-- padrão de 20260706000003 e 20260721000003).
ALTER TYPE public.event_permission ADD VALUE IF NOT EXISTS 'estacionamento_entrada';
