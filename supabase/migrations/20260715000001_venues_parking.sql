-- Adiciona campos de estacionamento ao venue
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS has_parking   BOOLEAN,
  ADD COLUMN IF NOT EXISTS parking_spots INTEGER;
