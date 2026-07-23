import { ArrowRight, Zap, ShieldCheck, BarChart3 } from 'lucide-react'

const BENEFICIOS = [
  { icon: Zap,         text: 'Publicação imediata'     },
  { icon: ShieldCheck, text: 'Pagamentos protegidos'   },
  { icon: BarChart3,   text: 'Relatórios em tempo real'},
]

export function PromoterCTA() {
  return (
    <section className="px-4 pb-20 max-w-6xl mx-auto">

      <div
        className="relative rounded-3xl overflow-hidden px-8 py-14 md:px-16 md:py-20 flex flex-col items-center text-center gap-8"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,184,75,0.10) 0%, transparent 70%), #0d0d0d',
          border: '1px solid rgba(232,184,75,0.12)',
        }}
      >
        {/* Linha dourada decorativa no topo */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-2/3"
          style={{ background: 'linear-gradient(90deg, transparent, #E8B84B60, transparent)' }}
        />

        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest uppercase"
          style={{
            background:  'rgba(232,184,75,0.10)',
            color:       '#E8B84B',
            border:      '1px solid rgba(232,184,75,0.25)',
            fontFamily:  'var(--font-dm-sans)',
          }}>
          Para promotores
        </span>

        {/* Headline */}
        <div className="flex flex-col gap-3 max-w-xl">
          <h2
            className="text-white text-3xl md:text-4xl leading-tight"
            style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>
            Crie e venda ingressos<br />
            <span style={{ color: '#E8B84B' }}>do seu jeito</span>
          </h2>
          <p
            className="text-[#555] text-sm md:text-base leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Do cadastro à venda em minutos. Gerencie dias, atrações e ingressos com total controle.
          </p>
        </div>

        {/* Benefícios */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {BENEFICIOS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              style={{
                background:  'rgba(255,255,255,0.03)',
                border:      '1px solid rgba(255,255,255,0.07)',
                color:       '#888',
                fontFamily:  'var(--font-dm-sans)',
              }}>
              <Icon size={13} style={{ color: '#E8B84B' }} />
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/minha-area"
          className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-[#070707] hover:brightness-110 transition-all duration-200"
          style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
          Criar meu evento
          <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>

        {/* Linha dourada decorativa no rodapé */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-1/3"
          style={{ background: 'linear-gradient(90deg, transparent, #E8B84B40, transparent)' }}
        />
      </div>

    </section>
  )
}
