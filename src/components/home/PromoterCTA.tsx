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
        className="relative rounded-3xl overflow-hidden px-8 py-16 md:px-16 md:py-24 flex flex-col items-center text-center gap-8"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 50% -10%, rgba(251,86,7,0.20) 0%, transparent 65%),
            radial-gradient(ellipse 60% 40% at 85% 110%, rgba(131,56,236,0.14) 0%, transparent 55%),
            #2d1f1b
          `,
          border: '1px solid rgba(251,86,7,0.22)',
          boxShadow: '0 0 80px rgba(251,86,7,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Linha laranja decorativa no topo */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-3/4"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(251,86,7,0.55), transparent)' }}
        />

        {/* Brilho de canto */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,86,7,0.07), transparent 65%)' }}
        />

        {/* Badge */}
        <span
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-semibold tracking-widest uppercase"
          style={{
            background: 'rgba(251,86,7,0.12)',
            color:      '#fb5607',
            border:     '1px solid rgba(251,86,7,0.30)',
            fontFamily: 'var(--font-dm-sans)',
          }}>
          Para promotores
        </span>

        {/* Headline */}
        <div className="flex flex-col gap-3 max-w-xl">
          <h2
            className="text-3xl md:text-4xl leading-tight"
            style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
            Crie e venda ingressos<br />
            <span style={{ color: '#fb5607' }}>do seu jeito</span>
          </h2>
          <p
            className="text-sm md:text-base leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)', color: 'rgba(255,255,255,0.52)' }}>
            Do cadastro à venda em minutos. Gerencie dias, atrações e ingressos com total controle.
          </p>
        </div>

        {/* Benefícios */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {BENEFICIOS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.09)',
                color:      'rgba(255,255,255,0.62)',
                fontFamily: 'var(--font-dm-sans)',
              }}>
              <Icon size={13} style={{ color: '#fb5607' }} />
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/criar-evento"
          className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #fb5607 0%, #f97316 100%)',
            color: '#fff',
            fontFamily: 'var(--font-dm-sans)',
            boxShadow: '0 4px 24px rgba(251,86,7,0.38)',
          }}>
          Criar meu evento
          <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>

        {/* Linha laranja decorativa no rodapé */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-1/3"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(251,86,7,0.38), transparent)' }}
        />
      </div>

    </section>
  )
}
