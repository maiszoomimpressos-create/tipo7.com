-- Adiciona template "Caixa" com permissão de vender ingresso
DO $$
DECLARE
  novo_id UUID;
  max_order INT;
BEGIN
  SELECT COALESCE(MAX(sort_order), 0) INTO max_order FROM staff_function_templates;

  INSERT INTO staff_function_templates (name, sort_order)
  VALUES ('Caixa', max_order + 1)
  RETURNING id INTO novo_id;

  INSERT INTO staff_function_template_permissions (template_id, permission)
  VALUES (novo_id, 'vender_ingresso');
END $$;
