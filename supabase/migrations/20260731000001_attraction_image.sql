-- Cada atração/show de um dia pode ter sua própria imagem (banda diferente
-- em cada dia de um evento multi-dia ou Tenda) -- antes só existia UM banner
-- pra todo o evento inteiro.
ALTER TABLE public.event_day_attractions
  ADD COLUMN IF NOT EXISTS image_url TEXT;
