-- Sistema de caixas para bilheteria presencial

-- Flags no evento
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS vendas_online_pausadas      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transferencia_requer_senha  BOOLEAN NOT NULL DEFAULT FALSE;

-- Sessões de caixa abertas pelo promotor
CREATE TABLE caixas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id           UUID        NOT NULL REFERENCES events(id)      ON DELETE CASCADE,
  operador_id         UUID                 REFERENCES auth.users(id),
  nome                TEXT        NOT NULL,
  fundo_inicial       NUMERIC(10,2) NOT NULL DEFAULT 0,
  ingressos_alocados  INTEGER     NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'aberto'
                        CHECK (status IN ('aberto','fechado')),
  aberto_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fechado_em          TIMESTAMPTZ,
  created_by          UUID        NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transferências de ingressos físicos entre caixas
CREATE TABLE caixa_transferencias (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id         UUID        NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  caixa_origem_id   UUID        NOT NULL REFERENCES caixas(id),
  caixa_destino_id  UUID        NOT NULL REFERENCES caixas(id),
  quantidade        INTEGER     NOT NULL CHECK (quantidade > 0),
  autorizado_por    UUID                 REFERENCES auth.users(id),
  observacao        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT origens_diferentes CHECK (caixa_origem_id <> caixa_destino_id)
);

-- Apuração do fechamento de cada caixa
CREATE TABLE caixa_fechamento (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id              UUID          NOT NULL UNIQUE REFERENCES caixas(id),
  dinheiro_contado      NUMERIC(10,2) NOT NULL DEFAULT 0,
  ingressos_devolvidos  INTEGER       NOT NULL DEFAULT 0,
  diferenca_dinheiro    NUMERIC(10,2),   -- calculado: esperado - contado
  diferenca_ingressos   INTEGER,          -- calculado: entregues - vendidos
  observacoes           TEXT,
  fechado_por           UUID          REFERENCES auth.users(id),
  criado_em             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Vincula venda presencial ao caixa
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS caixa_id UUID REFERENCES caixas(id);

CREATE INDEX IF NOT EXISTS idx_orders_caixa_id        ON orders(caixa_id);
CREATE INDEX IF NOT EXISTS idx_caixas_evento_id       ON caixas(evento_id);
CREATE INDEX IF NOT EXISTS idx_caixas_operador_id     ON caixas(operador_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_evento  ON caixa_transferencias(evento_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE caixas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_fechamento     ENABLE ROW LEVEL SECURITY;

-- caixas: dono do evento gerencia tudo; operador designado lê o seu
CREATE POLICY "caixas_owner_all" ON caixas
  FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      JOIN organizations o ON o.id = e.organization_id
      WHERE e.id = caixas.evento_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "caixas_operador_read" ON caixas
  FOR SELECT USING (operador_id = auth.uid());

-- caixa_transferencias: dono do evento e operadores do evento leem/criam
CREATE POLICY "transferencias_evento_owner" ON caixa_transferencias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN organizations o ON o.id = e.organization_id
      WHERE e.id = caixa_transferencias.evento_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "transferencias_operador_read" ON caixa_transferencias
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM caixas c
      WHERE c.id IN (caixa_transferencias.caixa_origem_id, caixa_transferencias.caixa_destino_id)
        AND c.operador_id = auth.uid()
    )
  );

CREATE POLICY "transferencias_operador_insert" ON caixa_transferencias
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM caixas c
      WHERE c.id IN (caixa_transferencias.caixa_origem_id, caixa_transferencias.caixa_destino_id)
        AND c.operador_id = auth.uid()
    )
  );

-- caixa_fechamento: dono do evento e operador do caixa
CREATE POLICY "fechamento_owner" ON caixa_fechamento
  FOR ALL USING (
    fechado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM caixas c
      JOIN events e ON e.id = c.evento_id
      JOIN organizations o ON o.id = e.organization_id
      WHERE c.id = caixa_fechamento.caixa_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "fechamento_operador" ON caixa_fechamento
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM caixas c
      WHERE c.id = caixa_fechamento.caixa_id AND c.operador_id = auth.uid()
    )
  );
