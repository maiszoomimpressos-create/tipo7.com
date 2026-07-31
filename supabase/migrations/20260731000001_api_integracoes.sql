-- =============================================================
-- Integrações de API externas (ex.: Autosave), gerenciáveis via
-- /admin/api sem precisar de env var + deploy.
--
-- api_integracoes  = credenciais reais (base_url/api_key/webhook_secret),
--                    uma linha por área — usadas de verdade pelo código
--                    (lib/autosave.ts, api/webhooks/autosave).
-- api_integracao_rotas = documentação editável de quais campos cada rota
--                    manda/recebe — é só contrato/documentação, editar
--                    aqui NÃO muda o que o código realmente envia/pede
--                    (isso ainda exige mexer em lib/autosave.ts + deploy).
--
-- RLS habilitada SEM nenhuma policy — api_key/webhook_secret ficam em
-- texto puro (mesmo padrão de promotor_mp_accounts.mp_access_token), só
-- acessível via service role nas rotas /api/admin/integracoes/*, nunca
-- direto pelo client.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.api_integracoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_slug      TEXT UNIQUE NOT NULL CHECK (area_slug IN ('usuarios', 'estacionamento')),
  nome           TEXT NOT NULL,
  base_url       TEXT,
  api_key        TEXT,
  webhook_secret TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_integracoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.api_integracao_rotas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id  UUID NOT NULL REFERENCES public.api_integracoes(id) ON DELETE CASCADE,
  rota           TEXT NOT NULL,
  direcao        TEXT NOT NULL CHECK (direcao IN ('entra', 'sai', 'push')),
  gatilho        TEXT,
  campos_envia   TEXT[] NOT NULL DEFAULT '{}',
  campos_recebe  TEXT[] NOT NULL DEFAULT '{}',
  observacao     TEXT,
  order_index    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integracao_id, rota)
);

ALTER TABLE public.api_integracao_rotas ENABLE ROW LEVEL SECURITY;

-- ── Seed: as duas áreas já existentes (sem credenciais — cola na tela) ───
INSERT INTO public.api_integracoes (area_slug, nome) VALUES
  ('usuarios',       'Autosave — Usuários'),
  ('estacionamento', 'Autosave — Estacionamento')
ON CONFLICT (area_slug) DO NOTHING;

-- ── Seed: documentação dos campos já em uso hoje ─────────────────────────
DO $$
DECLARE
  v_usuarios       UUID;
  v_estacionamento UUID;
BEGIN
  SELECT id INTO v_usuarios       FROM public.api_integracoes WHERE area_slug = 'usuarios';
  SELECT id INTO v_estacionamento FROM public.api_integracoes WHERE area_slug = 'estacionamento';

  INSERT INTO public.api_integracao_rotas
    (integracao_id, rota, direcao, gatilho, campos_envia, campos_recebe, observacao, order_index)
  VALUES
    (v_usuarios, 'api/auth/cpf-lookup', 'entra',
      'Usuário sai do campo CPF (cadastro ou edição de perfil)',
      ARRAY['cpf'],
      ARRAY['telefone (mascarado)', 'email (mascarado)'],
      'Só confirma que existe cadastro — não expõe o dado bruto.', 1),
    (v_usuarios, 'api/auth/cpf-confirmar', 'entra',
      'Usuário confirma posse do CPF digitando telefone ou email completo',
      ARRAY['cpf', 'valor (telefone ou email digitado)'],
      ARRAY['full_name','email','phone','birth_date','rg','zip_code','street','street_number','neighborhood','city','state','complement'],
      'Libera o pré-preenchimento completo do formulário.', 2),
    (v_usuarios, 'api/webhooks/autosave', 'push',
      'Evento externo customers.created / customers.updated (inclusive por outro sistema do grupo)',
      ARRAY[]::text[],
      ARRAY['external_id (chave)','full_name','cpf','phone','rg','birth_date','zip_code','street','street_number','neighborhood','city','state','complement'],
      'Só atualiza campo vazio no profile local — nunca sobrescreve o que o usuário já preencheu aqui.', 3),
    (v_estacionamento, 'api/estacionamento/placa-lookup', 'entra',
      'Atendente digita a placa no registro de entrada',
      ARRAY['placa'],
      ARRAY['modelo (marca + modelo)', 'cor'],
      'Só pré-preenche os campos — falha nunca trava o atendimento.', 1),
    (v_estacionamento, 'api/estacionamento/entrada', 'sai',
      'Depois que a entrada já foi registrada com sucesso no Tipo7',
      ARRAY['placa','modelo','cor'],
      ARRAY[]::text[],
      'Fire-and-forget — enriquece a base da Autosave, nunca atrasa a resposta pro atendente.', 2)
  ON CONFLICT (integracao_id, rota) DO NOTHING;
END $$;
