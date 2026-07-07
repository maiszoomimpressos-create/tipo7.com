import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Header }     from '@/components/layout/Header'
import { EventoForm } from './EventoForm'
import { MPConnect }  from './MPConnect'
import { FileEdit, ImagePlus } from 'lucide-react'

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
    .select('id, title, description, category, date_start, date_end, venue_name, venue_id, zip_code, street, street_number, neighborhood, city, state, complement, capacity, status, banner_url, fee_mode, organizations(owner_id)')
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

        {/* ── Capa do evento ─────────────────────────────────────────────────── */}
        {(evento as unknown as { banner_url: string | null }).banner_url ? (
          <div className="relative w-full rounded-2xl overflow-hidden mb-8 group" style={{ aspectRatio: '780/420' }}>
            <img
              src={(evento as unknown as { banner_url: string }).banner_url}
              alt={evento.title ?? 'Banner do evento'}
              className="w-full h-full object-cover"
            />
            {/* Overlay gradiente com título */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
              <div>
                <p className="text-white text-xs font-medium uppercase tracking-widest opacity-60 mb-1"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {evento.category ?? 'Evento'}
                </p>
                <h1 className="text-white text-xl font-semibold leading-tight"
                    style={{ fontFamily: 'var(--font-outfit)' }}>
                  {evento.title ?? 'Novo evento'}
                </h1>
              </div>
              <a
                href={`/criar-evento/${id}/imagens`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#E8B84B', border: '1px solid rgba(232,184,75,0.3)', fontFamily: 'var(--font-dm-sans)', backdropFilter: 'blur(4px)' }}
              >
                <ImagePlus size={12} /> Trocar foto
              </a>
            </div>
          </div>
        ) : (
          <a
            href={`/criar-evento/${id}/imagens`}
            className="flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed border-[#1e1e1e] hover:border-[#E8B84B]/30 hover:bg-[#E8B84B]/3 transition-all mb-8 py-10 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#1c1c1c] flex items-center justify-center group-hover:border-[#E8B84B]/30 transition-colors">
              <ImagePlus size={20} className="text-[#333] group-hover:text-[#E8B84B]/60 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[#555] text-sm font-medium group-hover:text-[#888] transition-colors"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {evento.title ?? 'Novo evento'}
              </p>
              <p className="text-[#333] text-xs mt-0.5 group-hover:text-[#444] transition-colors"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Clique para adicionar a foto do evento
              </p>
            </div>
          </a>
        )}

        {/* Banner de rascunho */}
        <div className="flex items-center gap-2.5 bg-[#E8B84B]/8 border border-[#E8B84B]/20 rounded-xl px-4 py-3 mb-8">
          <FileEdit size={14} className="text-[#E8B84B] shrink-0" />
          <p className="text-[#E8B84B] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Rascunho — preencha os detalhes e publique quando estiver pronto.
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
            venueId:       (evento as unknown as { venue_id: string | null }).venue_id ?? null,
            cep:           evento.zip_code       ?? '',
            rua:           evento.street         ?? '',
            numero:        evento.street_number  ?? '',
            bairro:        evento.neighborhood   ?? '',
            cidade:        evento.city           ?? '',
            estado:        evento.state          ?? '',
            complemento:   evento.complement     ?? '',
            capacidade:    (evento as unknown as { capacity: number | null }).capacity?.toString() ?? '',
            feeMode:       ((evento as unknown as { fee_mode: string | null }).fee_mode ?? 'promotor') as 'promotor' | 'comprador' | 'mista',
          }}
        />

        <MPConnect />

      </main>
    </div>
  )
}
