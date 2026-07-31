'use client'

// Modal de criação de evento. Não pergunta mais PF/PJ nem coleta CNPJ aqui —
// todo mundo já é, por padrão, uma organização type='promotora' vinculada ao
// próprio perfil (pessoa física). Atrelar um CNPJ à organização é uma ação
// separada e opcional, feita em /perfil na aba "Dados de promotor"
// (PromotorForm.tsx) — nunca uma pergunta obrigatória pra criar evento.
// "Estabelecimento" também não existe mais aqui como tipo de organização —
// lugar físico é um venue com administrador (venue_admins), atribuído na
// tela de local do evento (EventoForm.tsx), não neste modal.
// Fluxo:
//   Etapa 1: o que você vai gerenciar aqui (nicho, só perguntado 1x)
//   Etapa 2: nome do evento
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2, Loader2, X, ArrowRight, CheckCircle2,
  Car, Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProfileData {
  phone:         string
  zip_code:      string
  street:        string
  street_number: string
  neighborhood:  string
  city:          string
  state:         string
  complement:    string
}

interface OrgAtual {
  id:            string
  name:          string
  type:          'promotora' | 'estabelecimento'
  cnpj:          string | null
  nome_fantasia: string | null
}

interface Props {
  promotorId:   string | null
  nomeUsuario:  string
  organizacoes: OrgAtual[]
  profile:      ProfileData
  onFechar:     () => void
}

type Stage =
  | 'org-tipo'       // Etapa: o que vai gerenciar aqui (nicho) — só quando não há organização nenhuma ainda
  | 'escolher-org'    // Etapa: qual organização vai criar esse evento — só quando há mais de uma
  | 'nome-evento'    // Etapa final: nome do evento

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

// ── O que esse evento vai vender — decide quais módulos ficam disponíveis ──
function SeletorModulos({
  ingressos, estacionamento, onIngressos, onEstacionamento,
}: {
  ingressos:        boolean
  estacionamento:   boolean
  onIngressos:      (v: boolean) => void
  onEstacionamento: (v: boolean) => void
}) {
  const opcoes = [
    { icon: Ticket, label: 'Ingressos',     desc: 'Vender ingressos online e presencial', checked: ingressos,      onChange: onIngressos },
    { icon: Car,    label: 'Estacionamento', desc: 'Vagas pagas no local',                  checked: estacionamento, onChange: onEstacionamento },
  ]
  return (
    <div className="mb-4">
      <p className="text-[#444] text-[11px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        O que esse evento vai ter
      </p>
      <div className="flex flex-col gap-2">
        {opcoes.map(({ icon: Icon, label, desc, checked, onChange }) => (
          <button key={label} type="button" onClick={() => onChange(!checked)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
              checked ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35' : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
            )}>
            <div className={cn(
              'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
              checked ? 'bg-[#E8B84B] border-[#E8B84B]' : 'border-[#333]'
            )}>
              {checked && <CheckCircle2 size={13} className="text-[#070707]" />}
            </div>
            <Icon size={15} className={checked ? 'text-[#E8B84B]' : 'text-[#444]'} />
            <div>
              <p className={cn('text-xs font-medium', checked ? 'text-white' : 'text-[#777]')}
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
              <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TipoPessoaModal({ nomeUsuario, organizacoes, onFechar }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const router    = useRouter()

  // Sem organização nenhuma → pergunta o nicho (primeira vez). Uma só →
  // pula direto pro nome do evento. Mais de uma (ex: várias casas de show
  // com CNPJ próprio) → precisa escolher qual delas está criando esse
  // evento, senão não tem como saber pra qual organização o evento vai.
  const orgInicial = organizacoes.length === 1 ? organizacoes[0].id : null
  const [stage, setStage] = useState<Stage>(
    organizacoes.length === 0 ? 'org-tipo' : organizacoes.length > 1 ? 'escolher-org' : 'nome-evento'
  )
  const [nicho,        setNicho]        = useState<'eventos' | 'estacionamento' | 'ambos' | ''>('')
  const [orgId,        setOrgId]        = useState<string | null>(orgInicial)
  const orgSelecionada = organizacoes.find(o => o.id === orgId) ?? null

  const [savingFinal, setSavingFinal] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  const [nomeEvento, setNomeEvento] = useState('')

  // Módulos de venda do evento — Ingressos nasce ligado (comportamento histórico)
  const [moduloIngressos,      setModuloIngressos]      = useState(true)
  const [moduloEstacionamento, setModuloEstacionamento] = useState(false)
  const nenhumModuloSelecionado = !moduloIngressos && !moduloEstacionamento

  // ── Cria a organização (só quando a pessoa não tem nenhuma ainda, via
  //     /api/organizations — gera código e já cria o organization_admins
  //     junto, coisa que insert direto do client não consegue, RLS não
  //     libera) ou só atualiza o nicho de uma já escolhida. Nunca mexe em
  //     name/cnpj/nome_fantasia de uma org já existente — isso é
  //     responsabilidade exclusiva de /perfil (PromotorForm.tsx) ──
  const salvarOrganizacao = async (): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado')

    let finalOrgId = orgId
    if (!finalOrgId) {
      const res  = await fetch('/api/organizations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razaoSocial: nomeUsuario, nicho: nicho || undefined }),
      })
      const data = await res.json() as { organizacao?: { id: string }; error?: string }
      if (!res.ok || !data.organizacao) throw new Error(data.error ?? 'Falha ao criar organização')
      finalOrgId = data.organizacao.id
    } else if (nicho) {
      await supabase.from('organizations').update({ nicho }).eq('id', finalOrgId)
    }

    setOrgId(finalOrgId)
    return finalOrgId
  }

  // ── Etapa 1: nicho define o valor inicial dos módulos, depois segue pro nome ──
  const handleEscolhaTipo = () => {
    if (nicho) {
      setModuloIngressos(nicho !== 'estacionamento')
      setModuloEstacionamento(nicho === 'estacionamento' || nicho === 'ambos')
    }
    setStage('nome-evento')
  }

  // Liga o selo informativo "Estacionamento" (event_attributes) quando o módulo é ativado —
  // mostra na página pública do evento, mas não tem nenhuma lógica de venda por trás.
  const vincularAtributoEstacionamento = async (eventoId: string) => {
    const { data: attr } = await supabase
      .from('event_attributes').select('id').eq('name', 'Estacionamento').maybeSingle()
    if (attr) {
      await supabase.from('event_attribute_values')
        .upsert({ event_id: eventoId, attribute_id: attr.id }, { onConflict: 'event_id,attribute_id' })
    }
  }

  // ── Etapa final: grava organização (se preciso) + evento ──
  const handleSalvarNomeEvento = async () => {
    if (!user || !nomeEvento.trim() || nenhumModuloSelecionado) return
    setSavingFinal(true); setErro(null)
    try {
      const finalOrgId = await salvarOrganizacao()

      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({
          organization_id:       finalOrgId,
          created_by:            user.id,
          status:                'rascunho',
          title:                 nomeEvento.trim(),
          modulo_ingressos:      moduloIngressos,
          modulo_estacionamento: moduloEstacionamento,
        })
        .select('id').single()
      if (errEvento) throw errEvento
      if (moduloEstacionamento) await vincularAtributoEstacionamento(evento.id)

      router.push(`/criar-evento/${evento.id}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingFinal(false)
    }
  }

  // ── Step indicator ─────────────────────────────────────────────────────
  const stagesSequence: Stage[] =
    organizacoes.length === 0 ? ['org-tipo', 'nome-evento']
    : organizacoes.length > 1 ? ['escolher-org', 'nome-evento']
    : ['nome-evento']
  const stageIndex = stagesSequence.indexOf(stage)

  const StepDots = () => (
    <div className="flex items-center gap-2">
      {stagesSequence.map((s, i) => {
        const done    = i < stageIndex
        const current = i === stageIndex
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
              current ? 'bg-[#E8B84B] text-[#070707]'
                : done ? 'bg-green-500 text-white'
                : 'bg-[#1c1c1c] text-[#444]'
            )}>
              {done ? <CheckCircle2 size={12} /> : i + 1}
            </div>
            {i < stagesSequence.length - 1 && (
              <div className={cn('w-8 h-px transition-colors', done ? 'bg-green-500' : 'bg-[#1c1c1c]')} />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">

        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

        <div className="p-6">

          {/* Step dots */}
          <div className="flex items-center justify-between mb-5">
            <StepDots />
            <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ══ ETAPA 1: nicho ══════════════════════════════════════════ */}
          {stage === 'org-tipo' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  O que você vai gerenciar aqui
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Pode ser um evento pontual ou recorrente — não precisa ser profissional.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                {([
                  { value: 'eventos'        as const, label: 'Eventos'        },
                  { value: 'estacionamento' as const, label: 'Estacionamento' },
                  { value: 'ambos'          as const, label: 'Ambos'          },
                ]).map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setNicho(value)}
                    className={cn(
                      'py-2.5 rounded-xl border text-xs font-medium transition-all',
                      nicho === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                        : 'bg-[#111] border-[#1c1c1c] text-[#777] hover:border-[#2a2a2a]'
                    )}>
                    {label}
                  </button>
                ))}
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleEscolhaTipo}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                <span>Próximo</span><ArrowRight size={14} />
              </button>
            </>
          )}

          {/* ══ ETAPA: qual organização — só quando há mais de uma ══════ */}
          {stage === 'escolher-org' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Qual organização vai criar esse evento?
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Você administra mais de uma — escolha pra não emitir no lugar errado.
                </p>
              </div>

              <div className="flex flex-col gap-2 mb-5">
                {organizacoes.map(o => (
                  <button key={o.id} type="button" onClick={() => setOrgId(o.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      orgId === o.id ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35' : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                    )}>
                    <Building2 size={15} className={orgId === o.id ? 'text-[#E8B84B]' : 'text-[#444]'} />
                    <span className={cn('text-sm font-medium', orgId === o.id ? 'text-white' : 'text-[#777]')}
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {o.nome_fantasia || o.name}
                    </span>
                  </button>
                ))}
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" disabled={!orgId} onClick={() => setStage('nome-evento')}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                <span>Próximo</span><ArrowRight size={14} />
              </button>
            </>
          )}

          {/* ══ ETAPA final: nome do evento ═══════════════════════════════ */}
          {stage === 'nome-evento' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {orgSelecionada ? 'Novo evento' : 'Quase lá!'}
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Qual é o nome do seu evento?
                </p>
              </div>

              {/* Banner: organização que vai criar o evento */}
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <Building2 size={13} className="shrink-0 text-[#555]" />
                <div>
                  <p className="text-[#aaa] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {orgSelecionada?.nome_fantasia || orgSelecionada?.name || nomeUsuario}
                  </p>
                  <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {orgSelecionada ? 'dados já salvos' : 'rascunho criado'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />
              </div>

              <SeletorModulos
                ingressos={moduloIngressos} estacionamento={moduloEstacionamento}
                onIngressos={setModuloIngressos} onEstacionamento={setModuloEstacionamento}
              />
              {nenhumModuloSelecionado && (
                <p className="text-red-400 text-xs text-center mb-3">Selecione ao menos um item acima</p>
              )}

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleSalvarNomeEvento}
                disabled={savingFinal || !nomeEvento.trim() || nenhumModuloSelecionado}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <><span>Criar evento</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
