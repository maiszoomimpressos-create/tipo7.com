-- Atributos predefinidos pela equipe Tipo7
CREATE TABLE event_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Tag',
  active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de atributos"
  ON event_attributes FOR SELECT USING (true);

CREATE POLICY "Admin gerencia atributos"
  ON event_attributes FOR ALL
  USING (EXISTS (SELECT 1 FROM platform_team WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM platform_team WHERE user_id = auth.uid()));

-- Atributos ativados por evento (pelo promotor)
CREATE TABLE event_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES event_attributes(id) ON DELETE CASCADE,
  UNIQUE(event_id, attribute_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de atributos do evento"
  ON event_attribute_values FOR SELECT USING (true);

CREATE POLICY "Dono gerencia atributos do evento"
  ON event_attribute_values FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organizations o ON o.id = e.organization_id
      WHERE e.id = event_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organizations o ON o.id = e.organization_id
      WHERE e.id = event_id AND o.owner_id = auth.uid()
    )
  );

-- Atributos iniciais
INSERT INTO event_attributes (name, icon, order_index) VALUES
  ('Segurança no local',    'Shield',          1),
  ('Estacionamento',        'Car',             2),
  ('Praça de alimentação',  'UtensilsCrossed', 3),
  ('Bar / Bebidas',         'Beer',            4),
  ('Acessibilidade',        'Accessibility',   5),
  ('Wi-Fi gratuito',        'Wifi',            6),
  ('Área infantil',         'Baby',            7),
  ('Posto médico',          'HeartPulse',      8),
  ('Área para fumantes',    'Cigarette',       9),
  ('Fotos permitidas',      'Camera',         10);
