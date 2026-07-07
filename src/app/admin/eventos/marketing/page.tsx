import { createServiceClient } from '@/lib/supabase/server'
import { Megaphone, ExternalLink, QrCode, Share2, BarChart2, Link as LinkIcon } from 'lucide-react'

export default async function MarketingPage() {
  const admin = createServiceClient()

  // Eventos publicados com mais ingressos vendidos
  const { data: eventos } = await admin
    .from('events')
    .select('id, title, date_start, city')
    .eq('is_published', true)
    .gte('date_start', new Date().toISOString())
    .order('date_start', { ascending: true })
    .limit(20)

  const ACCENT = '#E8B84B'

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Megaphone size={20} style={{ color: ACCENT }} />
          <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
            Marketing
          </h1>
        </div>
        <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Ferramentas de divulgação dos eventos publicados na plataforma.
        </p>
      </div>

      {/* Ferramentas rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: LinkIcon,  label: 'Links de evento',    desc: 'Copie e compartilhe links diretos para a página de compra.' },
          { icon: QrCode,    label: 'QR Codes',           desc: 'Baixe QR codes prontos para impressão em materiais físicos.' },
          { icon: Share2,    label: 'Redes sociais',      desc: 'Compartilhe diretamente no WhatsApp, Instagram e outros.' },
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

      {/* Lista de eventos publicados */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={14} className="text-[#555]" />
          <h2 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Próximos eventos publicados
          </h2>
        </div>

        {!eventos || eventos.length === 0 ? (
          <div
            className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
            style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
          >
            <Megaphone size={32} className="text-[#222]" />
            <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nenhum evento publicado no futuro.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {eventos.map(e => {
              const eventUrl = `https://tipo7.com/evento/${e.id}`
              const waUrl = `https://wa.me/?text=${encodeURIComponent(`Garanta seu ingresso! 🎟️ ${e.title} — ${eventUrl}`)}`
              return (
                <div
                  key={e.id}
                  className="rounded-2xl px-5 py-4 flex items-center gap-4"
                  style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {e.title}
                    </p>
                    <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {e.date_start
                        ? new Date(e.date_start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                      {e.city ? ` · ${e.city}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/evento/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                      style={{
                        background: `${ACCENT}10`,
                        border:     `1px solid ${ACCENT}20`,
                        color:      ACCENT,
                        fontFamily: 'var(--font-dm-sans)',
                      }}
                    >
                      <ExternalLink size={11} /> Ver página
                    </a>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                      style={{
                        background: 'rgba(37,211,102,0.08)',
                        border:     '1px solid rgba(37,211,102,0.20)',
                        color:      '#25D366',
                        fontFamily: 'var(--font-dm-sans)',
                      }}
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
  )
}
