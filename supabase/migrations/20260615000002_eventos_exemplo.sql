-- =============================================================
-- MIGRATION 002 — Dados de exemplo para desenvolvimento
-- Insere organização e eventos fictícios para testar a landing page
-- REMOVER antes de ir para produção
-- =============================================================

-- Organização de exemplo
INSERT INTO public.organizations (id, name, type, owner_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tipo7.com Demo',
  'promotora',
  NULL
) ON CONFLICT (id) DO NOTHING;

-- Eventos de exemplo em várias cidades do Brasil
INSERT INTO public.events (organization_id, title, description, date_start, date_end, city, state, status, cover_url)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Festival de Verão SP',
    'Os maiores nomes da música brasileira em uma noite única',
    '2026-12-28 18:00:00+00', '2026-12-29 04:00:00+00',
    'São Paulo', 'SP', 'publicado',
    'https://picsum.photos/seed/concert1/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Rock in Rio SP',
    'Uma noite épica com as bandas mais icônicas do rock',
    '2027-01-15 20:00:00+00', '2027-01-16 02:00:00+00',
    'São Paulo', 'SP', 'publicado',
    'https://picsum.photos/seed/rock22/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Réveillon Copacabana 2027',
    'A maior virada do ano com show de fogos e música ao vivo',
    '2026-12-31 20:00:00+00', '2027-01-01 06:00:00+00',
    'Rio de Janeiro', 'RJ', 'publicado',
    'https://picsum.photos/seed/fireworks3/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Carnaval Antecipado RJ',
    'Blocos, samba e muita alegria antes do carnaval oficial',
    '2027-01-10 14:00:00+00', '2027-01-10 23:00:00+00',
    'Rio de Janeiro', 'RJ', 'publicado',
    'https://picsum.photos/seed/carnival4/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Festival Gastronômico BH',
    'Os melhores chefs do Brasil em um só lugar',
    '2027-01-20 11:00:00+00', '2027-01-20 22:00:00+00',
    'Belo Horizonte', 'MG', 'publicado',
    'https://picsum.photos/seed/food55/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Exposição de Arte Contemporânea',
    'Arte, instalações e experiências imersivas',
    '2027-02-05 10:00:00+00', '2027-02-05 20:00:00+00',
    'Curitiba', 'PR', 'publicado',
    'https://picsum.photos/seed/art666/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Stand-up Comedy Night SSA',
    'Os maiores comediantes do Brasil em uma noite de risadas',
    '2027-01-22 20:00:00+00', '2027-01-22 23:30:00+00',
    'Salvador', 'BA', 'publicado',
    'https://picsum.photos/seed/theater7/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Forró Pé de Serra',
    'A melhor festa junina fora de época do Nordeste',
    '2027-01-18 18:00:00+00', '2027-01-19 02:00:00+00',
    'Fortaleza', 'CE', 'publicado',
    'https://picsum.photos/seed/forro8/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Maratona Musical Recife',
    '12 horas de música ao vivo no coração do Recife',
    '2027-02-10 12:00:00+00', '2027-02-11 00:00:00+00',
    'Recife', 'PE', 'publicado',
    'https://picsum.photos/seed/recife9/780/420'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Tech Summit São Paulo',
    'O maior evento de tecnologia e inovação do Brasil',
    '2027-03-05 09:00:00+00', '2027-03-06 18:00:00+00',
    'São Paulo', 'SP', 'publicado',
    'https://picsum.photos/seed/tech10/780/420'
  );
