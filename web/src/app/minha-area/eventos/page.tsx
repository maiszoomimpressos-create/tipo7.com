import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { CalendarPlus, CalendarRange, ExternalLink, Pencil } from 'lucide-react'

const ACCENT = '#E8B84B'

const STATUS: Record<string, { label: string; color: string }> = {
  rascunho:  { label: 'Rascunho',  color: '#555'    },
  publicado: { label: 'Publicado', color: '#22c55e' },
  encerrado: { label: 'Encerrado', color: '#E8B84B' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
}

export default async function MeusEventosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/minha-area/eventos')

  const admin = createServiceClient()

  const { data: orgsData } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  const orgIds = (orgsData ?? []).map(o => o.id)
  if (orgIds.length === 0) redirect('/criar-evento')

  const { data: eventosRaw } = await admin
    .from('events')
    .select('id, title, status, date_start, banner_url, category, venue_name, city')
    .in('organization_id', orgIds)
    .order('created_at', { ascending: false })

  const eventos = eventosRaw ?? []

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col">
      <Header />
      <PromoterLayout>
        <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
                Meus eventos
              </h1>
              <p className="text-[#555] text-sm mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {eventos.length} evento{eventos.length !== 1 ? 's' : ''} no total
              </p>
            </div>
            <a
              href="/criar-evento"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
              style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
            >
              <CalendarPlus size={15} />
              Criar evento
            </a>
          </div>

          {/* Lista de eventos */}
          {eventos.length === 0 ? (
            <div
              className="rounded-2xl p-12 flex flex-col items-center gap-4 text-center"
              style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
            >
              <CalendarRange size={40} className="text-[#222]" />
              <div>
                <p className="text-white text-base font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Nenhum evento ainda
                </p>
                <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Crie seu primeiro evento e comece a vender ingressos.
                </p>
              </div>
              <a
                href="/criar-evento"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] mt-2"
                style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
              >
                <CalendarPlus size={15} />
                Criar evento
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {eventos.map(e => {
                const st = STATUS[e.status ?? 'rascunho'] ?? STATUS.rascunho
                const data = e.date_start
                  ? new Date(e.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                  : null
                return (
                  <div
                    key={e.id}
                    className="rounded-2xl flex items-center gap-4 overflow-hidden"
                    style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-20 shrink-0 overflow-hidden" style={{ background: '#111' }}>
                      {e.banner_url
                        ? <img src={e.banner_url} alt={e.title ?? ''} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <CalendarRange size={20} className="text-[#2a2a2a]" />
                          </div>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-3 pr-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: st.color, fontFamily: 'var(--font-dm-sans)' }}
                        >
                          {st.label}
                        </span>
                        {e.category && (
                          <span className="text-[#333] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            · {e.category}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {e.title ?? 'Sem título'}
                      </p>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {[data, e.venue_name ?? e.city].filter(Boolean).join(' · ')}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 pr-4 shrink-0">
                      <a
                        href={`/criar-evento/${e.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                        style={{ background: '#111', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
                        title="Editar"
                      >
                        <Pencil size={11} /> Editar
                      </a>
                      <a
                        href={`/evento/${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                        style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                        title="Ver página"
                      >
                        <ExternalLink size={11} /> Ver
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </main>
        <Footer />
      </PromoterLayout>
    </div>
  )
}
