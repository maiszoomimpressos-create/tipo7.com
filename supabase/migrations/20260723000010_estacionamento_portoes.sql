-- =============================================================
-- Portões (pontos físicos de entrada/saída) de um estacionamento.
--
-- Motivação (usuário, 23/07/2026): estacionamentos grandes podem ter vários
-- portões físicos, e um carro pode sair por qualquer um deles, não
-- necessariamente o mesmo por onde entrou. O organizador nomeia cada
-- portão e diz se ele é de entrada, saída, ou os dois — e pode restringir
-- um atendente específico a operar só um portão (event_staff.portao_id).
--
-- Quando um estacionamento não tem nenhum portão cadastrado, tudo continua
-- funcionando exatamente como antes (sem exigir portão) — retrocompatível.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.estacionamento_portoes (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  estacionamento_id  UUID        NOT NULL REFERENCES public.estacionamentos(id) ON DELETE CASCADE,
  nome               TEXT        NOT NULL,
  tipo               TEXT        NOT NULL DEFAULT 'ambos' CHECK (tipo IN ('entrada','saida','ambos')),
  ativo              BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_est_portoes_estacionamento_id ON public.estacionamento_portoes(estacionamento_id);

ALTER TABLE public.estacionamento_portoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_portoes_owner_all" ON public.estacionamento_portoes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.events e        ON e.id = p.event_id
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE p.id = estacionamento_portoes.estacionamento_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.events e        ON e.id = p.event_id
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE p.id = estacionamento_portoes.estacionamento_id AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "est_portoes_staff_read" ON public.estacionamento_portoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.estacionamentos p
      JOIN public.event_staff es ON es.event_id = p.event_id
      WHERE p.id = estacionamento_portoes.estacionamento_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
    )
  );

-- Restringe um membro da equipe a operar só um portão específico (opcional —
-- null continua significando "sem restrição de portão", igual hoje).
ALTER TABLE public.event_staff
  ADD COLUMN IF NOT EXISTS portao_id UUID REFERENCES public.estacionamento_portoes(id) ON DELETE SET NULL;

-- Registra por qual portão o carro entrou/saiu, pra relatório.
ALTER TABLE public.estacionamento_sessoes
  ADD COLUMN IF NOT EXISTS portao_entrada_id UUID REFERENCES public.estacionamento_portoes(id),
  ADD COLUMN IF NOT EXISTS portao_saida_id   UUID REFERENCES public.estacionamento_portoes(id);
