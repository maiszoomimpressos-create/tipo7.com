'use client'

import { useState, useEffect, useCallback } from 'react'
import { Layers, Plus, Loader2, ArrowUpRight, X, Ticket, Car } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCENT = '#E8B84B'

interface EventoFilho {
  id:         string
  title:      string
  status:     string
  date_start: string | null
  created_at: string
}

interface Props {
  eventoId:      string
  isChild:       boolean // este evento já é filho de outro — não pode ter filhos
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  rascunho:  { label: 'Rascunho',  cor: '#666'  },
  publicado: { label: 'Publicado', cor: '#4ade80' },
  cancelado: { label: 'Cancelado', cor: '#f87171' },
  encerrado: { label: 'Encerrado', cor: '#666'  },
}

export function PainelEventosFilhos({ eventoId, isChild }: Props) {
  const [filhos, setFilhos]         = useState<EventoFilho[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  const carregar = useCallback(async () => {
    const res  = await fetch(`/api/eventos/${eventoId}/criar-filho`)
    const data = await res.json()
    setFilhos(data.filhos ?? [])
    setCarregando(false)
  }, [eventoId])

  useEffect(() => { carregar() }, [carregar])

  if (isChild) return null

  return (
    <div className="rounded-2xl overflow-hidden mt-4" style={{ border: '1px solid #1a1a1a', background: '#0a0a0a' }}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: ACCENT }} />
          <span className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Eventos filhos
          </span>
        </div>
        <button type="button" onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#070707]"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          <Plus size={12} /> Criar evento filho
        </button>
      </div>

      <div className="px-4 pb-4">
        {carregando && <Loader2 size={16} className="animate-spin text-[#E8B84B] mx-auto my-4" />}
        {!carregando && filhos.length === 0 && (
          <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum evento filho ainda — use pra uma atração à parte dentro deste evento (ex: uma tenda com show cobrado à parte).
          </p>
        )}
        <div className="flex flex-col gap-2">
          {filhos.map(f => {
            const st = STATUS_LABEL[f.status] ?? STATUS_LABEL.rascunho
            return (
              <a key={f.id} href={`/evento/${f.id}`}
                className="flex items-center justify-between gap-3 bg-[#111] border border-[#1c1c1c] rounded-xl px-3 py-2.5 hover:border-[#2a2a2a] transition-colors">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{f.title}</p>
                  <span className="text-xs" style={{ color: st.cor, fontFamily: 'var(--font-dm-sans)' }}>{st.label}</span>
                </div>
                <ArrowUpRight size={13} className="text-[#444] shrink-0" />
              </a>
            )
          })}
        </div>
      </div>

      {modalAberto && (
        <CriarEventoFilhoModal
          eventoId={eventoId}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}

function CriarEventoFilhoModal({ eventoId, onFechar }: { eventoId: string; onFechar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [moduloIngressos, setModuloIngressos] = useState(true)
  const [moduloEstacionamento, setModuloEstacionamento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const nenhumModulo = !moduloIngressos && !moduloEstacionamento

  const salvar = async () => {
    if (!titulo.trim() || nenhumModulo) return
    setSalvando(true); setErro(null)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/criar-filho`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ titulo: titulo.trim(), moduloIngressos, moduloEstacionamento }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao criar evento filho'); return }
      window.location.href = `/criar-evento/${data.id}`
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Criar evento filho</p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <input type="text" placeholder="Nome do evento filho *" value={titulo}
          onChange={e => setTitulo(e.target.value)} autoFocus
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 mb-4"
          style={{ fontFamily: 'var(--font-dm-sans)' }} />

        <p className="text-[#444] text-[11px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          O que esse evento filho vai ter
        </p>
        <div className="flex flex-col gap-2 mb-4">
          {([
            { checked: moduloIngressos,      onChange: setModuloIngressos,      icon: Ticket, label: 'Ingressos' },
            { checked: moduloEstacionamento, onChange: setModuloEstacionamento, icon: Car,    label: 'Estacionamento' },
          ]).map(({ checked, onChange, icon: Icon, label }) => (
            <button key={label} type="button" onClick={() => onChange(!checked)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                checked ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35' : 'bg-[#111] border-[#1c1c1c]'
              )}>
              <Icon size={14} className={checked ? 'text-[#E8B84B]' : 'text-[#444]'} />
              <span className={cn('text-xs font-medium', checked ? 'text-white' : 'text-[#777]')} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {nenhumModulo && <p className="text-red-400 text-xs text-center mb-3">Selecione ao menos um item acima</p>}
        {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando || !titulo.trim() || nenhumModulo}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : 'Criar'}
        </button>
      </div>
    </div>
  )
}
