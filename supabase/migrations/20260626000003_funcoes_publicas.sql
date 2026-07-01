-- ALTO-01: stats públicas sem service role
-- ALTO-02: verificações de CPF e CNPJ sem service role
-- Funções SECURITY DEFINER permitem que o cliente anon consulte dados restritos
-- retornando apenas o mínimo necessário (booleano ou contadores)

-- Retorna contadores públicos da plataforma
CREATE OR REPLACE FUNCTION stats_publicas()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'ativos',     (SELECT count(*)::INT FROM events WHERE status = 'publicado' AND date_end >= now()),
    'realizados', (SELECT count(*)::INT FROM events WHERE status IN ('publicado', 'encerrado') AND date_end < now()),
    'usuarios',   (SELECT count(*)::INT FROM profiles)
  );
$$;

-- Verifica se CPF já está cadastrado (usado no formulário de cadastro)
CREATE OR REPLACE FUNCTION check_cpf_exists(cpf_digits TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE cpf = cpf_digits);
$$;

-- Verifica se CNPJ já está cadastrado (usado no formulário de promotora PJ)
CREATE OR REPLACE FUNCTION check_cnpj_exists(cnpj_digits TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM organizations WHERE cnpj = cnpj_digits);
$$;

-- Permite chamada via anon key (sem autenticação)
GRANT EXECUTE ON FUNCTION stats_publicas()          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_cpf_exists(TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_cnpj_exists(TEXT)  TO anon, authenticated;
