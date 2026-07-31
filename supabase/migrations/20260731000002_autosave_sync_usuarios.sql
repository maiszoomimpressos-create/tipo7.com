-- Nova rota de envio (Tipo7 → Autosave) pra Usuários — via de mão dupla,
-- simétrica ao que já existia em Estacionamento. Documenta
-- api/auth/sync-autosave (POST /customers), chamada depois do cadastro
-- (AuthContext.signUp) e depois de salvar o perfil (ProfileForm.tsx).
DO $$
DECLARE
  v_usuarios UUID;
BEGIN
  SELECT id INTO v_usuarios FROM public.api_integracoes WHERE area_slug = 'usuarios';

  INSERT INTO public.api_integracao_rotas
    (integracao_id, rota, direcao, gatilho, campos_envia, campos_recebe, observacao, order_index)
  VALUES
    (v_usuarios, 'api/auth/sync-autosave', 'sai',
      'Depois que o cadastro termina ou o perfil é salvo em /perfil',
      ARRAY['external_id','full_name','email','cpf','phone','rg','birth_date','zip_code','street','street_number','neighborhood','city','state','complement'],
      ARRAY[]::text[],
      'Fire-and-forget — nunca bloqueia o cadastro/salvamento se a Autosave estiver fora do ar. Não manda dado de empresa (CNPJ) — contrato de customer da Autosave é só pessoa física.', 4)
  ON CONFLICT (integracao_id, rota) DO NOTHING;
END $$;
