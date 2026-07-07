import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PromoterLayout } from '@/components/layout/PromoterLayout'
import { Megaphone, ExternalLink, QrCode, Share2, Copy, Link as LinkIcon } from 'lucide-react'

const ACCENT = '#E8B84B'

export default async function MarketingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth?next=/minha-area/marketing')

  const admin = createServiceClient()

  // Organizações do promotor
  const { data: orgs } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)

  const orgIds = (orgs ?? []).map(o => o.id)

  // Eventos publicados do promotor
  const { data: eventos } = orgIds.length > 0
    ? await admin
        .from('events')
        .select('id, title, date_start, venue_name, city, cover_url, is_published')
        .in('organization_id', orgIds)
        .eq('is_published', true)
        .order('date_start', { ascending: false })
        .limit(20)
    : { data: [] }

  return (
    <>
      <Header />
      <PromoterLayout>
        <div className="p-6 md:p-8 max-w-4xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Megaphone size={20} style={{ color: ACCENT }} />
              <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
                Marketing
              </h1>
            </div>
            <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Ferramentas de divulgação dos seus eventos.
            </p>
          </div>

          {/* Cards de ferramentas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: LinkIcon, label: 'Links diretos',  desc: 'Copie e compartilhe o link de compra de cada evento.' },
              { icon: QrCode,   label: 'QR Codes',       desc: 'Baixe o QR code do evento para usar em materiais físicos.' },
              { icon: Share2,   label: 'Redes sociais',  desc: 'Compartilhe diretamente no WhatsApp com mensagem pronta.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}20` }}
                >
                  <Icon size={18} style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {label}
                  </p>
                  <p className="text-[#444] text-xs mt-1 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Lista de eventos */}
          <div>
            <h2 className="text-white text-base font-semibold mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
              Seus eventos publicados
            </h2>

            {!eventos || eventos.length === 0 ? (
              <div
                className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
                style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
              >
                <Megaphone size={32} className="text-[#222]" />
                <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Você ainda não tem eventos publicados.
                </p>
                <a
                  href="/criar-evento"
                  className="text-xs font-medium px-4 py-2 rounded-xl transition-all"
                  style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                >
                  Criar evento →
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {eventos.map(e => {
                  const url   = `https://tipo7.com/evento/${e.id}`
                  const waUrl = `https://wa.me/?text=${encodeURIComponent(`Garanta seu ingresso! 🎟️ ${e.title} — ${url}`)}`
                  return (
                    <div
                      key={e.id}
                      className="rounded-2xl px-5 py-4 flex items-center gap-4"
                      style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                    >
                      {/* Cover thumbnail */}
                      <div
                        className="w-12 h-12 rounded-xl shrink-0 overflow-hidden"
                        style={{ background: '#111' }}
                      >
                        {e.cover_url
                          ? <img src={e.cover_url} alt={e.title ?? ''} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <Megaphone size={16} className="text-[#333]" />
                            </div>
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {e.title}
                        </p>
                        <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {e.date_start
                            ? new Date(e.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                          {e.venue_name ? ` · ${e.venue_name}` : e.city ? ` · ${e.city}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/evento/${e.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                          style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                        >
                          <ExternalLink size={11} /> Ver
                        </a>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                          style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.20)', color: '#25D366', fontFamily: 'var(--font-dm-sans)' }}
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </PromoterLayout>
      <Footer />
    </>
  )
}
