'use client'

import { useState } from 'react'
import {
  CalendarPlus, Plus, Pencil, Trash2,
  ExternalLink, ImageIcon, Ticket, Settings, AlertTriangle, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TipoPessoaModal, type ProfileData } from './TipoPessoaModal'

interface EventoItem {
  id:         string
  title:      string
  status:     'rascunho' | 'publicado'
  date_start: string | null
  created_at: string
}

interface Props {
  promotorId:      string | null
  tipoPessoaAtual: 'pf' | 'pj' | null
  nomeUsuario:     string
  profile:         ProfileData
  eventos:         EventoItem[]
}

const labelTipo = { pf: 'Pessoa física', pj: 'Pessoa jurídica' }

const MESES_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const formatData = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`
}

// ── Modal de confirmação de exclusão ──────────────────────────────────────
function ConfirmDeleteModal({
  titulo,
  onConfirm,
  onCancel,
  loading,
}: {
  titulo:    string
  onConfirm: () => void
  onCancel:  () => void
  loading:   boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-6"
        style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Excluir evento?</p>
            <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Esta ação não pode ser desfeita</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-[#333] hover:text-[#666] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="mb-5 px-3 py-2.5 rounded-xl" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
          <p className="text-[#888] text-sm truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{titulo || 'Sem nome'}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm text-[#555] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ background: '#dc2626', fontFamily: 'var(--font-dm-sans)' }}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function CriarEventoClient({ promotorId, tipoPessoaAtual, nomeUsuario, profile, eventos: inicial }: Props) {
  const [modalAberto,    setModalAberto]    = useState(false)
  const [lista,          setLista]          = useState<EventoItem[]>(inicial)
  const [excluindo,      setExcluindo]      = useState<string | null>(null)
  const [confirmarId,    setConfirmarId]    = useState<string | null>(null)
  const supabase = createClient()

  const abrirConfirmar = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setConfirmarId(id)
  }

  const excluirEvento = async () => {
    if (!confirmarId) return
    setExcluindo(confirmarId)
    await supabase.from('events').delete().eq('id', confirmarId)
    setLista(prev => prev.filter(r => r.id !== confirmarId))
    setConfirmarId(null)
    setExcluindo(null)
  }

  const eventoConfirmar = lista.find(e => e.id === confirmarId)

  return (
    <>
      <div className="flex flex-col gap-8">

        {lista.length > 0 && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
                Meus eventos
              </h2>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {lista.length} {lista.length === 1 ? 'evento' : 'eventos'}
              </p>
            </div>
            <button type="button" onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              <Plus size={14} />
              Novo evento
            </button>
          </div>
        )}

        {lista.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {lista.map(ev => (
              <div key={ev.id}
                className="group relative bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#2a2a2a] transition-colors">

                <div className="relative w-full h-[250px] bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                  <ImageIcon size={32} className="text-[#1e1e1e]" />

                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-4">
                    <a href={`/criar-evento/${ev.id}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <Settings size={11} /> Informações
                    </a>
                    <a href={`/criar-evento/${ev.id}/ingressos`}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <Ticket size={11} /> Ingressos
                    </a>
                    <a href={`/criar-evento/${ev.id}/imagens`}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <ImageIcon size={11} /> Imagens
                    </a>
                    {ev.status === 'publicado' && (
                      <a href={`/evento/${ev.id}`}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#E8B84B]/20 hover:bg-[#E8B84B]/30 text-[#E8B84B] text-xs font-medium transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        <ExternalLink size={11} /> Ver página
                      </a>
                    )}
                  </div>

                  {/* Botão excluir — abre modal de confirmação */}
                  <button type="button" onClick={e => abrirConfirmar(ev.id, e)}
                    disabled={excluindo === ev.id}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-[#444] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir">
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.status === 'publicado' ? 'bg-green-400' : 'bg-[#444]'}`} />
                    <p className="text-white text-sm font-medium truncate"
                       style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {ev.title}
                    </p>
                  </div>
                  <p className="text-[#444] text-[11px] pl-3.5"
                     style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {ev.date_start ? formatData(ev.date_start) : `Criado em ${new Date(ev.created_at).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>

              </div>
            ))}
          </div>
        )}

        {lista.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                 style={{ background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.2)' }}>
              <CalendarPlus size={28} className="text-[#E8B84B]" />
            </div>
            <h1 className="text-3xl text-white mb-3"
                style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
              Criar evento
            </h1>
            <p className="text-[#555] mb-8 max-w-sm mx-auto" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Seu cadastro está completo. Clique abaixo para começar.
            </p>
            <button type="button" onClick={() => setModalAberto(true)}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
              <Plus size={16} />
              Começar agora
            </button>

            {tipoPessoaAtual && (
              <div className="mt-5 inline-flex items-center gap-2 text-[#444] text-xs border border-[#1a1a1a] rounded-xl px-4 py-2.5"
                   style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <span className="text-[#555]">Atuando como</span>
                <span className="text-white font-medium">{labelTipo[tipoPessoaAtual]}</span>
                <button type="button" onClick={() => setModalAberto(true)}
                  className="text-[#333] hover:text-[#E8B84B] transition-colors ml-1">
                  <Pencil size={11} />
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal de criação */}
      {modalAberto && (
        <TipoPessoaModal
          promotorId={promotorId}
          tipoPessoaAtual={tipoPessoaAtual}
          nomeUsuario={nomeUsuario}
          profile={profile}
          onFechar={() => setModalAberto(false)}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmarId && eventoConfirmar && (
        <ConfirmDeleteModal
          titulo={eventoConfirmar.title}
          onConfirm={excluirEvento}
          onCancel={() => setConfirmarId(null)}
          loading={excluindo === confirmarId}
        />
      )}
    </>
  )
}
