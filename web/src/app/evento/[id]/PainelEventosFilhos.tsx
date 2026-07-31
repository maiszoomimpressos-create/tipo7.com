'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tent, Plus, Loader2, ArrowUpRight, X, Upload, ImageIcon, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  isChild:       boolean // este evento já é filho de outro — não pode ter Tendas
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
          <Tent size={13} style={{ color: ACCENT }} />
          <span className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
            Tendas
          </span>
        </div>
        <button type="button" onClick={() => setModalAberto(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#070707]"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          <Plus size={12} /> Tenda
        </button>
      </div>

      <div className="px-4 pb-4">
        {carregando && <Loader2 size={16} className="animate-spin text-[#E8B84B] mx-auto my-4" />}
        {!carregando && filhos.length === 0 && (
          <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhuma Tenda ainda — use pra uma atração à parte dentro deste evento, com ingresso próprio (ex: um show cobrado à parte, em outro palco).
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
        <CriarTendaModal
          eventoId={eventoId}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  )
}

// Cria uma Tenda: nome + imagem só, direto ao ponto. Ingressos on-line e
// venda no caixa compartilhado do pai já vêm ligados por padrão — quem
// quiser desligar ajusta depois na tela de edição do evento.
function CriarTendaModal({ eventoId, onFechar }: { eventoId: string; onFechar: () => void }) {
  const supabase = createClient()
  const [titulo, setTitulo] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function selecionarBanner(f: File) {
    setBannerFile(f)
    setBannerPreview(URL.createObjectURL(f))
  }

  const salvar = async () => {
    if (!titulo.trim()) return
    setSalvando(true); setErro(null)
    try {
      const res = await fetch(`/api/eventos/${eventoId}/criar-filho`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          titulo:                  titulo.trim(),
          moduloIngressos:         true,
          moduloEstacionamento:    false,
          moduloTenda:             true,
          permitirVendaNoCaixaPai: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao criar a Tenda'); return }

      // Imagem é opcional aqui — não bloqueia a criação se falhar, dá pra
      // subir depois na etapa de Imagens normalmente.
      if (bannerFile) {
        try {
          const ext = bannerFile.name.split('.').pop() ?? 'jpg'
          const path = `${data.id}/banner.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('event-images')
            .upload(path, bannerFile, { upsert: true, contentType: bannerFile.type })
          if (!uploadErr) {
            const { data: pub } = supabase.storage.from('event-images').getPublicUrl(path)
            await supabase.from('events').update({ banner_url: pub.publicUrl }).eq('id', data.id)
          }
        } catch { /* segue sem banner, promotor sobe depois */ }
      }

      // Já herda data e local do pai — pula Informações, vai direto pra
      // escolha de dias + ingressos.
      window.location.href = `/criar-evento/${data.id}/ingressos`
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Criar Tenda</p>
          <button onClick={onFechar} className="text-[#444] hover:text-[#777]"><X size={16} /></button>
        </div>

        <input type="text" placeholder="Nome da Tenda *" value={titulo}
          onChange={e => setTitulo(e.target.value)} autoFocus
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 mb-4"
          style={{ fontFamily: 'var(--font-dm-sans)' }} />

        {/* Banner opcional — pode subir aqui, ou depois na etapa de Imagens */}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) selecionarBanner(f) }} />
        {bannerPreview ? (
          <div className="relative rounded-xl overflow-hidden border border-[#222] mb-5" style={{ aspectRatio: '780/420' }}>
            <img src={bannerPreview} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(null) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/70 flex items-center justify-center text-white hover:bg-red-500/80">
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-3 rounded-xl mb-5 text-left transition-all"
            style={{ background: '#111', border: '1px dashed #2a2a2a' }}>
            <div className="w-9 h-9 rounded-lg bg-[#161616] flex items-center justify-center shrink-0">
              <ImageIcon size={15} className="text-[#444]" />
            </div>
            <div className="flex-1">
              <span className="text-[#999] text-xs font-medium block" style={{ fontFamily: 'var(--font-dm-sans)' }}>Adicionar imagem (opcional)</span>
              <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Pode subir agora ou depois</span>
            </div>
            <Upload size={14} className="text-[#444] shrink-0" />
          </button>
        )}

        {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

        <button type="button" onClick={salvar} disabled={salvando || !titulo.trim()}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : 'Criar'}
        </button>
      </div>
    </div>
  )
}
