'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingBag, Plus, Loader2, Pencil, Trash2, X, Lock, Unlock, Wallet, AlertCircle, ArrowLeft, Calculator,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalculadoraDinheiro } from '@/components/CalculadoraDinheiro'
import { apiFetchAuth } from '@/lib/apiFetch'
import { BlocoTokenPin, type AcessoCaixa } from '@/components/BlocoTokenPin'
import { TokenParaOperador } from '@/components/TokenParaOperador'

const ACCENT = '#E8B84B'

interface Bilheteria {
  id:    string
  nome:  string
  ativo: boolean
}

interface Caixa {
  id:            string
  nome:          string
  status:        'aberto' | 'fechamento_pendente' | 'fechado'
  operadorName:  string | null
  fundoInicial:  number
  bilheteriaId:  string | null
}

interface Props {
  eventoId:    string
  eventoTitle: string
  // Mesmo raciocínio de GerenciadorEstacionamentos.tsx — embutido esconde
  // header/Voltar próprios quando usado dentro do shell de /gerenciar.
  embutido?:   boolean
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Pedido do usuário (03/09/2026): copiar o mesmo método já usado no
// Estacionamento (GerenciadorEstacionamentos.tsx) — dar nome a um local e
// dizer de cara quantos "sub-itens" ele vai ter. Lá é "quantos portões?";
// aqui é "quantos caixas essa bilheteria vai ter?". Bem mais simples que o
// do Estacionamento: bilheteria não tem preço/vagas — todo local vende o
// mesmo catálogo de ingressos do evento, decisão já registrada em
// caixas.service.ts.
export function GerenciadorBilheterias({ eventoId, eventoTitle, embutido }: Props) {
  const router = useRouter()
  const [bilheterias, setBilheterias]   = useState<Bilheteria[]>([])
  const [caixas, setCaixas]             = useState<Caixa[]>([])
  const [carregando, setCarregando]     = useState(true)
  const [modalAberto, setModalAberto]   = useState(false)
  const [modalEditando, setModalEditando] = useState<Bilheteria | null>(null)
  const [modalCaixaAberto, setModalCaixaAberto] = useState<Bilheteria | null>(null)
  const [erro, setErro]                 = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [resBil, resCaixas] = await Promise.all([
      apiFetchAuth(`/api/eventos/${eventoId}/bilheterias`),
      apiFetchAuth(`/api/eventos/${eventoId}/caixas`),
    ])
    const dataBil    = await resBil.json()
    const dataCaixas = await resCaixas.json()
    setBilheterias(dataBil.bilheterias ?? [])
    setCaixas(dataCaixas.caixas ?? [])
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregar() }, [carregar])

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este local de bilheteria?')) return
    const res = await apiFetchAuth(`/api/eventos/${eventoId}/bilheterias/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao excluir'); return }
    await carregar()
  }

  const handleToggleAtivo = async (b: Bilheteria) => {
    await apiFetchAuth(`/api/eventos/${eventoId}/bilheterias/${b.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ativo: !b.ativo }),
    })
    await carregar()
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

  const conteudo = (
    <>
    <div className={embutido ? 'flex flex-col gap-8' : 'max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8'}>

        {!embutido && (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-white text-2xl font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-outfit)' }}>
                <ShoppingBag size={22} className="text-[#E8B84B]" />
                Bilheteria
              </h1>
              <p className="text-[#555] text-sm mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{eventoTitle}</p>
            </div>
            <button type="button" onClick={() => router.back()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs shrink-0 transition-colors"
              style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}>
              <ArrowLeft size={13} /> Voltar
            </button>
          </div>
        )}

        {erro && <p className="text-red-400 text-xs">{erro}</p>}
        {carregando && <Loader2 size={20} className="animate-spin text-[#E8B84B] mx-auto my-10" />}

        {!carregando && (
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

            {bilheterias.length === 0 && (
              <p className="text-[#444] text-sm text-center py-8">Nenhum local de bilheteria configurado ainda.</p>
            )}

            {bilheterias.map(b => (
              <div key={b.id} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {b.nome} {!b.ativo && <span className="text-[#444] text-xs">(inativo)</span>}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {caixas.filter(c => c.bilheteriaId === b.id).length} caixa(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => handleToggleAtivo(b)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#E8B84B] border border-[#1e1e1e] transition-colors"
                      title={b.ativo ? 'Desativar' : 'Ativar'}>
                      {b.ativo ? <Unlock size={13} className="text-green-400" /> : <Lock size={13} />}
                    </button>
                    <button type="button" onClick={() => setModalEditando(b)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-[#E8B84B] border border-[#1e1e1e] transition-colors"
                      title="Editar nome">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleExcluir(b.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#555] hover:text-red-400 border border-[#1e1e1e] transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex flex-col gap-2" style={{ borderTop: '1px solid #1a1a1a' }}>
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-[#444] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Caixas deste local
                    </p>
                    <button type="button" onClick={() => setModalCaixaAberto(b)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <Wallet size={11} /> Abrir caixa
                    </button>
                  </div>

                  {caixas.filter(c => c.bilheteriaId === b.id).length === 0 && (
                    <p className="text-[#444] text-xs py-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Nenhum caixa aberto ainda neste local.
                    </p>
                  )}

                  {caixas.filter(c => c.bilheteriaId === b.id).map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 bg-[#111] border border-[#1c1c1c] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-white text-xs font-medium flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {c.status === 'aberto'
                            ? <Unlock size={11} className="text-green-400" />
                            : c.status === 'fechamento_pendente'
                              ? <Wallet size={11} style={{ color: ACCENT }} />
                              : <Lock size={11} className="text-[#555]" />}
                          {c.nome}
                        </p>
                        <p className="text-[#555] text-[11px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                          {c.operadorName ?? 'Sem operador designado'} · fundo {formatBRL(Number(c.fundoInicial))}
                          {c.status === 'fechamento_pendente' && ' · aguardando validação'}
                          {c.status === 'fechado' && ' · fechado'}
                        </p>
                      </div>
                      {c.status === 'aberto' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => handleExcluirCaixa(c.id, c.nome)}
                            className="px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#222] text-[#555] hover:border-red-400/40 hover:text-red-400 transition-colors">
                            Excluir
                          </button>
                          <button type="button" onClick={() => handleFecharCaixa(c.id)}
                            className="px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors">
                            Fechar
                          </button>
                        </div>
                      )}
                      {c.status === 'fechamento_pendente' && (
                        <button type="button" onClick={() => handleValidarCaixa(c.id)}
                          className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#070707] shrink-0"
                          style={{ background: ACCENT }}>
                          Validar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Caixas sem local vinculado (caixa "geral" de bilheteria,
                sem bilheteriaId nem estacionamentoId) — mesmo tratamento
                do Estacionamento, mostrado à parte pra não confundir. */}
            {caixas.some(c => !c.bilheteriaId && !(c as unknown as { estacionamentoId?: string }).estacionamentoId) && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-[#444] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Caixas sem local vinculado
                </p>
                {caixas.filter(c => !c.bilheteriaId && !(c as unknown as { estacionamentoId?: string }).estacionamentoId).map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3 opacity-70">
                    <p className="text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {c.nome} · {c.operadorName ?? 'Sem operador designado'} · fundo {formatBRL(Number(c.fundoInicial))}
                      {c.status === 'fechado' && ' · fechado'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {modalAberto && (
        <BilheteriaModal
          eventoId={eventoId}
          onFechar={() => setModalAberto(false)}
          onSalvo={async () => { setModalAberto(false); await carregar() }}
        />
      )}

      {modalEditando && (
        <BilheteriaModal
          eventoId={eventoId}
          bilheteria={modalEditando}
          onFechar={() => setModalEditando(null)}
          onSalvo={async () => { setModalEditando(null); await carregar() }}
        />
      )}

      {modalCaixaAberto && (
        <AbrirCaixaBilheteriaModal
          eventoId={eventoId}
          bilheteria={modalCaixaAberto}
          onFechar={() => setModalCaixaAberto(null)}
          onAberto={async () => { setModalCaixaAberto(null); await carregar() }}
        />
      )}
    </>
  )

  return embutido ? conteudo : <div className="min-h-dvh bg-[#070707]">{conteudo}</div>
}

// Criação E edição do local de bilheteria — nome + (só na criação) "quantos
// caixas esse local vai ter?" (mesmo padrão de "quantos portões" do
// Estacionamento). Editar não mexe na quantidade — pra adicionar mais
// depois é o botão "Abrir caixa" de cada local.
function BilheteriaModal({ eventoId, bilheteria, onFechar, onSalvo }: {
  eventoId: string
  bilheteria?: Bilheteria
  onFechar: () => void
  onSalvo: () => void
}) {
  const editando = !!bilheteria
  const [nome, setNome] = useState(bilheteria?.nome ?? '')
  const [qtdCaixas, setQtdCaixas] = useState(1)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async () => {
    if (!nome.trim()) return
    setSalvando(true); setErro(null)
    try {
      const url    = editando ? `/api/eventos/${eventoId}/bilheterias/${bilheteria.id}` : `/api/eventos/${eventoId}/bilheterias`
      const method = editando ? 'PATCH' : 'POST'
      const res = await apiFetchAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editando ? { nome: nome.trim() } : { nome: nome.trim(), quantidadeCaixas: qtdCaixas }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? (editando ? 'Erro ao salvar' : 'Erro ao criar')); return }
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
            {editando ? `Editar ${bilheteria.nome}` : 'Novo local de bilheteria'}
          </p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          <input type="text" placeholder="Nome (ex: Bilheteria A) *" value={nome}
            onChange={e => setNome(e.target.value)} className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />

          {!editando && (
            <>
              <p className="text-[#444] text-[11px] uppercase tracking-wider">Quantos caixas essa bilheteria vai ter?</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(qtd => (
                  <button key={qtd} type="button" onClick={() => setQtdCaixas(qtd)}
                    className={cn(
                      'py-2.5 rounded-xl border text-xs font-medium transition-all',
                      qtdCaixas === qtd ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white' : 'bg-[#111] border-[#1c1c1c] text-[#777]'
                    )}>
                    {qtd}
                  </button>
                ))}
              </div>
              <p className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Cria os caixas já abertos, sem operador — "Caixa 1", "Caixa 2"... Qualquer vendedor designado pra
                este local pode entrar em qualquer um deles depois. Precisa de mais? Dá pra abrir mais caixas
                depois, um de cada vez, com o botão &quot;Abrir caixa&quot;.
              </p>
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

// Abrir UM caixa a mais num local já existente, com operador+fundo — mesmo
// componente/fluxo de AbrirCaixaModal em GerenciadorEstacionamentos.tsx, só
// trocando estacionamentoId por bilheteriaId e o endpoint correspondente.
function AbrirCaixaBilheteriaModal({ eventoId, bilheteria, onFechar, onAberto }: {
  eventoId: string
  bilheteria: Bilheteria
  onFechar: () => void
  onAberto: () => void
}) {
  const [nome, setNome] = useState('Caixa novo')
  const [fundoInicial, setFundoInicial] = useState(0)
  const [calcAberta, setCalcAberta] = useState(false)
  const [operador, setOperador] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [acessoOwner, setAcessoOwner] = useState<AcessoCaixa | null>(null)
  const [operadorAcesso, setOperadorAcesso] = useState<{ nome: string; token: string | null } | null>(null)

  const salvar = async () => {
    if (!nome.trim()) return
    setSalvando(true); setErro(null)
    try {
      const res = await apiFetchAuth(`/api/bilheteria/${eventoId}/abrir-caixa`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nome:                  nome.trim(),
          fundoInicial,
          operadorEmailOuCodigo: operador.trim() || undefined,
          bilheteriaId:          bilheteria.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.message ?? data.error ?? 'Erro ao abrir caixa'); return }
      if (data.operador_acesso) {
        setOperadorAcesso({ nome: operador.trim(), token: data.operador_acesso.token ?? null })
      } else if (data.owner_acesso?.precisa_criar_pin) {
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

  if (operadorAcesso) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
          <p className="text-white text-sm font-medium mb-1 flex items-center gap-1.5">
            <Wallet size={14} className="text-green-400" /> Caixa aberto
          </p>
          <p className="text-[#666] text-xs mb-4">
            Repasse esse token pra {operadorAcesso.nome} entrar no caixa dela.
          </p>
          <TokenParaOperador nome={operadorAcesso.nome} token={operadorAcesso.token} />
          <button
            type="button" onClick={onAberto}
            className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-[#070707]"
            style={{ background: '#E8B84B' }}
          >
            Concluir
          </button>
        </div>
      </div>
    )
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
          <div>
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Abrir caixa</p>
            <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Vinculado a <span style={{ color: ACCENT }}>{bilheteria.nome}</span>
            </p>
          </div>
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
          <input type="text" placeholder="E-mail ou código T7-USR do operador (opcional)" value={operador}
            onChange={e => setOperador(e.target.value)} className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            O operador precisa já estar convidado como equipe ativa com a permissão de vender ingresso neste evento.
          </p>
        </div>

        {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando || !nome.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : 'Abrir caixa'}
        </button>

        {calcAberta && (
          <CalculadoraDinheiro
            label={`Fundo inicial — ${nome || 'caixa'}`}
            valor={fundoInicial}
            onChange={setFundoInicial}
            onClose={() => setCalcAberta(false)}
          />
        )}
      </div>
    </div>
  )
}
