'use client'

// Modal de tutorial (22/08/2026, pedido do usuário) — passo a passo de como
// montar um evento, escrito e editável direto aqui (sem link externo, sem
// vídeo). Primeira peça do "formato melhor" combinado no fim da sessão de
// 21/08 — conteúdo deve ser revisado/expandido conforme o usuário for
// testando e apontando o que falta (mesmo espírito do botão de ajuda "!"
// já aplicado em PainelEquipe.tsx). Componente compartilhado — usado tanto
// em GerenciarSidebar.tsx (evento/[id]/gerenciar) quanto em AdminSidebar.tsx
// (painel da equipe Tipo7, mesmo conteúdo, botão sem destaque visual lá).
import { X, Layers, Ticket, Users, Car, Settings, ShoppingBag, BarChart2 } from 'lucide-react'

const ACCENT = '#E8B84B'

const PASSOS = [
  {
    icon: Layers,
    titulo: 'Estrutura',
    texto: 'Comece por aqui: nome do evento, data, local, banner e — se o evento tiver mais de um dia — os dias específicos.',
  },
  {
    icon: Ticket,
    titulo: 'Ingressos',
    texto: 'Crie os tipos de ingresso (Pista, VIP, Camarote...) com preço e quantidade disponível. Dá pra configurar lotes de preço progressivo dentro do mesmo ingresso, se quiser.',
  },
  {
    icon: Users,
    titulo: 'Equipe',
    texto: 'Convide quem vai te ajudar no dia do evento e defina a função de cada um (Scanner, Caixa, Estacionamento...) — a função decide o que a pessoa pode acessar.',
  },
  {
    icon: ShoppingBag,
    titulo: 'Bilheteria (caixas)',
    texto: 'No dia do evento, abra os caixas aqui pra vender ingresso presencialmente (dinheiro, PIX ou cartão) e controlar o troco.',
  },
  {
    icon: Car,
    titulo: 'Estacionamento',
    texto: 'Se o local do evento tiver estacionamento, configure aqui: preço, quantidade de vagas e portões de entrada/saída. Só use se fizer sentido pro seu evento.',
  },
  {
    icon: Settings,
    titulo: 'Configurações',
    texto: 'Ajustes do evento: pausar vendas online automaticamente perto da data, encerrar ou adiar o evento.',
  },
  {
    icon: BarChart2,
    titulo: 'Relatórios',
    texto: 'Acompanhe vendas e presença em tempo real, a qualquer momento antes ou durante o evento.',
  },
]

export function TutorialModal({ onFechar }: { onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: '#0d0d0d', border: `1px solid ${ACCENT}30` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Como montar seu evento
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {PASSOS.map((p, i) => {
            const Icon = p.icon
            return (
              <div key={p.titulo} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
                  style={{ background: `${ACCENT}15` }}
                >
                  <Icon size={13} style={{ color: ACCENT }} />
                  <span
                    className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-[#070707]"
                    style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div>
                  <p className="text-white text-xs font-semibold mb-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.titulo}
                  </p>
                  <p className="text-[#888] text-[11px] leading-snug" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.texto}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4" style={{ borderTop: '1px solid #1a1a1a' }}>
          <button
            type="button"
            onClick={onFechar}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
