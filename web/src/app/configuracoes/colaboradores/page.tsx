// Painel de colaboradores — visível pra qualquer sócio/proprietário de
// uma organização, mostra os pedidos de equipe mandados pra eventos de
// TODAS as organizações que o usuário administra (não só uma). Só leitura
// aqui — convidar/gerenciar continua na tela de Equipe de cada evento; a
// própria pessoa convidada aceita/recusa em /trabalhos.
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthUser }    from '@/lib/auth/server'
import { redirect }       from 'next/navigation'
import { Header }         from '@/components/layout/Header'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { ColaboradoresClient, type ColaboradorRow } from './ColaboradoresClient'

export default async function ColaboradoresPage() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/auth?next=/configuracoes/colaboradores')

  // Organizações que o usuário administra ativamente
  const { data: orgAdminRows } = await supabase
    .from('organization_admins')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'ativo')

  const orgIds = (orgAdminRows ?? []).map(r => r.organization_id)

  const { data: eventos } = orgIds.length > 0
    ? await supabase
        .from('events')
        .select('id, title, date_start, date_end')
        .in('organization_id', orgIds)
    : { data: [] }

  const eventIds = (eventos ?? []).map(e => e.id)
  const eventMap = new Map((eventos ?? []).map(e => [e.id, e]))

  const { data: staffRows } = eventIds.length > 0
    ? await supabase
        .from('event_staff')
        .select('id, event_id, user_id, status, event_positions(name)')
        .in('event_id', eventIds)
        .in('status', ['pending', 'active'])
    : { data: [] }

  const userIds = Array.from(new Set((staffRows ?? []).map(r => r.user_id)))

  const admin = createServiceClient()
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, user_code').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null; user_code: string | null }[] }

  const { data: emailRowsRaw } = userIds.length > 0
    ? await admin.rpc('get_emails_by_ids', { p_ids: userIds })
    : { data: [] }
  const emailRows = (emailRowsRaw ?? []) as { id: string; email: string }[]

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const emailMap   = new Map(emailRows.map(e => [e.id, e.email]))

  const hoje = new Date().toISOString().slice(0, 10)

  const linhas: ColaboradorRow[] = (staffRows ?? []).flatMap(r => {
    const evento = eventMap.get(r.event_id)
    if (!evento) return []
    const perfil = profileMap.get(r.user_id)
    const posicao = Array.isArray(r.event_positions) ? r.event_positions[0] : r.event_positions

    // Aba: pendente = ainda não respondeu. Ativo = evento acontecendo hoje
    // (entre date_start e date_end). Aceito = já aceitou, evento no futuro.
    // Evento já encerrado não entra em nenhuma aba.
    let aba: ColaboradorRow['aba'] | null = null
    if (r.status === 'pending') {
      aba = 'pendentes'
    } else if (r.status === 'active') {
      const inicio = evento.date_start
      const fim    = evento.date_end || evento.date_start
      if (inicio && fim && inicio <= hoje && hoje <= fim) aba = 'ativos'
      else if (inicio && inicio > hoje) aba = 'aceitos'
    }
    if (!aba) return []

    return [{
      id:       r.id,
      nome:     perfil?.full_name ?? null,
      email:    emailMap.get(r.user_id) ?? null,
      codigo:   perfil?.user_code ?? null,
      funcao:   (posicao as { name: string } | null)?.name ?? null,
      evento:   evento.title ?? 'Evento',
      aba,
    }]
  })

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="max-w-4xl mx-auto px-4 py-12 w-full">

          <div className="mb-8">
            <h1
              className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
            >
              Colaboradores
            </h1>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Pedidos de equipe mandados pra eventos das organizações que você administra.
            </p>
          </div>

          <ColaboradoresClient linhas={linhas} />

        </main>
      </PromoterLayout>
    </div>
  )
}
