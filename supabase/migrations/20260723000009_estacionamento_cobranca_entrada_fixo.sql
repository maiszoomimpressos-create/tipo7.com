-- =============================================================
-- Regra de cobrança do estacionamento (definida com o usuário 23/07/2026):
--   cobra_modo = 'gratis'    → nunca cobra
--   cobra_modo = 'fixo'      → cobra SEMPRE na entrada (preço fixo, não
--                              depende de quanto tempo o carro fica)
--   cobra_modo = 'por_tempo' → cobra SEMPRE na saída (como já funcionava)
--
-- registrar_entrada_estacionamento passa a aceitar os dados de cobrança
-- (opcionais) pra gravar o pagamento já na entrada quando for preço fixo.
-- status da sessão continua 'aberto' até a saída — isso não muda: o carro
-- ainda está estacionado, só o valor/forma/caixa já ficam registrados.
-- =============================================================
-- Assinatura antiga (5 args) vira uma sobrecarga fantasma se só usarmos
-- CREATE OR REPLACE — precisa dropar explicitamente antes de recriar.
DROP FUNCTION IF EXISTS registrar_entrada_estacionamento(UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION registrar_entrada_estacionamento(
  p_estacionamento_id UUID,
  p_placa             TEXT,
  p_nome_condutor     TEXT,
  p_telefone_condutor TEXT,
  p_registrado_por    UUID,
  p_valor_cobrado      NUMERIC DEFAULT NULL,
  p_forma_pagamento    TEXT    DEFAULT NULL,
  p_caixa_id           UUID    DEFAULT NULL
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

  INSERT INTO estacionamento_sessoes (
    estacionamento_id, placa, nome_condutor, telefone_condutor, registrado_por,
    valor_cobrado, forma_pagamento, caixa_id
  )
  VALUES (
    p_estacionamento_id, p_placa, p_nome_condutor, p_telefone_condutor, p_registrado_por,
    p_valor_cobrado, p_forma_pagamento, p_caixa_id
  )
  RETURNING id INTO v_sessao_id;

  RETURN jsonb_build_object('sessao_id', v_sessao_id);
END;
$$;
