import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header }     from '@/components/layout/Header'
import { EventoForm } from './EventoForm'
import { FileEdit }   from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarEventoPage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/criar-evento')

  const { data: evento } = await supabase
    .from('events')
    .select('id, title, description, category, date_start, date_end, venue_name, zip_code, street, street_number, neighborhood, city, state, complement, status, organizations(owner_id)')
    .eq('id', id)
    .single()

  if (!evento) notFound()

  const org = Array.isArray(evento.organizations)
    ? evento.organizations[0]
    : evento.organizations as { owner_id: string } | null
  if (!org || (org as { owner_id: string }).owner_id !== user.id) notFound()

  // Busca perfil e tipo de pessoa para exibir responsável (PF)
  const [{ data: profile }, { data: promotor }] = await Promise.all([
    supabase.from('profiles').select('full_name, cpf, phone').eq('id', user.id).single(),
    supabase.from('promotor_profiles').select('tipo_pessoa').eq('user_id', user.id).single(),
  ])

  return (
    <div className="min-h-dvh bg-[#070707]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">

        {/* Banner de rascunho */}
        <div className="flex items-center gap-2.5 bg-[#E8B84B]/8 border border-[#E8B84B]/20 rounded-xl px-4 py-3 mb-8">
          <FileEdit size={14} className="text-[#E8B84B] shrink-0" />
          <p className="text-[#E8B84B] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Rascunho — preencha os detalhes e publique quando estiver pronto.
          </p>
        </div>

        {/* Título da página */}
        <div className="mb-8">
          <h1 className="text-2xl text-white mb-1"
              style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
            {evento.title ?? 'Novo evento'}
          </h1>
          <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            As alterações são salvas automaticamente. O evento só fica visível após a publicação.
          </p>
        </div>

        <EventoForm
          eventoId={evento.id}
          tipoPessoa={(promotor?.tipo_pessoa ?? null) as 'pf' | 'pj' | null}
          responsavel={promotor?.tipo_pessoa === 'pf' ? {
            nome:     profile?.full_name ?? '',
            cpf:      profile?.cpf       ?? '',
            telefone: profile?.phone     ?? '',
            email:    user.email         ?? '',
          } : null}
          inicial={{
            titulo:        evento.title         ?? '',
            descricao:     evento.description   ?? '',
            categoria:     evento.category      ?? '',
            dataInicio:    evento.date_start     ?? '',
            dataFim:       evento.date_end       ?? '',
            nomeLocal:     evento.venue_name     ?? '',
            cep:           evento.zip_code       ?? '',
            rua:           evento.street         ?? '',
            numero:        evento.street_number  ?? '',
            bairro:        evento.neighborhood   ?? '',
            cidade:        evento.city           ?? '',
            estado:        evento.state          ?? '',
            complemento:   evento.complement     ?? '',
          }}
        />

      </main>
    </div>
  )
}
