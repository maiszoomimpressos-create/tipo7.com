-- Segunda metade da divisão de "gerenciar_estacionamento" — precisa de
-- migration própria pelo mesmo motivo da anterior.
ALTER TYPE public.event_permission ADD VALUE IF NOT EXISTS 'estacionamento_saida';
