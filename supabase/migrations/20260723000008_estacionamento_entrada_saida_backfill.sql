-- =============================================================
-- Migra quem tinha a permissão única "gerenciar_estacionamento" (acesso
-- total) para as duas novas permissões separadas — assim ninguém perde
-- acesso, e daqui pra frente dá pra conceder entrada e saída
-- independentemente (ex: um porteiro só registra entrada, outro só cobra
-- na saída, ou o mesmo se ambos ficam no mesmo local).
-- =============================================================

-- Cargos de evento (event_position_permissions)
INSERT INTO public.event_position_permissions (event_position_id, permission)
SELECT event_position_id, 'estacionamento_entrada'::event_permission
FROM public.event_position_permissions
WHERE permission = 'gerenciar_estacionamento'
ON CONFLICT DO NOTHING;

INSERT INTO public.event_position_permissions (event_position_id, permission)
SELECT event_position_id, 'estacionamento_saida'::event_permission
FROM public.event_position_permissions
WHERE permission = 'gerenciar_estacionamento'
ON CONFLICT DO NOTHING;

DELETE FROM public.event_position_permissions WHERE permission = 'gerenciar_estacionamento';

-- Template global "Estacionamento" (staff_function_template_permissions)
INSERT INTO public.staff_function_template_permissions (template_id, permission)
SELECT template_id, 'estacionamento_entrada'::event_permission
FROM public.staff_function_template_permissions
WHERE permission = 'gerenciar_estacionamento'
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_function_template_permissions (template_id, permission)
SELECT template_id, 'estacionamento_saida'::event_permission
FROM public.staff_function_template_permissions
WHERE permission = 'gerenciar_estacionamento'
ON CONFLICT DO NOTHING;

DELETE FROM public.staff_function_template_permissions WHERE permission = 'gerenciar_estacionamento';
