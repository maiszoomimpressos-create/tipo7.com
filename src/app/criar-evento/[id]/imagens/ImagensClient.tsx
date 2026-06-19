'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, ArrowRight, Upload, X, ImageIcon,
  Loader2, Check, Plus, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  eventoId:           string
  bannerUrlInicial:   string | null
  galleryUrlsIniciais: string[]
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_MB  = 10

// ─── Upload para Supabase Storage ────────────────────────────────────────────

async function uploadImagem(
  supabase: ReturnType<typeof createClient>,
  file: File,
  path: string,
): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Imagem maior que ${MAX_MB} MB`)
  const { error } = await supabase.storage
    .from('event-images')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('event-images').getPublicUrl(path)
  return data.publicUrl
}

// ─── Preview de imagem com botão remover ─────────────────────────────────────
// aspectRatio: proporção fixa do container — banner usa '780/420' (mesma do carrossel)

function ImagePreview({
  url,
  onRemove,
  label,
  aspectRatio,
}: {
  url: string
  onRemove: () => void
  label?: string
  aspectRatio?: string
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-[#222]">
      {label && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/60 text-[#E8B84B]"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {label}
        </span>
      )}
      {/* Container com proporção fixa — garante que o promotor veja o corte exato do carrossel */}
      <div className="w-full overflow-hidden" style={{ aspectRatio: aspectRatio ?? 'auto' }}>
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
      <button type="button" onClick={onRemove}
        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/70 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Zona de upload (drag & drop) ─────────────────────────────────────────────

function DropZone({
  onFile,
  uploading,
  label,
  hint,
}: {
  onFile: (f: File) => void
  uploading: boolean
  label: string
  hint?: string
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) onFile(f)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 select-none',
        drag
          ? 'border-[#E8B84B]/60 bg-[#E8B84B]/5'
          : 'border-[#222] hover:border-[#333] hover:bg-white/[0.015]',
        uploading && 'pointer-events-none opacity-60',
      )}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

      {uploading
        ? <Loader2 size={28} className="text-[#E8B84B] animate-spin" />
        : <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#1c1c1c] flex items-center justify-center">
            <Upload size={20} className="text-[#444]" />
          </div>
      }

      <div className="text-center">
        <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
        {hint && <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{hint}</p>}
        <p className="text-[#333] text-[11px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Arraste ou clique · JPG, PNG, WEBP · máx {MAX_MB} MB
        </p>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ImagensClient({ eventoId, bannerUrlInicial, galleryUrlsIniciais }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  // cacheBust força o browser a ignorar o cache quando o banner é re-enviado
  const [cacheBust,   setCacheBust]   = useState(() => Date.now())
  const [bannerUrl,   setBannerUrl]   = useState<string | null>(bannerUrlInicial)
  const [galleryUrls, setGalleryUrls] = useState<string[]>(galleryUrlsIniciais)

  const [uploadingBanner,  setUploadingBanner]  = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [erro,             setErro]             = useState<string | null>(null)

  // ── Upload banner ──────────────────────────────────────────────────────────

  const handleBanner = async (file: File) => {
    setUploadingBanner(true); setErro(null)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const url = await uploadImagem(supabase, file, `${eventoId}/banner.${ext}`)
      setBannerUrl(url)
      setCacheBust(Date.now())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar imagem')
    } finally { setUploadingBanner(false) }
  }

  // ── Upload galeria ─────────────────────────────────────────────────────────

  const handleGallery = async (file: File) => {
    setUploadingGallery(true); setErro(null)
    try {
      const name = `gallery_${Date.now()}_${file.name.replace(/\s/g, '_')}`
      const url  = await uploadImagem(supabase, file, `${eventoId}/${name}`)
      setGalleryUrls(prev => [...prev, url])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar imagem')
    } finally { setUploadingGallery(false) }
  }

  const removeGallery = (idx: number) =>
    setGalleryUrls(prev => prev.filter((_, i) => i !== idx))

  // ── Salvar URLs no banco ───────────────────────────────────────────────────

  const handleSalvar = async (continuar = false) => {
    setSaving(true); setErro(null)
    try {
      const { error } = await supabase.from('events').update({
        banner_url:   bannerUrl,
        gallery_urls: galleryUrls,
      }).eq('id', eventoId)
      if (error) throw error

      if (continuar) {
        router.push(`/criar-evento/${eventoId}/publicar`)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally { setSaving(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Voltar */}
      <button type="button" onClick={() => router.push(`/criar-evento/${eventoId}/ingressos`)}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        Voltar para ingressos
      </button>

      {/* ── Banner principal ───────────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-[#E8B84B]" />
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Banner principal
            </p>
          </div>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Aparece no topo da página do evento e nos cards de listagem
          </p>
        </div>
        <div className="p-6">
          {bannerUrl
            ? <ImagePreview
                url={`${bannerUrl}?t=${cacheBust}`}
                label="Prévia do carrossel"
                aspectRatio="780/420"
                onRemove={() => setBannerUrl(null)}
              />
            : <DropZone
                onFile={handleBanner}
                uploading={uploadingBanner}
                label="Adicionar banner"
                hint="Proporção ideal: 780 × 420 px (16:9)"
              />
          }
          {bannerUrl && (
            <button type="button"
              onClick={() => setBannerUrl(null)}
              className="mt-3 flex items-center gap-1.5 text-[#444] hover:text-red-400 text-xs transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Trash2 size={12} /> Remover banner
            </button>
          )}
        </div>
      </div>

      {/* ── Galeria de fotos ───────────────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <div className="flex items-center gap-2">
            <Plus size={14} className="text-[#E8B84B]" />
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Galeria de fotos
              <span className="text-[#444] font-normal text-xs ml-2">(opcional)</span>
            </p>
          </div>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Fotos adicionais exibidas na página do evento
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          {/* Grid de fotos existentes */}
          {galleryUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {galleryUrls.map((url, i) => (
                <ImagePreview
                  key={i}
                  url={url}
                  onRemove={() => removeGallery(i)}
                />
              ))}
            </div>
          )}

          {/* Zona de upload galeria */}
          <DropZone
            onFile={handleGallery}
            uploading={uploadingGallery}
            label="Adicionar foto"
          />
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
      )}

      {/* ── Botões ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 sticky bottom-4">
        <button type="button" onClick={() => handleSalvar(false)}
          disabled={saving}
          className="flex-none px-5 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40 bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {saved ? <><Check size={15} /><span>Salvo!</span></> : <span>Salvar rascunho</span>}
        </button>
        <button type="button" onClick={() => handleSalvar(true)}
          disabled={saving}
          className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
          {saving
            ? <Loader2 size={15} className="animate-spin" />
            : <><span>Salvar e continuar</span><ArrowRight size={15} /></>
          }
        </button>
      </div>

    </div>
  )
}
