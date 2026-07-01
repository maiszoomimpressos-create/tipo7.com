-- Correção CRIT-01: race condition no checkout
-- A função bloqueia as linhas de ingressos com FOR UPDATE antes de verificar
-- disponibilidade, garantindo que dois checkouts simultâneos não ultrapassem o estoque.

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
  v_order_id    UUID;
  v_total       NUMERIC := 0;
  v_item        JSONB;
  v_ticket_id   UUID;
  v_qty_req     INT;
  v_unit_price  NUMERIC;
  v_qty_max     INT;
  v_qty_sold    INT;
  v_disponivel  INT;
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

    v_total := v_total + (v_unit_price * v_qty_req);
  END LOOP;

  INSERT INTO orders(user_id, event_id, total, status)
  VALUES (p_user_id, p_event_id, v_total, 'pending')
  RETURNING id INTO v_order_id;

  INSERT INTO order_items(order_id, ticket_id, quantity, unit_price)
  SELECT
    v_order_id,
    (j->>'ticket_id')::UUID,
    (j->>'quantity')::INT,
    (j->>'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) j;

  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total);
END;
$$;
