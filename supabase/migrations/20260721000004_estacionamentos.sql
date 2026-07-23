-- =============================================================
-- Estacionamento "por tempo / entrada-saída" — config por evento/operação.
-- O sub-modo "por evento" (preço fixo vendido como ingresso) já é coberto
-- por event_tickets; nenhuma tabela nova é necessária para ele.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.estacionamentos (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  nome                   TEXT          NOT NULL,
  cobra_modo             TEXT          NOT NULL DEFAULT 'gratis'
                                        CHECK (cobra_modo IN ('gratis','fixo','por_tempo')),
  preco_fixo             NUMERIC(10,2),
  preco_primeira_hora    NUMERIC(10,2),
  preco_hora_adicional   NUMERIC(10,2),
  teto_diario            NUMERIC(10,2),
  tolerancia_minutos     INTEGER       NOT NULL DEFAULT 10,
  controla_saida         BOOLEAN       NOT NULL DEFAULT true,
  vagas_totais           INTEGER,
  ativo                  BOOLEAN       NOT NULL DEFAULT true,
  created_by             UUID          REFERENCES public.profiles(id),
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_estacionamentos_updated_at
  BEFORE UPDATE ON public.estacionamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_estacionamentos_event_id ON public.estacionamentos(event_id);

-- =============================================================
-- Sessão de veículo — um registro por entrada/saída de placa.
-- Reconciliação de pagamento reaproveita a tabela caixas já existente
-- (não cria tabela paralela de fechamento de caixa).
-- Semântica de status:
--   aberto    → veículo estacionado, sem saída registrada
--   pago      → saída registrada COM cobrança confirmada
--   encerrado → saída registrada SEM cobrança (grátis / cortesia / apenas lead)
--   cancelado → registro anulado pelo atendente (ex.: placa errada)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.estacionamento_sessoes (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  estacionamento_id  UUID          NOT NULL REFERENCES public.estacionamentos(id) ON DELETE CASCADE,
  placa              TEXT          NOT NULL,
  nome_condutor      TEXT,
  telefone_condutor  TEXT,
  entrada_em         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  saida_em           TIMESTAMPTZ,
  valor_cobrado      NUMERIC(10,2),
  forma_pagamento    TEXT          CHECK (forma_pagamento IN ('dinheiro','pix','cartao','cortesia')),
  caixa_id           UUID          REFERENCES public.caixas(id),
  status             TEXT          NOT NULL DEFAULT 'aberto'
                                    CHECK (status IN ('aberto','pago','encerrado','cancelado')),
  registrado_por     UUID          REFERENCES public.profiles(id),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_est_sessoes_estacionamento_id ON public.estacionamento_sessoes(estacionamento_id);
CREATE INDEX IF NOT EXISTS idx_est_sessoes_status            ON public.estacionamento_sessoes(status);
CREATE INDEX IF NOT EXISTS idx_est_sessoes_caixa_id           ON public.estacionamento_sessoes(caixa_id);
CREATE INDEX IF NOT EXISTS idx_est_sessoes_placa              ON public.estacionamento_sessoes(placa);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.estacionamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estacionamento_sessoes ENABLE ROW LEVEL SECURITY;

-- Dono do evento gerencia tudo
CREATE POLICY "estacionamentos_owner_all" ON public.estacionamentos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE e.id = estacionamentos.event_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE e.id = estacionamentos.event_id AND o.owner_id = auth.uid()
    )
  );

-- Staff ativo do evento pode ler a config (necessário para a tela do atendente)
CREATE POLICY "estacionamentos_staff_read" ON public.estacionamentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.event_staff es
      WHERE es.event_id = estacionamentos.event_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
    )
  );

-- Dono do evento gerencia tudo (join through estacionamentos → events → organizations)
CREATE POLICY "est_sessoes_owner_all" ON public.estacionamento_sessoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.events e         ON e.id = p.event_id
      JOIN public.organizations o  ON o.id = e.organization_id
      WHERE p.id = estacionamento_sessoes.estacionamento_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.events e         ON e.id = p.event_id
      JOIN public.organizations o  ON o.id = e.organization_id
      WHERE p.id = estacionamento_sessoes.estacionamento_id AND o.owner_id = auth.uid()
    )
  );

-- Staff ativo do evento lê as sessões (escritas passam por API com service role,
-- igual ao padrão de caixas/bilheteria — este SELECT é defesa em profundidade)
CREATE POLICY "est_sessoes_staff_read" ON public.estacionamento_sessoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.event_staff es ON es.event_id = p.event_id
      WHERE p.id = estacionamento_sessoes.estacionamento_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
    )
  );
