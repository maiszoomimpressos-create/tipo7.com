-- Divisão de preço por lote no checkout (21/08/2026) — ver project_lote_ingressos
-- na memória. Compra que cruza a fronteira de um lote (ex: resta 2 no lote 1,
-- pediu 5) agora gera UM order_item por lote cruzado, cada um com o preço
-- certo, calculado dentro do MESMO lock (FOR UPDATE) que já protege o
-- estoque contra overselling — evita que duas compras concorrentes disputem
-- as últimas unidades baratas de um lote de forma inconsistente.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.ticket_lotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_lote_id ON public.order_items (lote_id);

CREATE OR REPLACE FUNCTION criar_pedido_atomico(
  p_user_id   UUID,
  p_event_id  UUID,
  p_items     JSONB  -- [{ticket_id, quantity, unit_price}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_total        NUMERIC := 0;
  v_item         JSONB;
  v_ticket_id    UUID;
  v_qty_req      INT;
  v_unit_price   NUMERIC;
  v_qty_max      INT;
  v_qty_sold     INT;
  v_disponivel   INT;
  v_tem_lote     BOOLEAN;
  v_result_items JSONB := '[]'::jsonb;
  v_lote         RECORD;
  v_acumulado    INT;
  v_restante     INT;
  v_ja_vendido   INT;
  v_disp_lote    INT;
  v_pega         INT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_ticket_id  := (v_item->>'ticket_id')::UUID;
    v_qty_req    := (v_item->>'quantity')::INT;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    -- Bloqueia a linha: transação concorrente vai esperar aqui até esta confirmar ou cancelar
    SELECT quantity INTO v_qty_max
    FROM event_tickets
    WHERE id = v_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'ingresso_nao_encontrado', 'ticket_id', v_ticket_id);
    END IF;

    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_qty_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.ticket_id = v_ticket_id
      AND o.status NOT IN ('rejected', 'cancelled');

    v_disponivel := v_qty_max - v_qty_sold;

    IF v_qty_req > v_disponivel THEN
      RETURN jsonb_build_object(
        'error',      'sem_estoque',
        'ticket_id',  v_ticket_id,
        'disponivel', v_disponivel
      );
    END IF;

    SELECT EXISTS(SELECT 1 FROM ticket_lotes WHERE ticket_id = v_ticket_id) INTO v_tem_lote;

    IF NOT v_tem_lote THEN
      -- Sem lote: comportamento IDÊNTICO ao de antes dessa migração — confia
      -- no preço mandado pelo TS, um order_item só, lote_id fica nulo.
      v_total := v_total + (v_unit_price * v_qty_req);
      v_result_items := v_result_items || jsonb_build_object(
        'ticket_id', v_ticket_id, 'quantity', v_qty_req, 'unit_price', v_unit_price,
        'lote_id', NULL, 'lote_ordem', NULL
      );
    ELSE
      -- Com lote: aloca a quantidade pedida em ordem de lote — ignora o
      -- preço mandado pelo TS pra esse ticket, o preço de verdade sai daqui.
      v_restante  := v_qty_req;
      v_acumulado := 0;

      FOR v_lote IN
        SELECT id, ordem, price, quantity
        FROM ticket_lotes
        WHERE ticket_id = v_ticket_id
        ORDER BY ordem ASC
      LOOP
        v_ja_vendido := GREATEST(0, LEAST(v_lote.quantity, v_qty_sold - v_acumulado));
        v_disp_lote  := v_lote.quantity - v_ja_vendido;

        IF v_disp_lote > 0 AND v_restante > 0 THEN
          v_pega := LEAST(v_disp_lote, v_restante);
          v_total := v_total + (v_pega * v_lote.price);
          v_result_items := v_result_items || jsonb_build_object(
            'ticket_id', v_ticket_id, 'quantity', v_pega, 'unit_price', v_lote.price,
            'lote_id', v_lote.id, 'lote_ordem', v_lote.ordem
          );
          v_restante := v_restante - v_pega;
          v_qty_sold := v_qty_sold + v_pega; -- avança a simulação pro próximo lote, dentro da MESMA compra
        END IF;

        v_acumulado := v_acumulado + v_lote.quantity;
        EXIT WHEN v_restante = 0;
      END LOOP;

      IF v_restante > 0 THEN
        -- Sobrou quantidade que os lotes não cobrem (soma dos lotes é menor
        -- que o total do ingresso — config incompleta do promotor). Recusa
        -- em vez de vender sem preço definido.
        RETURN jsonb_build_object(
          'error',      'lotes_insuficientes',
          'ticket_id',  v_ticket_id,
          'disponivel', v_qty_req - v_restante
        );
      END IF;
    END IF;
  END LOOP;

  INSERT INTO orders(user_id, event_id, total, status)
  VALUES (p_user_id, p_event_id, v_total, 'pending')
  RETURNING id INTO v_order_id;

  INSERT INTO order_items(order_id, ticket_id, quantity, unit_price, lote_id)
  SELECT
    v_order_id,
    (j->>'ticket_id')::UUID,
    (j->>'quantity')::INT,
    (j->>'unit_price')::NUMERIC,
    (j->>'lote_id')::UUID
  FROM jsonb_array_elements(v_result_items) j;

  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total, 'items', v_result_items);
END;
$$;
