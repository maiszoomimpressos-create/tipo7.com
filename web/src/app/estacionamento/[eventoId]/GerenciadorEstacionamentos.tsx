'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Car, Plus, Loader2, Pencil, Trash2, X, Lock, Unlock, Wallet, AlertCircle, ArrowLeft,
  DoorOpen, ChevronDown, ChevronUp, ArrowRightLeft, LogIn, LogOut, Calculator,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalculadoraDinheiro } from '@/components/CalculadoraDinheiro'
import { apiFetchAuth } from '@/lib/apiFetch'
import { BlocoTokenPin, type AcessoCaixa } from '@/components/BlocoTokenPin'

const ACCENT = '#E8B84B'

interface Portao {
  id:    string
  nome:  string
  tipo:  'entrada' | 'saida' | 'ambos'
  ativo: boolean
}

interface Estacionamento {
  id:                    string
  nome:                  string
  cobra_modo:            'gratis' | 'fixo' | 'por_tempo'
  preco_fixo:            number | null
  preco_primeira_hora:   number | null
  preco_hora_adicional:  number | null
  teto_diario:           number | null
  tolerancia_minutos:    number
  controla_saida:        boolean
  vagas_totais:          number | null
  ativo:                 boolean
  estacionamento_portoes: Portao[]
}

const TIPO_PORTAO_LABEL: Record<Portao['tipo'], string> = {
  entrada: 'Só entrada',
  saida:   'Só saída',
  ambos:   'Entrada e saída',
}
const TIPO_PORTAO_ICON: Record<Portao['tipo'], React.ElementType> = {
  entrada: LogIn,
  saida:   LogOut,
  ambos:   ArrowRightLeft,
}

interface Caixa {
  id:                 string
  nome:               string
  status:             'aberto' | 'fechamento_pendente' | 'fechado'
  operadorName:       string | null
  fundo_inicial:      number
  estacionamentoNome: string | null
}

interface Props {
  eventoId:    string
  eventoTitle: string
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MODO_LABEL: Record<Estacionamento['cobra_modo'], string> = {
  gratis:    'Gratuito',
  fixo:      'Preço fixo',
  por_tempo: 'Por tempo',
}

// Campo com rótulo e ícone de atenção — a descrição de uso só aparece ao
// clicar ou passar o mouse em cima do ícone (tooltip), fica escondida por padrão.
function CampoComAjuda({ label, ajuda, children }: { label: string; ajuda: string; children: React.ReactNode }) {
  const [mostrarAjuda, setMostrarAjuda] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 relative">
        <span className="text-[#666] text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
        <button
          type="button"
          onClick={() => setMostrarAjuda(v => !v)}
          onMouseEnter={() => setMostrarAjuda(true)}
          onMouseLeave={() => setMostrarAjuda(false)}
          className="text-[#555] hover:text-[#E8B84B] transition-colors"
        >
          <AlertCircle size={11} />
        </button>
        {mostrarAjuda && (
          <div
            className="absolute left-0 top-full mt-1.5 z-20 w-52 p-2.5 rounded-lg text-[10px] leading-snug text-[#ccc] shadow-xl shadow-black/50"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontFamily: 'var(--font-dm-sans)' }}
          >
            {ajuda}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

// Editor de portões — lista + adicionar/ativar/excluir. Extraído (24/08/2026,
// achado do usuário: editar um estacionamento existente não deixava mexer
// nos portões, só a criação tinha esse fluxo) pra ser reaproveitado tanto na
// lista principal (seção expansível "Portões") quanto dentro do modal de
// Editar — assim editar um local sempre cobre TUDO, portões inclusos, sem
// precisar fechar o modal e ir procurar em outro lugar da tela. Mantém sua
// própria lista local (`portoesIniciais` só serve de valor de partida) e já
// atualiza otimisticamente a cada ação — `onMudou` é só um aviso pro
// componente pai atualizar o fundo dele, não é de onde a lista é lida.
function PortoesEditor({
  eventoId, estacionamentoId, portoesIniciais, onMudou,
}: {
  eventoId: string
  estacionamentoId: string
  portoesIniciais: Portao[]
  onMudou?: () => void
}) {
  const [portoes, setPortoes] = useState<Portao[]>(portoesIniciais)
  const [novoNome, setNovoNome] = useState('')
  const [novoTipo, setNovoTipo] = useState<Portao['tipo']>('ambos')
  const [salvando, setSalvando] = useState(false)

  // Pedido do usuário (24/08/2026): antes só dava pra ativar/desativar ou
  // excluir um portão já criado — pra trocar o nome (ex: digitou errado),
  // só apagando e criando de novo. Agora o lápis abre edição inline
  // (nome + tipo) na própria linha do portão, sem modal novo.
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEditado, setNomeEditado] = useState('')
  const [tipoEditado, setTipoEditado] = useState<Portao['tipo']>('ambos')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  function iniciarEdicao(p: Portao) {
    setEditandoId(p.id); setNomeEditado(p.nome); setTipoEditado(p.tipo)
  }

  const salvarEdicao = async () => {
    if (!editandoId || !nomeEditado.trim()) return
    setSalvandoEdicao(true)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${estacionamentoId}/portoes/${editandoId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nome: nomeEditado.trim(), tipo: tipoEditado }),
      })
      if (res.ok) {
        setPortoes(prev => prev.map(p => p.id === editandoId ? { ...p, nome: nomeEditado.trim(), tipo: tipoEditado } : p))
        setEditandoId(null)
        onMudou?.()
      }
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const criar = async () => {
    if (!novoNome.trim()) return
    setSalvando(true)
    try {
      const res = await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${estacionamentoId}/portoes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nome: novoNome.trim(), tipo: novoTipo }),
      })
      const data = await res.json()
      if (res.ok && data.portao) {
        setPortoes(prev => [...prev, data.portao])
        setNovoNome(''); setNovoTipo('ambos')
        onMudou?.()
      }
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (portaoId: string) => {
    if (!confirm('Excluir este portão?')) return
    await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${estacionamentoId}/portoes/${portaoId}`, { method: 'DELETE' })
    setPortoes(prev => prev.filter(p => p.id !== portaoId))
    onMudou?.()
  }

  const toggleAtivo = async (portao: Portao) => {
    await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${estacionamentoId}/portoes/${portao.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ativo: !portao.ativo }),
    })
    setPortoes(prev => prev.map(p => p.id === portao.id ? { ...p, ativo: !p.ativo } : p))
    onMudou?.()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[#444] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Portões — carros podem sair por qualquer um do tipo saída/ambos, não precisa ser o mesmo da entrada
      </p>

      {portoes.length === 0 && (
        <p className="text-[#444] text-xs py-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Nenhum portão cadastrado — sem portões, qualquer atendente com permissão pode operar livremente.
        </p>
      )}

      {portoes.map(p => {
        const Icon = TIPO_PORTAO_ICON[p.tipo]

        if (editandoId === p.id) {
          return (
            <div key={p.id} className="flex flex-col gap-1.5 bg-[#111] border border-[#E8B84B]/35 rounded-lg p-2.5">
              <input type="text" value={nomeEditado} autoFocus
                onChange={ev => setNomeEditado(ev.target.value)}
                className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40"
                style={{ fontFamily: 'var(--font-dm-sans)' }} />
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'entrada' as const, label: 'Só entrada' },
                  { value: 'saida'   as const, label: 'Só saída'   },
                  { value: 'ambos'   as const, label: 'Ambos'      },
                ]).map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => setTipoEditado(value)}
                    className={cn(
                      'py-1.5 rounded-lg border text-[10px] font-medium transition-all',
                      tipoEditado === value ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#0d0d0d] border-[#1c1c1c] text-[#777]'
                    )}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setEditandoId(null)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] text-[#777] border border-[#1c1c1c] hover:text-white transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Cancelar
                </button>
                <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao || !nomeEditado.trim()}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-[#070707] disabled:opacity-30"
                  style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  {salvandoEdicao ? <Loader2 size={11} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          )
        }

        return (
          <div key={p.id} className="flex items-center justify-between gap-2 bg-[#111] border border-[#1c1c1c] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={13} className="text-[#E8B84B] shrink-0" />
              <div className="min-w-0">
                <p className="text-white text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {p.nome} {!p.ativo && <span className="text-[#444]">(inativo)</span>}
                </p>
                <p className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {TIPO_PORTAO_LABEL[p.tipo]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => iniciarEdicao(p)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1a1a1a] transition-colors"
                title="Editar nome/tipo">
                <Pencil size={11} className="text-[#444] hover:text-white" />
              </button>
              <button type="button" onClick={() => toggleAtivo(p)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1a1a1a] transition-colors"
                title={p.ativo ? 'Desativar' : 'Ativar'}>
                {p.ativo ? <Unlock size={11} className="text-green-400" /> : <Lock size={11} className="text-[#555]" />}
              </button>
              <button type="button" onClick={() => excluir(p.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1a1a1a] transition-colors">
                <Trash2 size={11} className="text-[#444] hover:text-red-400" />
              </button>
            </div>
          </div>
        )
      })}

      <div className="flex flex-col gap-1.5 mt-1">
        <input type="text" placeholder="Nome do portão (ex: Portão A)" value={novoNome}
          onChange={ev => setNovoNome(ev.target.value)}
          className="bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
          style={{ fontFamily: 'var(--font-dm-sans)' }} />
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { value: 'entrada' as const, label: 'Só entrada' },
            { value: 'saida'   as const, label: 'Só saída'   },
            { value: 'ambos'   as const, label: 'Ambos'      },
          ]).map(({ value, label }) => (
            <button key={value} type="button" onClick={() => setNovoTipo(value)}
              className={cn(
                'py-2 rounded-lg border text-[11px] font-medium transition-all',
                novoTipo === value ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#111] border-[#1c1c1c] text-[#777]'
              )}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={criar} disabled={salvando || !novoNome.trim()}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#070707] disabled:opacity-30"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> Adicionar portão</>}
        </button>
      </div>
    </div>
  )
}

export function GerenciadorEstacionamentos({ eventoId, eventoTitle }: Props) {
  const router = useRouter()
  const [estacionamentos, setEstacionamentos] = useState<Estacionamento[]>([])
  const [caixas, setCaixas]                   = useState<Caixa[]>([])
  const [carregando, setCarregando]           = useState(true)
  const [modalAberto, setModalAberto]         = useState(false)
  // Achado real (21/08/2026, pedido do usuário): o botão de lápis na linha
  // de cada local estava mapeado pra handleToggleAtivo() (só liga/desliga)
  // — não existia jeito nenhum de editar preço/vagas depois de criado, só
  // via banco direto. Agora o lápis abre o EstacionamentoModal em modo
  // edição (mesmo componente do "Novo", pré-preenchido) e o ativo/inativo
  // ganhou um botão próprio (cadeado, mesmo padrão já usado nos portões).
  const [modalEditando, setModalEditando]     = useState<Estacionamento | null>(null)
  const [modalCaixaAberto, setModalCaixaAberto] = useState(false)
  const [erro, setErro]                       = useState<string | null>(null)
  const [portoesAbertos, setPortoesAbertos]   = useState<Set<string>>(new Set())

  const carregar = useCallback(async () => {
    const [resEst, resCaixas] = await Promise.all([
      apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos`),
      apiFetchAuth(`/api/eventos/${eventoId}/caixas`),
    ])
    const dataEst    = await resEst.json()
    const dataCaixas = await resCaixas.json()
    setEstacionamentos(dataEst.estacionamentos ?? [])
    setCaixas(dataCaixas.caixas ?? [])
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregar() }, [carregar])

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este estacionamento?')) return
    const res = await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao excluir'); return }
    await carregar()
  }

  const handleToggleAtivo = async (e: Estacionamento) => {
    await apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${e.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ativo: !e.ativo }),
    })
    await carregar()
  }

  const togglePortoesAbertos = (estId: string) => {
    setPortoesAbertos(prev => {
      const next = new Set(prev)
      if (next.has(estId)) next.delete(estId); else next.add(estId)
      return next
    })
  }

  const handleFecharCaixa = async (caixaId: string) => {
    const dinheiro = prompt('Quanto dinheiro foi contado na gaveta? (R$)')
    if (dinheiro === null) return
    const res = await apiFetchAuth('/api/caixas/fechar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ caixaId, dinheiro_contado: Number(dinheiro) || 0, ingressos_devolvidos: 0 }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao fechar caixa'); return }
    await carregar()
  }

  // Pedido do usuário (20/08/2026): caixa aberto por engano (ex: evento
  // vencido barrado depois de já ter criado um) não tinha como desfazer sem
  // mexer no banco. Backend só deixa se o caixa nunca teve movimentação
  // nenhuma — se tiver, devolve erro explicando que precisa fechar em vez
  // de excluir.
  const handleExcluirCaixa = async (caixaId: string, nome: string) => {
    if (!confirm(`Excluir o caixa "${nome}"? Só funciona se ele nunca teve movimentação — não dá pra desfazer.`)) return
    const res = await apiFetchAuth(`/api/caixas/${caixaId}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null) as { error?: string; message?: string } | null
    if (!res.ok) { setErro(data?.message ?? data?.error ?? 'Erro ao excluir caixa'); return }
    await carregar()
  }

  const handleValidarCaixa = async (caixaId: string) => {
    const res = await apiFetchAuth('/api/caixas/validar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ caixaId }),
    })
    const data = await res.json()
    if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao validar caixa'); return }
    await carregar()
  }

  return (
    <div className="min-h-dvh bg-[#070707]">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-2xl font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-outfit)' }}>
              <Car size={22} className="text-[#E8B84B]" />
              Estacionamento
            </h1>
            <p className="text-[#555] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{eventoTitle}</p>
          </div>
          <button type="button" onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shrink-0 transition-colors"
            style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
            <ArrowLeft size={13} /> Voltar
          </button>
        </div>

        {erro && <p className="text-red-400 text-xs">{erro}</p>}
        {carregando && <Loader2 size={20} className="animate-spin text-[#E8B84B] mx-auto my-10" />}

        {!carregando && (
          <>
            {/* Estacionamentos configurados */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[#666] text-xs uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Locais configurados
                </p>
                <button type="button" onClick={() => setModalAberto(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#070707]"
                  style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  <Plus size={13} /> Novo
                </button>
              </div>

              {estacionamentos.length === 0 && (
                <p className="text-[#444] text-sm text-center py-8">Nenhum estacionamento configurado ainda.</p>
              )}

              {estacionamentos.map(e => {
                const portoesAberto = portoesAbertos.has(e.id)
                const portoes       = e.estacionamento_portoes ?? []
                return (
                <div key={e.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {e.nome} {!e.ativo && <span className="text-[#444] text-xs">(inativo)</span>}
                      </p>
                      <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {MODO_LABEL[e.cobra_modo]}
                        {e.cobra_modo === 'fixo' && ` · ${formatBRL(Number(e.preco_fixo ?? 0))}`}
                        {e.cobra_modo === 'por_tempo' && ` · 1ª hora ${formatBRL(Number(e.preco_primeira_hora ?? 0))} + ${formatBRL(Number(e.preco_hora_adicional ?? 0))}/h`}
                        {e.vagas_totais ? ` · ${e.vagas_totais} vagas` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => togglePortoesAbertos(e.id)}
                        className="flex items-center gap-1 px-2 h-8 rounded-lg text-[11px] text-[#555] hover:text-[#E8B84B] border border-[#1e1e1e] transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        <DoorOpen size={13} /> {portoes.length}
                        {portoesAberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <button type="button" onClick={() => handleToggleAtivo(e)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#E8B84B] border border-[#1e1e1e] transition-colors"
                        title={e.ativo ? 'Desativar' : 'Ativar'}>
                        {e.ativo ? <Unlock size={13} className="text-green-400" /> : <Lock size={13} />}
                      </button>
                      <button type="button" onClick={() => setModalEditando(e)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#E8B84B] border border-[#1e1e1e] transition-colors"
                        title="Editar preço, vagas e outras configurações">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => handleExcluir(e.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-red-400 border border-[#1e1e1e] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {portoesAberto && (
                    <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
                      <PortoesEditor
                        eventoId={eventoId}
                        estacionamentoId={e.id}
                        portoesIniciais={portoes}
                        onMudou={carregar}
                      />
                    </div>
                  )}
                </div>
                )
              })}
            </section>

            {/* Caixas */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[#666] text-xs uppercase tracking-widest font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Caixas
                </p>
                <button type="button" onClick={() => setModalCaixaAberto(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <Wallet size={13} /> Abrir caixa
                </button>
              </div>

              {caixas.length === 0 && (
                <p className="text-[#444] text-sm text-center py-4">Nenhum caixa aberto ainda — só é necessário se algum local cobrar.</p>
              )}

              {caixas.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {c.status === 'aberto'
                        ? <Unlock size={12} className="text-green-400" />
                        : c.status === 'fechamento_pendente'
                          ? <Wallet size={12} style={{ color: ACCENT }} />
                          : <Lock size={12} className="text-[#555]" />}
                      {c.nome}
                      {c.estacionamentoNome && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-normal" style={{ background: '#111', color: '#888' }}>
                          {c.estacionamentoNome}
                        </span>
                      )}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {c.operadorName ?? 'Sem operador designado'} · fundo {formatBRL(Number(c.fundo_inicial))}
                      {c.status === 'fechamento_pendente' && ' · aguardando validação'}
                    </p>
                  </div>
                  {c.status === 'aberto' && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleExcluirCaixa(c.id, c.nome)}
                        className="px-3 py-2 rounded-lg text-xs font-medium border border-[#222] text-[#555] hover:border-red-400/40 hover:text-red-400 transition-colors">
                        Excluir
                      </button>
                      <button type="button" onClick={() => handleFecharCaixa(c.id)}
                        className="px-3 py-2 rounded-lg text-xs font-medium border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors">
                        Fechar
                      </button>
                    </div>
                  )}
                  {c.status === 'fechamento_pendente' && (
                    <button type="button" onClick={() => handleValidarCaixa(c.id)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-[#070707]"
                      style={{ background: ACCENT }}>
                      Validar
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>

      {modalAberto && (
        <EstacionamentoModal
          eventoId={eventoId}
          onFechar={() => setModalAberto(false)}
          onSalvo={async () => { setModalAberto(false); await carregar() }}
          onPortaoMudou={carregar}
        />
      )}

      {modalEditando && (
        <EstacionamentoModal
          eventoId={eventoId}
          estacionamento={modalEditando}
          onFechar={() => setModalEditando(null)}
          onSalvo={async () => { setModalEditando(null); await carregar() }}
          onPortaoMudou={carregar}
        />
      )}

      {modalCaixaAberto && (
        <AbrirCaixaModal
          eventoId={eventoId}
          estacionamentos={estacionamentos}
          onFechar={() => setModalCaixaAberto(false)}
          onAberto={async () => { setModalCaixaAberto(false); await carregar() }}
        />
      )}
    </div>
  )
}

// Criação E edição do local de estacionamento — mesmo formulário nos dois
// casos (achado real 21/08/2026: só existia criação; editar preço/vagas
// depois de criado exigia mexer direto no banco). Quando `estacionamento` é
// passado, pré-preenche os campos e salva via PATCH; sem ele, cria via POST.
function EstacionamentoModal({ eventoId, estacionamento, onFechar, onSalvo, onPortaoMudou }: {
  eventoId: string
  estacionamento?: Estacionamento
  onFechar: () => void
  onSalvo: () => void
  // Achado do usuário (24/08/2026): editar um local existente não deixava
  // mexer nos portões dele, só a criação tinha isso — quem quisesse
  // adicionar/tirar portão de um estacionamento já criado tinha que fechar
  // o modal e ir procurar na seção expansível da lista principal. Agora o
  // modal de editar já mostra o PortoesEditor embutido; esse callback
  // avisa o componente pai (fora do modal) pra atualizar o fundo dele
  // também, sem fechar o modal a cada portão mexido (diferente de onSalvo).
  onPortaoMudou?: () => void
}) {
  const editando = !!estacionamento
  const [nome, setNome] = useState(estacionamento?.nome ?? '')
  const [cobraModo, setCobraModo] = useState<Estacionamento['cobra_modo']>(estacionamento?.cobra_modo ?? 'gratis')
  const [precoFixo, setPrecoFixo] = useState(String(estacionamento?.preco_fixo ?? ''))
  const [precoPrimeiraHora, setPrecoPrimeiraHora] = useState(String(estacionamento?.preco_primeira_hora ?? ''))
  const [precoHoraAdicional, setPrecoHoraAdicional] = useState(String(estacionamento?.preco_hora_adicional ?? ''))
  const [tetoDiario, setTetoDiario] = useState(String(estacionamento?.teto_diario ?? ''))
  const [toleranciaMinutos, setToleranciaMinutos] = useState(String(estacionamento?.tolerancia_minutos ?? '10'))
  const [vagasTotais, setVagasTotais] = useState(String(estacionamento?.vagas_totais ?? ''))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Pedido do usuário (24/08/2026): antes, criar o local e criar os portões
  // eram 2 momentos separados — salvava o estacionamento, depois tinha que
  // abrir de novo (seção "Locais configurados") e clicar "Novo portão" um
  // de cada vez. Agora pergunta de cara, só na CRIAÇÃO (`!editando` — um
  // local já existente continua tendo os portões geridos na lista
  // principal, não faz sentido duplicar aqui): "quantos portões esse local
  // vai ter?" — 1 nem pergunta o tipo (só faz sentido ser entrada+saída no
  // mesmo portão); 2+ mostra uma linha por portão, nome + tipo, já dentro
  // deste formulário.
  const [qtdPortoes, setQtdPortoes] = useState(1)
  const [portoesNovos, setPortoesNovos] = useState<{ nome: string; tipo: Portao['tipo'] }[]>([
    { nome: 'Portão único', tipo: 'ambos' },
  ])

  function mudarQtdPortoes(qtd: number) {
    setQtdPortoes(qtd)
    setPortoesNovos(prev => {
      if (qtd === 1) return [{ nome: 'Portão único', tipo: 'ambos' }]
      const base = prev.length === 1 && prev[0].nome === 'Portão único' ? [] : prev
      const next = [...base]
      while (next.length < qtd) next.push({ nome: `Portão ${next.length + 1}`, tipo: 'ambos' })
      return next.slice(0, qtd)
    })
  }

  const salvar = async () => {
    if (!nome.trim()) return
    setSalvando(true); setErro(null)
    try {
      const url    = editando ? `/api/eventos/${eventoId}/estacionamentos/${estacionamento.id}` : `/api/eventos/${eventoId}/estacionamentos`
      const method = editando ? 'PATCH' : 'POST'
      const res = await apiFetchAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nome:                nome.trim(),
          cobraModo,
          precoFixo:           precoFixo          ? Number(precoFixo)          : null,
          precoPrimeiraHora:   precoPrimeiraHora  ? Number(precoPrimeiraHora)  : null,
          precoHoraAdicional:  precoHoraAdicional ? Number(precoHoraAdicional) : null,
          tetoDiario:          tetoDiario         ? Number(tetoDiario)         : null,
          toleranciaMinutos:   Number(toleranciaMinutos) || 10,
          vagasTotais:         vagasTotais        ? Number(vagasTotais)        : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? (editando ? 'Erro ao salvar' : 'Erro ao criar')); return }

      // Só na criação: já cria os portões definidos acima, em paralelo.
      // Falha em criar um portão não desfaz o local (já foi salvo) — só
      // deixa de mostrar erro pra não travar o fluxo; o usuário sempre pode
      // adicionar/corrigir portões depois na lista principal.
      if (!editando && data.estacionamento?.id) {
        const novosValidos = portoesNovos.filter(p => p.nome.trim())
        await Promise.all(novosValidos.map(p =>
          apiFetchAuth(`/api/eventos/${eventoId}/estacionamentos/${data.estacionamento.id}/portoes`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nome: p.nome.trim(), tipo: p.tipo }),
          }).catch(() => null)
        ))
      }

      onSalvo()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {editando ? `Editar ${estacionamento.nome}` : 'Novo estacionamento'}
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input type="text" placeholder="Nome (ex: Estacionamento A) *" value={nome}
            onChange={e => setNome(e.target.value)} className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />

          <p className="text-[#444] text-[11px] uppercase tracking-wider">Como cobra</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'gratis'    as const, label: 'Grátis'    },
              { value: 'fixo'      as const, label: 'Fixo'      },
              { value: 'por_tempo' as const, label: 'Por tempo' },
            ]).map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setCobraModo(value)}
                className={cn(
                  'py-2.5 rounded-xl border text-xs font-medium transition-all',
                  cobraModo === value ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#111] border-[#1c1c1c] text-[#777]'
                )}>
                {label}
              </button>
            ))}
          </div>

          {cobraModo === 'fixo' && (
            <CampoComAjuda label="Preço fixo" ajuda="Valor único cobrado do motorista, não importa quanto tempo o carro fica estacionado.">
              <input type="number" placeholder="R$ 0,00" value={precoFixo}
                onChange={e => setPrecoFixo(e.target.value)} min="0" step="0.01"
                className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </CampoComAjuda>
          )}

          {cobraModo === 'por_tempo' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <CampoComAjuda label="1ª hora" ajuda="Valor cobrado pelos primeiros 60 minutos de permanência.">
                  <input type="number" placeholder="R$ 0,00" value={precoPrimeiraHora}
                    onChange={e => setPrecoPrimeiraHora(e.target.value)} min="0" step="0.01"
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                </CampoComAjuda>
                <CampoComAjuda label="Hora adicional" ajuda="Valor cobrado a cada hora extra, após a primeira.">
                  <input type="number" placeholder="R$ 0,00" value={precoHoraAdicional}
                    onChange={e => setPrecoHoraAdicional(e.target.value)} min="0" step="0.01"
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                </CampoComAjuda>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <CampoComAjuda label="Teto diário (opcional)" ajuda="Valor máximo cobrado no dia, mesmo que o carro fique estacionado por muito mais tempo.">
                  <input type="number" placeholder="R$ (opcional)" value={tetoDiario}
                    onChange={e => setTetoDiario(e.target.value)} min="0" step="0.01"
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                </CampoComAjuda>
                <CampoComAjuda label="Tolerância (min)" ajuda="Minutos de carência grátis assim que o carro entra — sai sem pagar nada dentro desse tempo.">
                  <input type="number" placeholder="10" value={toleranciaMinutos}
                    onChange={e => setToleranciaMinutos(e.target.value)} min="0"
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                </CampoComAjuda>
              </div>
            </>
          )}

          <CampoComAjuda label="Vagas totais (opcional)" ajuda="Limite de vagas físicas do local. Deixe em branco se não quiser controlar lotação.">
            <input type="number" placeholder="Ex: 50" value={vagasTotais}
              onChange={e => setVagasTotais(e.target.value)} min="1"
              className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          </CampoComAjuda>

          {!editando && (
            <>
              <p className="text-[#444] text-[11px] uppercase tracking-wider">Quantos portões esse local vai ter?</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(qtd => (
                  <button key={qtd} type="button" onClick={() => mudarQtdPortoes(qtd)}
                    className={cn(
                      'py-2.5 rounded-xl border text-xs font-medium transition-all',
                      qtdPortoes === qtd ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#111] border-[#1c1c1c] text-[#777]'
                    )}>
                    {qtd}
                  </button>
                ))}
              </div>

              {qtdPortoes === 1 ? (
                <p className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Um portão só — entrada e saída juntas nele, não precisa escolher tipo.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {portoesNovos.map((p, i) => (
                    <div key={i} className="flex flex-col gap-1.5 bg-[#111] border border-[#1c1c1c] rounded-lg p-2.5">
                      <input type="text" value={p.nome}
                        onChange={e => setPortoesNovos(prev => prev.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                        placeholder={`Nome do portão ${i + 1}`}
                        className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40"
                        style={{ fontFamily: 'var(--font-dm-sans)' }} />
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          { value: 'entrada' as const, label: 'Só entrada' },
                          { value: 'saida'   as const, label: 'Só saída'   },
                          { value: 'ambos'   as const, label: 'Ambos'      },
                        ]).map(({ value, label }) => (
                          <button key={value} type="button"
                            onClick={() => setPortoesNovos(prev => prev.map((x, j) => j === i ? { ...x, tipo: value } : x))}
                            className={cn(
                              'py-1.5 rounded-lg border text-[10px] font-medium transition-all',
                              p.tipo === value ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#0d0d0d] border-[#1c1c1c] text-[#777]'
                            )}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {editando && (
            <>
              <div className="h-px bg-[#1c1c1c] my-1" />
              <PortoesEditor
                eventoId={eventoId}
                estacionamentoId={estacionamento.id}
                portoesIniciais={estacionamento.estacionamento_portoes}
                onMudou={onPortaoMudou}
              />
            </>
          )}
        </div>

        {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando || !nome.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : (editando ? 'Salvar' : 'Criar')}
        </button>
      </div>
    </div>
  )
}

function AbrirCaixaModal({ eventoId, estacionamentos, onFechar, onAberto }: {
  eventoId: string
  estacionamentos: Estacionamento[]
  onFechar: () => void
  onAberto: () => void
}) {
  const [nome, setNome] = useState('Caixa 1')
  const [fundoInicial, setFundoInicial] = useState(0)
  const [calcAberta, setCalcAberta] = useState(false)
  const [operador, setOperador] = useState('')
  const [estacionamentoId, setEstacionamentoId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Sangria (20/08/2026) — ver project_token_pin_acesso_caixa na memória.
  // Só vem preenchido quando o dono ainda não tem PIN configurado.
  const [acessoOwner, setAcessoOwner] = useState<AcessoCaixa | null>(null)

  const salvar = async () => {
    if (!nome.trim()) return
    setSalvando(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/estacionamento/${eventoId}/abrir-caixa`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nome:                    nome.trim(),
          fundoInicial,
          operadorEmailOuCodigo:   operador.trim() || undefined,
          estacionamentoId:        estacionamentoId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao abrir caixa'); return }
      if (data.owner_acesso?.precisa_criar_pin) {
        setAcessoOwner({
          staffId:     data.owner_acesso.staff_id,
          token:       data.owner_acesso.token,
          pinDefinido: false,
        })
      } else {
        onAberto()
      }
    } finally {
      setSalvando(false)
    }
  }

  if (acessoOwner) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
          <p className="text-white text-sm font-medium mb-1">Seu acesso pra autorizar sangria</p>
          <p className="text-[#666] text-xs mb-4">
            Você (organizador) usa esse token+PIN pra confirmar retiradas de dinheiro de qualquer caixa deste evento.
          </p>
          <BlocoTokenPin
            acesso={acessoOwner}
            onPinAtualizado={() => setAcessoOwner(a => a ? { ...a, pinDefinido: true } : a)}
          />
          <button
            type="button" onClick={onAberto}
            className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: '#E8B84B' }}
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Abrir caixa</p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input type="text" placeholder="Nome do caixa *" value={nome}
            onChange={e => setNome(e.target.value)} className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />
          <div>
            <label className="text-[#555] text-[10px] uppercase tracking-wider block mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Fundo inicial
            </label>
            <button type="button" onClick={() => setCalcAberta(true)}
              className="w-full flex items-center justify-between bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm transition-colors hover:border-[#E8B84B]/40"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <span style={{ color: fundoInicial > 0 ? '#fff' : '#444' }}>
                {formatBRL(fundoInicial)}
              </span>
              <Calculator size={14} style={{ color: ACCENT }} />
            </button>
          </div>
          {estacionamentos.length > 1 && (
            <select value={estacionamentoId} onChange={e => setEstacionamentoId(e.target.value)}
              className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <option value="">Caixa geral (não vinculado a um local)</option>
              {estacionamentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          )}
          <input type="text" placeholder="E-mail ou código T7-USR do operador (opcional)" value={operador}
            onChange={e => setOperador(e.target.value)} className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            O operador precisa já estar convidado como equipe ativa com a permissão de estacionamento neste evento.
          </p>
        </div>

        {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando || !nome.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : 'Abrir caixa'}
        </button>
      </div>

      {calcAberta && (
        <CalculadoraDinheiro
          label={`Fundo inicial — ${nome || 'caixa'}`}
          valor={fundoInicial}
          onChange={setFundoInicial}
          onClose={() => setCalcAberta(false)}
        />
      )}
    </div>
  )
}
