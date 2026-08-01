'use client'

import { useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react'

export interface BannerSistema {
  id:          string
  image_url:   string
  active:      boolean
  order_index: number
  created_at:  string
}

const ACCENT = '#E8B84B'

export function BannersPromocionaisClient({ bannersIniciais }: { bannersIniciais: BannerSistema[] }) {
  const [banners, setBanners] = useState(bannersIniciais)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setEnviando(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res  = await fetch('/api/admin/banners-sistema', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao enviar imagem'); return }
      setBanners(prev => [data.banner, ...prev])
    } catch {
      setErro('Erro de conexão ao enviar a imagem')
    } finally {
      setEnviando(false)
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, active } : b))
    await fetch(`/api/admin/banners-sistema/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active }),
    }).catch(() => { /* reverte visualmente na próxima carga se falhar */ })
  }

  async function handleDelete(id: string) {
    setBanners(prev => prev.filter(b => b.id !== id))
    await fetch(`/api/admin/banners-sistema/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon size={14} className="text-[#555]" />
        <h2 className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-outfit)' }}>
          Banners promocionais
        </h2>
      </div>
      <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        Imagens de divulgação da própria plataforma (não de um evento específico) — entram no giro do carrossel de destaques da home, junto com os eventos.
      </p>

      {erro && <p className="text-red-400 text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

      <div className="flex flex-wrap gap-3">
        {/* Botão de adicionar */}
        <label className="w-32 h-20 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
          style={{ background: `${ACCENT}0a`, border: `1px dashed ${ACCENT}40` }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
          />
          {enviando
            ? <Loader2 size={18} className="animate-spin" style={{ color: ACCENT }} />
            : <Plus size={18} style={{ color: ACCENT }} />
          }
          <span className="text-[11px] font-medium" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
            {enviando ? 'Enviando...' : 'Adicionar banner'}
          </span>
        </label>

        {banners.map(banner => (
          <div key={banner.id}
            className="relative w-32 h-20 rounded-2xl overflow-hidden shrink-0 group"
            style={{ border: '1px solid #1a1a1a' }}>
            <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleActive(banner.id, !banner.active)}
                className="text-[10px] font-semibold px-2 py-1 rounded-full transition-all"
                style={{
                  background: banner.active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.10)',
                  color:      banner.active ? '#4ade80' : '#999',
                  fontFamily: 'var(--font-dm-sans)',
                }}>
                {banner.active ? 'Ativo' : 'Inativo'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(banner.id)}
                className="text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 transition-all"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontFamily: 'var(--font-dm-sans)' }}>
                <Trash2 size={10} /> Remover
              </button>
            </div>
            {!banner.active && (
              <div className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#999', fontFamily: 'var(--font-dm-sans)' }}>
                Inativo
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
