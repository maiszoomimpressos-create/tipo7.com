-- Adiciona nome do local ao evento (ex: "Allianz Parque", "Espaço das Américas")
-- Permite busca futura por geolocalização a partir do nome do estabelecimento
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_name TEXT;
