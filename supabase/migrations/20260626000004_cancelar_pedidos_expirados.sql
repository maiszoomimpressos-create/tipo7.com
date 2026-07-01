-- ALTO-04: pedidos pending nunca expiravam, bloqueando estoque indefinidamente
-- Solução dupla:
-- 1. Função que cancela pedidos pending com mais de 90 minutos (PIX expira em 30 min,
--    Checkout Pro pode demorar até ~60 min — 90 min dá margem segura)
-- 2. Cron job via pg_cron que roda a cada 30 minutos automaticamente
-- 3. Atualiza criar_pedido_atomico para ignorar pendentes expirados na contagem de estoque

-- Função de limpeza
CREATE OR REPLACE FUNCTION cancelar_pedidos_expirados()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE orders
  SET    status     = 'cancelled',
         updated_at = NOW()
  WHERE  status     = 'pending'
    AND  created_at < NOW() - INTERVAL '90 minutes';
$$;

-- Cron job: cancela pedidos expirados a cada 30 minutos
-- Requer pg_cron (disponível no Supabase Pro/Team)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cancelar-pedidos-expirados',
  '*/30 * * * *',
  'SELECT cancelar_pedidos_expirados()'
);

-- Atualiza criar_pedido_atomico para ignorar pending expirados na contagem de estoque
-- Assim, mesmo antes do cron rodar, o estoque já fica disponível para outros compradores
CREATE OR REPLACE FUNCTION criar_pedido_atomico(
  p_user_id   UUID,
  p_event_id  UUID,
  p_items     JSONB
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

    SELECT quantity INTO v_qty_max
    FROM event_tickets
    WHERE id = v_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'ingresso_nao_encontrado', 'ticket_id', v_ticket_id);
    END IF;

    -- Conta vendas confirmadas + pendentes recentes (exclui cancelados, rejeitados
    -- e pending com mais de 90 min — esses já são considerados abandonados)
    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_qty_sold
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.ticket_id = v_ticket_id
      AND o.status NOT IN ('rejected', 'cancelled')
      AND NOT (o.status = 'pending' AND o.created_at < NOW() - INTERVAL '90 minutes');

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
