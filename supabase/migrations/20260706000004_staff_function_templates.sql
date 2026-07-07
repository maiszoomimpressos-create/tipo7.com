-- =============================================================
-- Funções globais de equipe — definidas pelo admin da plataforma
-- Servem como templates para os promotores usarem nos eventos
-- =============================================================

CREATE TABLE IF NOT EXISTS public.staff_function_templates (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  active     BOOLEAN     DEFAULT true NOT NULL,
  sort_order INT         DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.staff_function_template_permissions (
  id          UUID             DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID             NOT NULL REFERENCES public.staff_function_templates(id) ON DELETE CASCADE,
  permission  event_permission NOT NULL,
  UNIQUE (template_id, permission)
);

-- RLS: leitura pública (qualquer usuário autenticado pode ver os templates)
ALTER TABLE public.staff_function_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_function_template_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_leitura_publica"
  ON public.staff_function_templates FOR SELECT USING (true);

CREATE POLICY "template_perms_leitura_publica"
  ON public.staff_function_template_permissions FOR SELECT USING (true);

-- Escrita: só via service role (painel admin usa API server-side)

-- Templates padrão
INSERT INTO public.staff_function_templates (name, sort_order) VALUES
  ('Segurança',    1),
  ('Coordenador',  2),
  ('Bilheteria',   3),
  ('Scanner',      4),
  ('Promoter',     5),
  ('Garçom',       6);

-- Permissões padrão de cada template
DO $$
DECLARE
  id_seguranca   UUID;
  id_coordenador UUID;
  id_bilheteria  UUID;
  id_scanner     UUID;
BEGIN
  SELECT id INTO id_seguranca   FROM staff_function_templates WHERE name = 'Segurança'   LIMIT 1;
  SELECT id INTO id_coordenador FROM staff_function_templates WHERE name = 'Coordenador' LIMIT 1;
  SELECT id INTO id_bilheteria  FROM staff_function_templates WHERE name = 'Bilheteria'  LIMIT 1;
  SELECT id INTO id_scanner     FROM staff_function_templates WHERE name = 'Scanner'     LIMIT 1;

  INSERT INTO staff_function_template_permissions (template_id, permission) VALUES
    (id_seguranca,   'validar_ingresso'),
    (id_seguranca,   'gerenciar_checkin'),
    (id_coordenador, 'ver_lista_convidados'),
    (id_coordenador, 'ver_relatorios'),
    (id_coordenador, 'gerenciar_checkin'),
    (id_bilheteria,  'vender_ingresso'),
    (id_bilheteria,  'ver_lista_convidados'),
    (id_scanner,     'validar_ingresso');
END $$;
