-- Template global "Estacionamento", com a permissão recém-criada.
-- (staff_function_templates.name não tem UNIQUE, por isso o guard manual abaixo)
INSERT INTO public.staff_function_templates (name, sort_order)
SELECT 'Estacionamento', 7
WHERE NOT EXISTS (SELECT 1 FROM public.staff_function_templates WHERE name = 'Estacionamento');

DO $$
DECLARE
  id_estacionamento UUID;
BEGIN
  SELECT id INTO id_estacionamento FROM public.staff_function_templates WHERE name = 'Estacionamento' LIMIT 1;

  INSERT INTO public.staff_function_template_permissions (template_id, permission) VALUES
    (id_estacionamento, 'gerenciar_estacionamento')
  ON CONFLICT DO NOTHING;
END $$;
