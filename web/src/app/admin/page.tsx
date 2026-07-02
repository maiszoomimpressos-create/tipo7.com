import { createServiceClient } from '@/lib/supabase/server'
import { TrendingUp, Users, Ticket, DollarSign } from 'lucide-react'
import RoadmapClient, { type RoadmapItem } from './RoadmapClient'

function fmt(n: number, currency = false) {
  if (currency) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return n.toLocaleString('pt-BR')
}

// Itens default para a primeira vez (antes de salvar no banco)
const DEFAULT_ITEMS: RoadmapItem[] = [
  // Em andamento
  { id: 'a1', label: 'Nenhum item em andamento no momento', status: 'pendente', bloco: 'andamento' },

  // Próximo sprint
  { id: 's1', label: 'Cupons de desconto para ingressos',                 status: 'pendente', bloco: 'sprint' },
  { id: 's2', label: 'Lotes programados com virada automática de preço',  status: 'pendente', bloco: 'sprint' },
  { id: 's3', label: 'Antecipação de recebíveis para o promotor',         status: 'pendente', bloco: 'sprint' },
  { id: 's4', label: 'Lista de presença (relatório de check-in)',          status: 'pendente', bloco: 'sprint' },
  { id: 's5', label: 'Painel de relatórios financeiros para o promotor',  status: 'pendente', bloco: 'sprint' },
  { id: 's6', label: 'Email automático de carrinho abandonado',            status: 'pendente', bloco: 'sprint' },

  // Funcionalidades avançadas
  { id: 'v1', label: 'Lugar marcado — mapa de assentos (teatros e shows)', status: 'pendente', bloco: 'avancado' },
  { id: 'v2', label: 'Certificados digitais para participantes',           status: 'pendente', bloco: 'avancado' },
  { id: 'v3', label: 'Venda de produtos junto ao ingresso (Tipo7 Store)',  status: 'pendente', bloco: 'avancado' },
  { id: 'v4', label: 'Integrações: RD Station, Google Ads, WhatsApp',     status: 'pendente', bloco: 'avancado' },
  { id: 'v5', label: 'UTM automático para rastreamento de campanhas',      status: 'pendente', bloco: 'avancado' },
  { id: 'v6', label: 'Gerador de mensagem WhatsApp para divulgação',       status: 'pendente', bloco: 'avancado' },

  // App mobile e validação
  { id: 'p1', label: 'App mobile React Native + Expo (comprador)',        status: 'pendente', bloco: 'app' },
  { id: 'p2', label: 'Validação QR 6 camadas — camadas 2–6 (TOTP, device fingerprint, confirmação push)', status: 'pendente', bloco: 'app' },
  { id: 'p3', label: 'Refresh automático de token MP (tokens expiram em ~6 meses)', status: 'pendente', bloco: 'app' },

  // Educação e crescimento
  { id: 'e1', label: 'Calculadora de preço de ingresso para o promotor',  status: 'pendente', bloco: 'educacao' },
  { id: 'e2', label: 'Calculadora de break-even para eventos',            status: 'pendente', bloco: 'educacao' },
  { id: 'e3', label: 'Tipo7 Academy — conteúdo educacional para produtores', status: 'pendente', bloco: 'educacao' },
  { id: 'e4', label: 'Blog / materiais para download para promotores',    status: 'pendente', bloco: 'educacao' },

  // Concluído
  { id: 'c1',  label: 'Checkout Transparente com cartão de crédito (Tipo7)',                        status: 'feito', bloco: 'concluido' },
  { id: 'c2',  label: 'Sistema de regras de taxa (isenção por evento/promotor)',                     status: 'feito', bloco: 'concluido' },
  { id: 'c3',  label: 'Painel admin → Financeiro com submenu Tarifas + Bancos',                     status: 'feito', bloco: 'concluido' },
  { id: 'c4',  label: 'Página de tarifas para o promotor (/minha-area/tarifas)',                    status: 'feito', bloco: 'concluido' },
  { id: 'c5',  label: 'Promotor escolhe quem paga a taxa: ele ou o comprador (estilo Sympla)',       status: 'feito', bloco: 'concluido' },
  { id: 'c6',  label: 'Criação de evento em 4 etapas (info → ingressos → imagens → publicar)',      status: 'feito', bloco: 'concluido' },
  { id: 'c7',  label: 'Checkout PIX transparente (MP Payments API)',                                 status: 'feito', bloco: 'concluido' },
  { id: 'c8',  label: 'Split automático via MP Marketplace OAuth',                                  status: 'feito', bloco: 'concluido' },
  { id: 'c9',  label: 'Scanner QR com câmera para check-in',                                       status: 'feito', bloco: 'concluido' },
  { id: 'c10', label: 'Painel admin completo (dashboard, promotores, eventos, financeiro, equipe)', status: 'feito', bloco: 'concluido' },
  { id: 'c11', label: 'Sistema de bilheteria presencial',                                            status: 'feito', bloco: 'concluido' },
  { id: 'c12', label: 'Login social Google + Facebook',                                              status: 'feito', bloco: 'concluido' },
  { id: 'c13', label: 'Refresh automático de token MP',                                              status: 'feito', bloco: 'concluido' },
  { id: 'c14', label: 'Email de confirmação com QR codes via Resend',                               status: 'feito', bloco: 'concluido' },
  { id: 'c15', label: 'Rate limiting global via Supabase (multi-instância Vercel)',                  status: 'feito', bloco: 'concluido' },
  { id: 'c16', label: 'Varredura de bugs + auditoria de segurança',                                  status: 'feito', bloco: 'concluido' },
]

export default async function AdminHomePage() {
  const admin = createServiceClient()

  const [
    { count: totalEventos },
    { count: eventosAtivos },
    { count: totalPromotores },
    { count: mpConectados },
    { data: orders },
    { data: roadmapSetting },
  ] = await Promise.all([
    admin.from('events').select('*', { count: 'exact', head: true }),
    admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'publicado'),
    admin.from('promotor_profiles').select('*', { count: 'exact', head: true }),
    admin.from('promotor_mp_accounts').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('total').eq('status', 'approved'),
    admin.from('platform_settings').select('value').eq('key', 'roadmap_items').maybeSingle(),
  ])

  const totalRevenue      = (orders ?? []).reduce((s, o) => s + Number(o.total), 0)
  const plataformaRevenue = totalRevenue * 0.1

  let roadmapItems: RoadmapItem[] = DEFAULT_ITEMS
  if (roadmapSetting?.value) {
    try { roadmapItems = JSON.parse(roadmapSetting.value) } catch { /* usa default */ }
  }

  const cards = [
    {
      label: 'Eventos publicados',
      value: fmt(eventosAtivos ?? 0),
      sub:   `${fmt(totalEventos ?? 0)} cadastrados no total`,
      icon:  TrendingUp,
      color: '#E8B84B',
    },
    {
      label: 'Promotores',
      value: fmt(totalPromotores ?? 0),
      sub:   `${fmt(mpConectados ?? 0)} com Mercado Pago conectado`,
      icon:  Users,
      color: '#60a5fa',
    },
    {
      label: 'Volume de vendas',
      value: fmt(totalRevenue, true),
      sub:   'soma dos pedidos aprovados',
      icon:  DollarSign,
      color: '#4ade80',
    },
    {
      label: 'Receita da plataforma',
      value: fmt(plataformaRevenue, true),
      sub:   'estimativa baseada em 10% de taxa',
      icon:  Ticket,
      color: '#f472b6',
    },
  ]

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Visão geral
        </h1>
        <p className="text-[#444] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Métricas gerais da plataforma Tipo7
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map(card => (
          <div key={card.label} className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[#555] text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {card.label}
              </p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${card.color}18` }}>
                <card.icon size={15} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-white text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
              {card.value}
            </p>
            <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── Lista de afazeres interativa ──────────────────────────────── */}
      <div className="mt-10">
        <RoadmapClient initialItems={roadmapItems} />
      </div>
    </div>
  )
}
