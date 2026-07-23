-- =============================================================
-- Unifica a geração de código T7: formato T7-{PAIS}-{CATEGORIA}-{7 caracteres}
--   PAIS: fixo "BR" por enquanto (preparado pra internacionalizar depois)
--   CATEGORIA: U = usuário (pessoa), P = promotora, E = estabelecimento
--   7 caracteres aleatórios (alfabeto sem I/O/0/1) = ~34,4 bilhões de
--   combinações POR categoria — cada categoria tem seu próprio espaço,
--   não competem entre si.
--
-- Substitui:
--   - generate_user_code() (antes 5 caracteres, sem código de país/categoria)
--   - a geração sequencial de código de organização que vivia em
--     web/src/app/api/codigo/route.ts (contava linhas — tinha risco de
--     colisão se uma organização fosse excluída ou duas criadas juntas)
-- =============================================================

-- Sorteia só a string (sem checar duplicidade) — usado pelos dois geradores abaixo
CREATE OR REPLACE FUNCTION public.t7_sortear_codigo(p_categoria TEXT)
RETURNS TEXT AS $$
DECLARE
  v_chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo TEXT;
BEGIN
  v_codigo := 'T7-BR-' || p_categoria || '-';
  FOR i IN 1..7 LOOP
    v_codigo := v_codigo || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  END LOOP;
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- Código de pessoa (categoria U) — mesma assinatura de antes, handle_new_user() não precisa mudar
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT AS $$
DECLARE
  v_codigo TEXT;
  v_taken  BOOLEAN;
BEGIN
  LOOP
    v_codigo := public.t7_sortear_codigo('U');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_code = v_codigo) INTO v_taken;
    EXIT WHEN NOT v_taken;
  END LOOP;
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Código de organização (categoria P ou E conforme o tipo) — nova função,
-- substitui a contagem sequencial que existia só no código da aplicação
CREATE OR REPLACE FUNCTION public.generate_org_code(p_tipo TEXT)
RETURNS TEXT AS $$
DECLARE
  v_categoria TEXT;
  v_codigo    TEXT;
  v_taken     BOOLEAN;
BEGIN
  v_categoria := CASE WHEN p_tipo = 'promotora' THEN 'P' ELSE 'E' END;
  LOOP
    v_codigo := public.t7_sortear_codigo(v_categoria);
    SELECT EXISTS(SELECT 1 FROM public.organizations WHERE codigo = v_codigo) INTO v_taken;
    EXIT WHEN NOT v_taken;
  END LOOP;
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Backfill: regenera os códigos de quem já está cadastrado, pro novo formato ──
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.profiles LOOP
    UPDATE public.profiles SET user_code = public.generate_user_code() WHERE id = rec.id;
  END LOOP;

  FOR rec IN SELECT id, type FROM public.organizations LOOP
    UPDATE public.organizations SET codigo = public.generate_org_code(rec.type::TEXT) WHERE id = rec.id;
  END LOOP;
END;
$$;
