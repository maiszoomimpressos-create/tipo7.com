-- Rate limiting global via banco de dados.
-- Garante que o limite por IP funcione mesmo entre múltiplas instâncias Vercel
-- (rate limit em memória não funciona em serverless multi-instância).
--
-- A tabela guarda um registro por requisição na janela ativa.
-- A função retorna FALSE quando o IP excede o limite — a limpeza de
-- registros antigos acontece a cada chamada para manter a tabela enxuta.

CREATE TABLE IF NOT EXISTS public.rate_limit_requests (
  id         BIGSERIAL   PRIMARY KEY,
  ip         TEXT        NOT NULL,
  key        TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_key ON public.rate_limit_requests (ip, key, created_at);

-- Somente o service role acessa esta tabela
ALTER TABLE public.rate_limit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_service_only" ON public.rate_limit_requests USING (false);

-- Função atômica: conta + insere em uma transação.
-- Retorna TRUE se permitido, FALSE se excedeu o limite.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip             TEXT,
  p_key            TEXT,
  p_max            INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count        INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Limpa entradas antigas desta chave (mantém a tabela pequena)
  DELETE FROM rate_limit_requests
  WHERE key = p_key AND ip = p_ip AND created_at < v_window_start;

  -- Conta requisições na janela ativa
  SELECT COUNT(*) INTO v_count
  FROM rate_limit_requests
  WHERE ip = p_ip AND key = p_key AND created_at >= v_window_start;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  -- Registra esta requisição
  INSERT INTO rate_limit_requests (ip, key) VALUES (p_ip, p_key);

  RETURN TRUE;
END;
$$;
