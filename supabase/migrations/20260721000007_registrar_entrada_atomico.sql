-- Registra entrada de veículo respeitando o limite de vagas de forma atômica.
-- Mesmo padrão de criar_pedido_atomico (20260626000001): bloqueia a linha
-- com FOR UPDATE antes de contar ocupação, então duas entradas simultâneas
-- não conseguem furar o limite de vagas — a segunda espera a primeira
-- confirmar (ou cancelar) antes de fazer sua própria contagem.
CREATE OR REPLACE FUNCTION registrar_entrada_estacionamento(
  p_estacionamento_id UUID,
  p_placa             TEXT,
  p_nome_condutor     TEXT,
  p_telefone_condutor TEXT,
  p_registrado_por    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vagas_totais INT;
  v_ativo        BOOLEAN;
  v_ocupadas     INT;
  v_sessao_id    UUID;
BEGIN
  -- Bloqueia a linha do estacionamento: entradas concorrentes pro mesmo local
  -- esperam aqui até esta transação confirmar ou cancelar
  SELECT vagas_totais, ativo INTO v_vagas_totais, v_ativo
  FROM estacionamentos
  WHERE id = p_estacionamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'estacionamento_nao_encontrado');
  END IF;

  IF NOT v_ativo THEN
    RETURN jsonb_build_object('error', 'estacionamento_inativo');
  END IF;

  IF v_vagas_totais IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ocupadas
    FROM estacionamento_sessoes
    WHERE estacionamento_id = p_estacionamento_id
      AND status = 'aberto';

    IF v_ocupadas >= v_vagas_totais THEN
      RETURN jsonb_build_object('error', 'lotado', 'ocupadas', v_ocupadas, 'vagas_totais', v_vagas_totais);
    END IF;
  END IF;

  INSERT INTO estacionamento_sessoes (estacionamento_id, placa, nome_condutor, telefone_condutor, registrado_por)
  VALUES (p_estacionamento_id, p_placa, p_nome_condutor, p_telefone_condutor, p_registrado_por)
  RETURNING id INTO v_sessao_id;

  RETURN jsonb_build_object('sessao_id', v_sessao_id);
END;
$$;
