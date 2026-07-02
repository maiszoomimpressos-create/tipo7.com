import { createServiceClient } from '@/lib/supabase/server'
import { TrendingUp, Users, Ticket, DollarSign, Circle, CheckCircle2, Clock } from 'lucide-react'

function fmt(n: number, currency = false) {
  if (currency) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return n.toLocaleString('pt-BR')
}

type TodoStatus = 'feito' | 'andamento' | 'pendente'

function TodoBloco({ titulo, cor, itens }: {
  titulo: string
  cor:    string
  itens:  { label: string; status: TodoStatus }[]
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <div className="px-5 py-3.5 border-b border-[#141414] flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
        <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {titulo}
        </p>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${cor}18`, color: cor, fontFamily: 'var(--font-dm-sans)' }}>
          {itens.length}
        </span>
      </div>
      <div className="px-5 py-3 flex flex-col gap-0.5">
        {itens.map(item => (
          <div key={item.label} className="flex items-start gap-3 py-2 border-b border-[#0f0f0f] last:border-0">
            {item.status === 'feito'     && <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[#555]" />}
            {item.status === 'andamento' && <Clock        size={14} className="shrink-0 mt-0.5" style={{ color: '#E8B84B' }} />}
            {item.status === 'pendente'  && <Circle       size={14} className="shrink-0 mt-0.5 text-[#2a2a2a]" />}
            <p
              className="text-sm leading-snug"
              style={{
                fontFamily:      'var(--font-dm-sans)',
                color:           item.status === 'feito' ? '#333' : item.status === 'andamento' ? '#bbb' : '#555',
                textDecoration:  item.status === 'feito' ? 'line-through' : 'none',
              }}
            >
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function AdminHomePage() {
  const admin = createServiceClient()

  const [
    { count: totalEventos },
    { count: eventosAtivos },
    { count: totalPromotores },
    { count: mpConectados },
    { data: orders },
  ] = await Promise.all([
    admin.from('events').select('*', { count: 'exact', head: true }),
    admin.from('events').select('*', { count: 'exact', head: true }).eq('status', 'publicado'),
    admin.from('promotor_profiles').select('*', { count: 'exact', head: true }),
    admin.from('promotor_mp_accounts').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('total').eq('status', 'approved'),
  ])

  const totalRevenue      = (orders ?? []).reduce((s, o) => s + Number(o.total), 0)
  const plataformaRevenue = totalRevenue * 0.1

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

      {/* ── Lista de afazeres ─────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="mb-5">
          <h2 className="text-lg text-white font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Lista de afazeres
          </h2>
          <p className="text-[#333] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Funcionalidades mapeadas para o Tipo7 — baseado na análise competitiva
          </p>
        </div>

        <div className="flex flex-col gap-4">

          {/* Bloco: Em andamento */}
          <TodoBloco titulo="Em andamento" cor="#E8B84B" itens={[
            { label: 'Checkout Transparente com cartão de crédito (Tipo7)', status: 'andamento' },
            { label: 'Sistema de regras de taxa (isenção por evento/promotor)', status: 'andamento' },
            { label: 'Painel admin → Financeiro com submenu Tarifas + Bancos', status: 'andamento' },
            { label: 'Página de tarifas para o promotor (/minha-area/tarifas)', status: 'andamento' },
          ]} />

          {/* Bloco: Pós-lançamento imediato */}
          <TodoBloco titulo="Próximo sprint" cor="#60a5fa" itens={[
            { label: 'Cupons de desconto para ingressos', status: 'pendente' },
            { label: 'Lotes programados com virada automática de preço', status: 'pendente' },
            { label: 'Antecipação de recebíveis para o promotor', status: 'pendente' },
            { label: 'Lista de presença (relatório de check-in)', status: 'pendente' },
            { label: 'Painel de relatórios financeiros para o promotor', status: 'pendente' },
            { label: 'Email automático de carrinho abandonado', status: 'pendente' },
          ]} />

          {/* Bloco: Funcionalidades avançadas */}
          <TodoBloco titulo="Funcionalidades avançadas" cor="#a78bfa" itens={[
            { label: 'Lugar marcado — mapa de assentos (teatros e shows)', status: 'pendente' },
            { label: 'Certificados digitais para participantes', status: 'pendente' },
            { label: 'Venda de produtos junto ao ingresso (Tipo7 Store)', status: 'pendente' },
            { label: 'Integrações: RD Station, Google Ads, WhatsApp', status: 'pendente' },
            { label: 'UTM automático para rastreamento de campanhas', status: 'pendente' },
            { label: 'Gerador de mensagem WhatsApp para divulgação', status: 'pendente' },
          ]} />

          {/* Bloco: App e validação */}
          <TodoBloco titulo="App mobile e validação" cor="#4ade80" itens={[
            { label: 'App mobile React Native + Expo (comprador)', status: 'pendente' },
            { label: 'Validação QR 6 camadas — camadas 2–6 (TOTP, device fingerprint, confirmação push)', status: 'pendente' },
            { label: 'Refresh automático de token MP (tokens expiram em ~6 meses)', status: 'pendente' },
          ]} />

          {/* Bloco: Educação e crescimento */}
          <TodoBloco titulo="Educação e crescimento" cor="#f472b6" itens={[
            { label: 'Calculadora de preço de ingresso para o promotor', status: 'pendente' },
            { label: 'Calculadora de break-even para eventos', status: 'pendente' },
            { label: 'Tipo7 Academy — conteúdo educacional para produtores', status: 'pendente' },
            { label: 'Blog / materiais para download para promotores', status: 'pendente' },
          ]} />

          {/* Bloco: Já feito */}
          <TodoBloco titulo="Concluído" cor="#555" itens={[
            { label: 'Criação de evento em 4 etapas (info → ingressos → imagens → publicar)', status: 'feito' },
            { label: 'Checkout PIX transparente (MP Payments API)', status: 'feito' },
            { label: 'Split automático via MP Marketplace OAuth', status: 'feito' },
            { label: 'Scanner QR com câmera para check-in', status: 'feito' },
            { label: 'Painel admin completo (dashboard, promotores, eventos, financeiro, equipe)', status: 'feito' },
            { label: 'Sistema de bilheteria presencial', status: 'feito' },
            { label: 'Login social Google + Facebook', status: 'feito' },
            { label: 'Refresh automático de token MP', status: 'feito' },
            { label: 'Email de confirmação com QR codes via Resend', status: 'feito' },
            { label: 'Rate limiting global via Supabase (multi-instância Vercel)', status: 'feito' },
            { label: 'Varredura de bugs + auditoria de segurança', status: 'feito' },
          ]} />

        </div>
      </div>
    </div>
  )
}
