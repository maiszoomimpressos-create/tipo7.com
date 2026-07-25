-- Adiciona modelo, cor e CPF do condutor ao registro de entrada do estacionamento.
-- CPF é opcional (nem todo condutor quer/consegue informar na hora).
alter table estacionamento_sessoes
  add column if not exists modelo         text,
  add column if not exists cor            text,
  add column if not exists cpf_condutor   text;

drop function if exists registrar_entrada_estacionamento(uuid, text, text, text, uuid, numeric, text, uuid, uuid);

create or replace function registrar_entrada_estacionamento(
  p_estacionamento_id  uuid,
  p_placa              text,
  p_nome_condutor      text,
  p_telefone_condutor  text,
  p_registrado_por     uuid,
  p_valor_cobrado      numeric default null,
  p_forma_pagamento    text    default null,
  p_caixa_id           uuid    default null,
  p_portao_entrada_id  uuid    default null,
  p_modelo             text    default null,
  p_cor                text    default null,
  p_cpf_condutor       text    default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_vagas_totais int;
  v_ativo        boolean;
  v_ocupadas     int;
  v_sessao_id    uuid;
begin
  select vagas_totais, ativo into v_vagas_totais, v_ativo
  from estacionamentos
  where id = p_estacionamento_id
  for update;

  if not found then
    return jsonb_build_object('error', 'estacionamento_nao_encontrado');
  end if;

  if not v_ativo then
    return jsonb_build_object('error', 'estacionamento_inativo');
  end if;

  if v_vagas_totais is not null then
    select count(*) into v_ocupadas
    from estacionamento_sessoes
    where estacionamento_id = p_estacionamento_id
      and status = 'aberto';

    if v_ocupadas >= v_vagas_totais then
      return jsonb_build_object('error', 'lotado', 'ocupadas', v_ocupadas, 'vagas_totais', v_vagas_totais);
    end if;
  end if;

  insert into estacionamento_sessoes (
    estacionamento_id, placa, nome_condutor, telefone_condutor, registrado_por,
    valor_cobrado, forma_pagamento, caixa_id, portao_entrada_id,
    modelo, cor, cpf_condutor
  )
  values (
    p_estacionamento_id, p_placa, p_nome_condutor, p_telefone_condutor, p_registrado_por,
    p_valor_cobrado, p_forma_pagamento, p_caixa_id, p_portao_entrada_id,
    p_modelo, p_cor, p_cpf_condutor
  )
  returning id into v_sessao_id;

  return jsonb_build_object('sessao_id', v_sessao_id);
end;
$function$;
