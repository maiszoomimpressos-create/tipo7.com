-- Saldo de bilheteria: reserva formada a partir das vendas online (retencao extra)
-- pra cobrir a taxa da plataforma nas vendas presenciais (dinheiro/maquininha do
-- promotor), que nao tem como ser descontada automaticamente via Mercado Pago.
-- O calculo de taxa (fixo/%, regras por evento/promotor/quota) continua todo em
-- TypeScript (calcularTaxaPlataforma) -- essas functions so fazem a escrita
-- atomica do saldo/livro-razao, recebendo os valores ja calculados.

CREATE TABLE IF NOT EXISTS public.saldo_bilheteria (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  ativo            BOOLEAN NOT NULL DEFAULT false,
  bloqueio_ativo   BOOLEAN NOT NULL DEFAULT false,
  retencao_pct     NUMERIC(5,2) NOT NULL DEFAULT 50,
  aviso_pct        NUMERIC(5,2) NOT NULL DEFAULT 20,
  meta_reserva     NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo_atual      NUMERIC(10,2) NOT NULL DEFAULT 0,
  aviso_disparado  BOOLEAN NOT NULL DEFAULT false,
  ativado_em       TIMESTAMPTZ,
  ativado_por      UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saldo_bilheteria_movimentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL CHECK (tipo IN ('incremento_venda_online','debito_venda_bilheteria','recalculo_meta','ajuste_manual')),
  valor            NUMERIC(10,2) NOT NULL,
  saldo_resultante NUMERIC(10,2) NOT NULL,
  order_id         UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  criado_por       UUID REFERENCES auth.users(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saldo_bilheteria_movimentos_event
  ON public.saldo_bilheteria_movimentos(event_id, criado_em DESC);

ALTER TABLE public.saldo_bilheteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldo_bilheteria_movimentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "saldo_bilheteria_service_only" ON public.saldo_bilheteria USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "saldo_bilheteria_movimentos_service_only" ON public.saldo_bilheteria_movimentos USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ativa o saldo de bilheteria pro evento (opt-in do promotor na criacao do caixa).
-- p_meta_reserva ja vem calculada em TypeScript (soma da taxa devida sobre os
-- ingressos ainda nao vendidos).
CREATE OR REPLACE FUNCTION public.ativar_saldo_bilheteria(
  p_event_id     UUID,
  p_user_id      UUID,
  p_meta_reserva NUMERIC,
  p_retencao_pct NUMERIC DEFAULT 50,
  p_aviso_pct    NUMERIC DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row saldo_bilheteria;
BEGIN
  INSERT INTO saldo_bilheteria (event_id, ativo, retencao_pct, aviso_pct, meta_reserva, ativado_em, ativado_por)
  VALUES (p_event_id, true, p_retencao_pct, p_aviso_pct, p_meta_reserva, NOW(), p_user_id)
  ON CONFLICT (event_id) DO UPDATE SET
    ativo        = true,
    retencao_pct = EXCLUDED.retencao_pct,
    aviso_pct    = EXCLUDED.aviso_pct,
    meta_reserva = EXCLUDED.meta_reserva,
    ativado_em   = NOW(),
    ativado_por  = p_user_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'saldo_atual', v_row.saldo_atual, 'meta_reserva', v_row.meta_reserva);
END;
$$;

-- Chamada depois de uma venda ONLINE, quando o saldo esta ativo pro evento.
-- Soma a contribuicao extra e atualiza a meta (recalculada em TS a cada venda).
CREATE OR REPLACE FUNCTION public.incrementar_saldo_bilheteria(
  p_event_id    UUID,
  p_order_id    UUID,
  p_valor_extra NUMERIC,
  p_nova_meta   NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_novo NUMERIC;
BEGIN
  UPDATE saldo_bilheteria
  SET saldo_atual = saldo_atual + p_valor_extra,
      meta_reserva = p_nova_meta
  WHERE event_id = p_event_id AND ativo = true
  RETURNING saldo_atual INTO v_saldo_novo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'saldo_nao_ativo');
  END IF;

  INSERT INTO saldo_bilheteria_movimentos (event_id, tipo, valor, saldo_resultante, order_id)
  VALUES (p_event_id, 'incremento_venda_online', p_valor_extra, v_saldo_novo, p_order_id);

  RETURN jsonb_build_object('ok', true, 'saldo_atual', v_saldo_novo);
END;
$$;

-- Chamada antes de confirmar uma venda de BILHETERIA (dinheiro ou pix presencial).
-- Trava a linha do saldo; se bloqueio_ativo e o debito deixaria negativo, recusa.
CREATE OR REPLACE FUNCTION public.debitar_saldo_bilheteria(
  p_event_id UUID,
  p_valor    NUMERIC,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo        saldo_bilheteria;
  v_saldo_novo   NUMERIC;
  v_limiar_aviso NUMERIC;
BEGIN
  SELECT * INTO v_saldo FROM saldo_bilheteria WHERE event_id = p_event_id FOR UPDATE;

  -- Evento nunca ativou o saldo -- nao ha o que controlar, segue normal.
  IF NOT FOUND OR NOT v_saldo.ativo THEN
    RETURN jsonb_build_object('ok', true, 'skip', true);
  END IF;

  v_saldo_novo := v_saldo.saldo_atual - p_valor;

  IF v_saldo.bloqueio_ativo AND v_saldo_novo < 0 THEN
    RETURN jsonb_build_object('error', 'saldo_insuficiente', 'saldo_atual', v_saldo.saldo_atual, 'necessario', p_valor);
  END IF;

  v_limiar_aviso := v_saldo.meta_reserva * v_saldo.aviso_pct / 100;

  UPDATE saldo_bilheteria
  SET saldo_atual     = v_saldo_novo,
      aviso_disparado = aviso_disparado OR (v_saldo_novo <= v_limiar_aviso)
  WHERE event_id = p_event_id;

  INSERT INTO saldo_bilheteria_movimentos (event_id, tipo, valor, saldo_resultante, order_id)
  VALUES (p_event_id, 'debito_venda_bilheteria', -p_valor, v_saldo_novo, p_order_id);

  RETURN jsonb_build_object('ok', true, 'saldo_atual', v_saldo_novo);
END;
$$;
