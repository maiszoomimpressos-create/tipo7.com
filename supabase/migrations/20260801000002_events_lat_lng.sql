-- Coordenadas geográficas do evento (geocodificadas a partir do CEP/endereço
-- ou herdadas do venue selecionado) — usadas pro carrossel de destaque
-- mostrar os eventos mais próximos do usuário por distância real, em vez
-- de só filtrar por estado (UF).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
