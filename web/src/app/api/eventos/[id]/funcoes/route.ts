import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertOwner(userId: string, eventoId: string) {
  const admin = createServiceClient()
  const { data: evento } = await admin.from('events').select('organization_id').eq('id', eventoId).single()
  if (!evento) return false
  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', evento.organization_id).single()
  return org?.owner_id === userId
}

const PERMISSOES_ESTACIONAMENTO = ['estacionamento_entrada', 'estacionamento_saida']

// Estacionamento é produto à parte: sem pátio cadastrado no evento, remove
// as permissões de estacionamento — impede atribuir por request forjado ou
// via template importado. (Futuro: trocar por "contratou o plano".)
async function filtrarPorProduto(eventoId: string, permissoes: string[]): Promise<string[]> {
  if (!permissoes?.some(p => PERMISSOES_ESTACIONAMENTO.includes(p))) return permissoes ?? []
  const admin = createServiceClient()
  const { count } = await admin
    .from('estacionamentos')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventoId)
  if ((count ?? 0) > 0) return permissoes
  return permissoes.filter(p => !PERMISSOES_ESTACIONAMENTO.includes(p))
}

// GET — lista funções do evento com suas permissões
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await assertOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = createServiceClient()
  const { data: funcoes } = await admin
    .from('event_positions')
    .select('id, name, event_position_permissions(permission)')
    .eq('event_id', id)
    .order('created_at')

  return NextResponse.json({ funcoes: funcoes ?? [] })
}

// POST — cria nova função com permissões
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!(await assertOwner(user.id, id))) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, permissoes } = await req.json() as { nome: string; permissoes: string[] }
  if (!nome?.trim()) return NextResponse.json({ error: 'Nome da função é obrigatório' }, { status: 400 })

  const admin = createServiceClient()

  const permsValidas = await filtrarPorProduto(id, permissoes)

  const { data: funcao, error } = await admin
    .from('event_positions')
    .insert({ event_id: id, name: nome.trim() })
    .select('id')
    .single()

  if (error || !funcao) return NextResponse.json({ error: 'Erro ao criar função' }, { status: 500 })

  if (permsValidas.length > 0) {
    await admin.from('event_position_permissions').insert(
      permsValidas.map(p => ({ event_position_id: funcao.id, permission: p }))
    )
  }

  return NextResponse.json({ ok: true, id: funcao.id })
}
