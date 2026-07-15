-- Adiciona campo JSON para armazenar dados extras por atributo do evento
-- Usado para estacionamento pago: { parking_type, spots, price_per_spot }
ALTER TABLE event_attribute_values ADD COLUMN IF NOT EXISTS value_json JSONB;
