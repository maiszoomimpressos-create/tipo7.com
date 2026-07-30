// Resolve quais eventos podem ser vendidos a partir de um caixa.
// Nesting é de no máximo 1 nível (um filho não pode ter filhos — regra
// aplicada em api/eventos/[id]/criar-filho/route.ts), então não precisa
// de busca recursiva.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EventoVendavel {
  id:    string
  title: string
}

// eventoIdDoCaixa = caixas.evento_id (o evento em que o caixa foi aberto).
// Se for um evento filho, o caixa é dedicado só a ele. Se for um evento pai,
// inclui também os filhos que optaram por vender no caixa do pai.
export async function getEventosVendaveisNoCaixa(
  admin:           SupabaseClient,
  eventoIdDoCaixa: string,
): Promise<EventoVendavel[]> {
  const { data: evento } = await admin
    .from('events')
    .select('id, title, parent_event_id')
    .eq('id', eventoIdDoCaixa)
    .single()

  if (!evento) return [{ id: eventoIdDoCaixa, title: 'Evento' }]

  if (evento.parent_event_id) {
    return [{ id: evento.id, title: evento.title ?? 'Evento' }]
  }

  const { data: filhos } = await admin
    .from('events')
    .select('id, title')
    .eq('parent_event_id', eventoIdDoCaixa)
    .eq('permitir_venda_no_caixa_pai', true)

  return [
    { id: evento.id, title: evento.title ?? 'Evento' },
    ...(filhos ?? []).map(f => ({ id: f.id, title: f.title ?? 'Evento' })),
  ]
}

// Raiz da "família" de um evento — o próprio id se for pai, ou o id do pai se
// for filho. Usado pra comparar se dois caixas pertencem à mesma família
// (ex.: liberar transferência entre caixas do pai e de um filho).
export async function getFamiliaRoot(admin: SupabaseClient, eventoId: string): Promise<string> {
  const { data: evento } = await admin
    .from('events')
    .select('parent_event_id')
    .eq('id', eventoId)
    .single()
  return evento?.parent_event_id ?? eventoId
}
