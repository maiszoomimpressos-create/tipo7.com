'use client'

import { useRef, useState } from 'react'
import { GalleryHorizontal, ImagePlus, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

const ACCENT = '#E8B84B'

interface Slide {
  id:        string
  image_url: string
}

interface Props {
  orgId:         string
  slidesIniciais: Slide[]
}

export function CarrosselClient({ orgId, slidesIniciais }: Props) {
  const [slides,      setSlides]      = useState<Slide[]>(slidesIniciais)
  const [previewIdx,  setPreviewIdx]  = useState(0)
  const [uploading,   setUploading]   = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [erro,        setErro]        = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setErro(null)
    setUploading(true)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 5 * 1024 * 1024) { setErro(`"${file.name}" excede 5 MB.`); continue }

      const form = new FormData()
      form.append('file',   file)
      form.append('org_id', orgId)

      const res  = await fetch('/api/carrossel/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) { setErro(data.error ?? 'Erro ao fazer upload'); continue }

      setSlides(prev => [...prev, { id: data.id, image_url: data.image_url }])
    }
    setUploading(false)
  }

  async function deletar(id: string) {
    setDeletingId(id)
    await fetch(`/api/carrossel/${id}`, { method: 'DELETE' })
    setSlides(prev => {
      const next = prev.filter(s => s.id !== id)
      if (previewIdx >= next.length) setPreviewIdx(Math.max(0, next.length - 1))
      return next
    })
    setDeletingId(null)
  }

  const slideAtual = slides[previewIdx] ?? null

  return (
    <div className="flex flex-col gap-8">

      {/* ── Preview da segunda tela ─────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#070707', border: '1px solid #1a1a1a' }}
      >
        {/* Barra superior simulada */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: '1px solid #111' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-syne)' }}>
            tipo7.com
          </p>
          <p className="text-[#333] text-sm font-bold" style={{ fontFamily: 'var(--font-outfit)' }}>
            pré-visualização
          </p>
        </div>

        {/* Área da imagem */}
        <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#0a0a0a' }}>
          {slideAtual ? (
            <img
              key={slideAtual.id}
              src={slideAtual.image_url}
              alt="Slide"
              className="w-full h-full object-cover"
              style={{ opacity: 0.85 }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <GalleryHorizontal size={40} className="text-[#1a1a1a]" />
              <p className="text-[#2a2a2a] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Faça upload de imagens para ver a pré-visualização
              </p>
            </div>
          )}

          {/* Navegação */}
          {slides.length > 1 && (
            <>
              <button
                onClick={() => setPreviewIdx(i => (i - 1 + slides.length) % slides.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft size={18} className="text-white" />
              </button>
              <button
                onClick={() => setPreviewIdx(i => (i + 1) % slides.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronRight size={18} className="text-white" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIdx(i)}
                    className="rounded-full transition-all"
                    style={{
                      width:      i === previewIdx ? 18 : 6,
                      height:     6,
                      background: i === previewIdx ? ACCENT : 'rgba(255,255,255,0.25)',
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Badge bilheteria aberta */}
          {slideAtual && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div
                className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
                  Bilheteria aberta
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Grid de imagens + upload ────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Imagens do carrossel
            </p>
            <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {slides.length} imagem{slides.length !== 1 ? 'ns' : ''} · JPG, PNG ou WebP · máx. 5 MB cada
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: ACCENT, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}
          >
            {uploading
              ? <Loader2 size={14} className="animate-spin" />
              : <ImagePlus size={14} />
            }
            {uploading ? 'Enviando...' : 'Adicionar imagem'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {erro && (
          <p className="text-red-400 text-xs mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {erro}
          </p>
        )}

        {slides.length === 0 ? (
          /* Área de drop vazia */
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-14 transition-all"
            style={{ border: '2px dashed #1a1a1a', background: '#0d0d0d' }}
          >
            <ImagePlus size={32} className="text-[#2a2a2a]" />
            <p className="text-[#333] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Clique para adicionar a primeira imagem
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className="relative rounded-xl overflow-hidden group cursor-pointer"
                style={{
                  aspectRatio: '1',
                  border: i === previewIdx ? `2px solid ${ACCENT}` : '2px solid transparent',
                  background: '#111',
                }}
                onClick={() => setPreviewIdx(i)}
              >
                <img src={slide.image_url} alt="" className="w-full h-full object-cover" />

                {/* Overlay com número e botão de deletar */}
                <div
                  className="absolute inset-0 flex flex-col items-end justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); deletar(slide.id) }}
                    disabled={deletingId === slide.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    {deletingId === slide.id
                      ? <Loader2 size={12} className="text-red-400 animate-spin" />
                      : <Trash2 size={12} className="text-red-400" />
                    }
                  </button>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: i === previewIdx ? ACCENT : '#888', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {i + 1}/{slides.length}
                  </span>
                </div>
              </div>
            ))}

            {/* Botão inline para adicionar mais */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{ aspectRatio: '1', border: '2px dashed #1a1a1a', background: '#0d0d0d' }}
            >
              {uploading
                ? <Loader2 size={20} className="text-[#333] animate-spin" />
                : <ImagePlus size={20} className="text-[#2a2a2a]" />
              }
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
