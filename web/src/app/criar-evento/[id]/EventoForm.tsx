'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Check, Lock, User, MapPin, Search, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlaceSuggestion {
  placeId:        string
  nomePrincipal:  string
  nomeSecundario: string
}

interface Responsavel {
  nome: string; cpf: string; telefone: string; email: string
}

interface Inicial {
  titulo: string; descricao: string; categoria: string
  dataInicio: string; dataFim: string
  nomeLocal: string; venueId: string | null
  cep: string; rua: string; numero: string
  bairro: string; cidade: string; estado: string; complemento: string
  capacidade: string
}

interface Props {
  eventoId:    string
  tipoPessoa:  'pf' | 'pj' | null
  responsavel: Responsavel | null
  inicial:     Inicial
}

const CATEGORIAS = [
  'Show','Festa','Festival','Teatro','Esporte',
  'Gastronomia','Arte','Tecnologia','Religioso','Outro',
]

const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g,'').slice(0,8)
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
}

const toDateInput = (iso: string) => iso ? new Date(iso).toISOString().slice(0,16) : ''

const diaSemana = (dt: string) => {
  if (!dt) return null
  const d = new Date(dt)
  if (isNaN(d.getTime())) return null
  return `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}`
}

const inputCls = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'
const labelCls = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

export function EventoForm({ eventoId, tipoPessoa, responsavel, inicial }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  // Seção 1
  const [titulo,    setTitulo]    = useState(inicial.titulo === 'Novo evento' ? '' : inicial.titulo)
  const [descricao, setDescricao] = useState(inicial.descricao)
  const [categoria, setCategoria] = useState(inicial.categoria)

  // Seção 2
  const [dataInicio, setDataInicio] = useState(toDateInput(inicial.dataInicio))
  const [dataFim,    setDataFim]    = useState(toDateInput(inicial.dataFim))
  const [duracao,    setDuracao]    = useState('')
  const [numDias,    setNumDias]    = useState(1)

  // Seção 3 — local (com suporte a venue salvo)
  const [nomeLocal,      setNomeLocal]      = useState(inicial.nomeLocal)
  const [venueId,        setVenueId]        = useState<string | null>(inicial.venueId)
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedLat,    setSelectedLat]    = useState<number | null>(null)
  const [selectedLng,    setSelectedLng]    = useState<number | null>(null)

  const [suggestions,   setSuggestions]   = useState<PlaceSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cep,         setCep]         = useState(formatCEP(inicial.cep))
  const [rua,         setRua]         = useState(inicial.rua)
  const [numero,      setNumero]      = useState(inicial.numero)
  const [bairro,      setBairro]      = useState(inicial.bairro)
  const [cidade,      setCidade]      = useState(inicial.cidade)
  const [estado,      setEstado]      = useState(inicial.estado)
  const [complemento, setComplemento] = useState(inicial.complemento)
  const [capacidade,  setCapacidade]  = useState(inicial.capacidade)
  const [cepLoading,  setCepLoading]  = useState(false)
  const [cepError,    setCepError]    = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [erro,   setErro]   = useState<string | null>(null)

  const calcularFim = (inicio: string, dias: number, dur: string) => {
    if (!inicio) return
    const d = new Date(inicio)
    if (dias > 1) d.setDate(d.getDate() + (dias - 1))
    if (dur && !isNaN(parseFloat(dur))) {
      d.setMinutes(d.getMinutes() + Math.round(parseFloat(dur) * 60))
    }
    setDataFim(d.toISOString().slice(0, 16))
  }

  const handleDataInicio = (v: string) => {
    setDataInicio(v)
    if (v) calcularFim(v, numDias, duracao)
    else setDataFim(v)
  }

  const handleNumDias = (dias: number) => {
    setNumDias(dias)
    if (dataInicio) calcularFim(dataInicio, dias, duracao)
  }

  const handleDuracao = (v: string) => {
    setDuracao(v)
    const horas = parseFloat(v)
    if (dataInicio && v && !isNaN(horas)) {
      const d = new Date(dataInicio)
      if (numDias > 1) d.setDate(d.getDate() + (numDias - 1))
      d.setMinutes(d.getMinutes() + Math.round(horas * 60))
      setDataFim(d.toISOString().slice(0, 16))
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscarSugestoes = useCallback((valor: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!valor || valor.length < 2) { setSuggestions([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res  = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(valor)}`)
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
        setShowDropdown((data.suggestions ?? []).length > 0)
      } catch { setSuggestions([]) }
      finally { setSearchLoading(false) }
    }, 350)
  }, [])

  const selecionarLocal = async (s: PlaceSuggestion) => {
    setNomeLocal(s.nomePrincipal)
    setShowDropdown(false)
    setSuggestions([])
    setSelectedPlaceId(s.placeId)
    setVenueId(null) // será definido no save
    try {
      const res  = await fetch(`/api/places/details?place_id=${s.placeId}`)
      const data = await res.json()
      if (data.cep)    { setCep(formatCEP(data.cep)); setCepError(null) }
      if (data.rua)    setRua(data.rua)
      if (data.numero) setNumero(data.numero)
      if (data.bairro) setBairro(data.bairro)
      if (data.cidade) setCidade(data.cidade)
      if (data.estado) setEstado(data.estado.slice(0, 2).toUpperCase())
      if (data.lat != null) setSelectedLat(data.lat)
      if (data.lng != null) setSelectedLng(data.lng)
    } catch { /* usuário pode preencher manualmente */ }
  }

  // Quando o usuário digita manualmente, limpa o placeId selecionado
  const handleNomeLocalChange = (v: string) => {
    setNomeLocal(v)
    if (selectedPlaceId) { setSelectedPlaceId(null); setSelectedLat(null); setSelectedLng(null) }
    buscarSugestoes(v)
  }

  const buscarCEP = async (valor: string) => {
    const digitos = valor.replace(/\D/g,'')
    if (digitos.length !== 8) return
    setCepLoading(true); setCepError(null)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const d   = await res.json()
      if (d.erro) { setCepError('CEP não encontrado.'); return }
      setRua(d.logradouro ?? ''); setBairro(d.bairro ?? '')
      setCidade(d.localidade ?? ''); setEstado(d.uf ?? '')
    } catch { setCepError('Erro ao buscar o CEP.') }
    finally { setCepLoading(false) }
  }

  const handleCEP = (v: string) => {
    const f = formatCEP(v); setCep(f); setCepError(null)
    if (f.replace(/\D/g,'').length === 8) buscarCEP(f)
  }

  const podeContinuar = !!(
    titulo.trim() && titulo.trim() !== 'Novo evento' &&
    dataInicio &&
    (cidade.trim() || nomeLocal.trim())
  )

  const handleSalvar = async (continuar = false) => {
    setSaving(true); setErro(null); setSaved(false)
    try {
      let venueIdToSave = venueId

      // Se um local do Google Places foi selecionado, upsert na tabela venues
      if (selectedPlaceId) {
        const { data: venue } = await supabase
          .from('venues')
          .upsert({
            name:            nomeLocal.trim(),
            google_place_id: selectedPlaceId,
            zip_code:        cep.replace(/\D/g,'')  || null,
            street:          rua                     || null,
            street_number:   numero                  || null,
            neighborhood:    bairro                  || null,
            city:            cidade                  || null,
            state:           estado                  || null,
            lat:             selectedLat,
            lng:             selectedLng,
          }, { onConflict: 'google_place_id' })
          .select('id')
          .single()
        if (venue) {
          venueIdToSave = venue.id
          setVenueId(venue.id)
        }
      }

      await supabase.from('events').update({
        title:         titulo.trim()         || 'Novo evento',
        description:   descricao             || null,
        category:      categoria             || null,
        date_start:    dataInicio            || null,
        date_end:      dataFim               || null,
        venue_name:    nomeLocal.trim()      || null,
        venue_id:      venueIdToSave,
        zip_code:      cep.replace(/\D/g,'') || null,
        street:        rua                   || null,
        street_number: numero                || null,
        neighborhood:  bairro               || null,
        city:          cidade                || null,
        state:         estado                || null,
        complement:    complemento           || null,
        capacity:      capacidade ? parseInt(capacidade, 10) : null,
      }).eq('id', eventoId)

      if (continuar) {
        router.push(`/criar-evento/${eventoId}/ingressos`)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { setErro('Erro ao salvar. Tente novamente.') }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Voltar */}
      <button type="button" onClick={() => router.push('/criar-evento')}
        className="flex items-center gap-2 text-[#555] hover:text-white transition-colors text-sm w-fit"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ArrowLeft size={15} />
        Voltar para meus eventos
      </button>

      {/* ── SEÇÃO 1: Informações gerais ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Informações gerais</p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome, descrição e categoria</p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome do evento</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Festival de Verão 2027" maxLength={120}
              className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            <span className="text-[#333] text-xs self-end" style={{ fontFamily: 'var(--font-dm-sans)' }}>{titulo.length}/120</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Conte mais sobre o evento, atrações, programação..."
              rows={4} maxLength={1000}
              className={cn(inputCls,'resize-none')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            <span className="text-[#333] text-xs self-end" style={{ fontFamily: 'var(--font-dm-sans)' }}>{descricao.length}/1000</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Categoria</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map(c => (
                <button key={c} type="button" onClick={() => setCategoria(p => p === c ? '' : c)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                    categoria === c
                      ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                      : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                  )}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 2: Data e horário ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Data e horário</p>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Quando o evento começa e termina</p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Início</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>Duração em dias</span>
                {[1,2,3,4,5].map(d => (
                  <button key={d} type="button" onClick={() => handleNumDias(d)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-semibold border transition-all duration-200',
                      numDias === d
                        ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                        : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {d}
                  </button>
                ))}
                <input
                  type="number" min="1" max="365" placeholder="+"
                  value={[1,2,3,4,5].includes(numDias) ? '' : numDias}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1) handleNumDias(v)
                  }}
                  className="w-9 h-7 rounded-lg text-xs text-center text-white border border-[#222] bg-transparent outline-none focus:border-[#E8B84B]/40 placeholder:text-[#333]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <span className="text-[#333] text-[10px] ml-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {numDias === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            </div>
            <input type="datetime-local" value={dataInicio}
              onChange={e => handleDataInicio(e.target.value)}
              className={cn(inputCls,'text-[#bbb] [color-scheme:dark]')}
              style={{ fontFamily: 'var(--font-dm-sans)' }} />
            {diaSemana(dataInicio) && (
              <span className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {diaSemana(dataInicio)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Duração do evento{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(opcional — calcula o encerramento)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {['2','4','6','8','12','18','24','Outra'].map(h => (
                <button key={h} type="button"
                  onClick={() => h === 'Outra' ? setDuracao('') : handleDuracao(h)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                    duracao === h
                      ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                      : 'bg-transparent text-[#555] border-[#222] hover:border-[#444] hover:text-[#888]'
                  )}
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {h === 'Outra' ? 'Outra' : `${h}h`}
                </button>
              ))}
              <input type="number" min="0.5" max="72" step="0.5"
                placeholder="Ex: 5.5"
                value={['2','4','6','8','12','18','24'].includes(duracao) ? '' : duracao}
                onChange={e => handleDuracao(e.target.value)}
                className="w-24 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Encerramento{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(ajuste se necessário)</span>
            </label>
            <input type="datetime-local" value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className={cn(inputCls,'text-[#bbb] [color-scheme:dark]')}
              style={{ fontFamily: 'var(--font-dm-sans)' }} />
            {diaSemana(dataFim) && (
              <span className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {diaSemana(dataFim)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 3: Local do evento ── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#141414]">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-[#E8B84B]" />
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Local do evento</p>
          </div>
          <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Busque pelo nome do local — o endereço é preenchido automaticamente e salvo na plataforma
          </p>
        </div>
        <div className="p-6 flex flex-col gap-4">

          {/* Busca Google Places */}
          <div className="flex flex-col gap-1.5" ref={dropdownRef}>
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome do local</label>
            <div className="relative">
              <input
                type="text"
                value={nomeLocal}
                onChange={e => handleNomeLocalChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Ex: Allianz Parque, Arena Fonte Nova..."
                className={cn(inputCls, 'pr-9')}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444]">
                {searchLoading ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" /> : <Search size={14} />}
              </div>

              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.placeId}
                      type="button"
                      onMouseDown={() => selecionarLocal(s)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex flex-col gap-0.5',
                        i > 0 && 'border-t border-[#1a1a1a]'
                      )}
                    >
                      <span className="text-white text-sm font-medium truncate"
                            style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomePrincipal}</span>
                      {s.nomeSecundario && (
                        <span className="text-[#555] text-xs truncate"
                              style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomeSecundario}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Indica se local foi vinculado a um venue salvo */}
            {venueId && (
              <p className="text-green-400 text-xs flex items-center gap-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Check size={11} /> Local salvo na plataforma
              </p>
            )}
            {selectedPlaceId && !venueId && (
              <p className="text-[#E8B84B] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Local será salvo ao gravar
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>CEP</label>
            <div className="relative">
              <input type="text" inputMode="numeric" value={cep}
                onChange={e => handleCEP(e.target.value)} placeholder="00000-000"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              {cepLoading && <Loader2 size={14} className="animate-spin text-[#E8B84B] absolute right-3.5 top-1/2 -translate-y-1/2" />}
            </div>
            {cepError && <p className="text-red-400 text-xs">{cepError}</p>}
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Rua / Logradouro</label>
              <input type="text" value={rua} onChange={e => setRua(e.target.value)} placeholder="Rua das Flores"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Número</label>
              <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Bairro</label>
              <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Complemento <span className="text-[#333] normal-case tracking-normal font-normal">(opcional)</span>
              </label>
              <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Pavilhão A..."
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Cidade</label>
              <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Curitiba"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Estado</label>
              <input type="text" value={estado} onChange={e => setEstado(e.target.value.toUpperCase().slice(0,2))} placeholder="PR"
                className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Capacidade do local{' '}
              <span className="text-[#333] normal-case tracking-normal font-normal">(número máximo de pessoas)</span>
            </label>
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={e => setCapacidade(e.target.value)}
              placeholder="Ex: 1000"
              className={inputCls}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
            <p className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              A soma de todos os ingressos não pode ultrapassar este limite.
            </p>
          </div>
        </div>
      </div>

      {/* Responsável — somente PF, somente leitura */}
      {tipoPessoa === 'pf' && responsavel && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Responsável pelo evento</p>
              <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Dados vinculados ao seu perfil — edite em{' '}
                <a href="/perfil" className="text-[#E8B84B] hover:underline">Meu perfil</a>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Lock size={11} /><span>Somente leitura</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-[#111] rounded-xl border border-[#1a1a1a]">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#070707] shrink-0"
                 style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}>
              {responsavel.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{responsavel.nome}</p>
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{responsavel.email}</p>
            </div>
            <User size={14} className="text-[#2a2a2a] ml-auto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'CPF',      value: responsavel.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') },
              { label: 'Telefone', value: responsavel.telefone },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-3 py-2.5">
                  <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{value || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {erro && <p className="text-red-400 text-sm text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

      {/* Botões de ação fixos */}
      <div className="flex gap-3 sticky bottom-4">
        <button type="button" onClick={() => handleSalvar(false)} disabled={saving}
          className={cn(
            'py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-40',
            podeContinuar
              ? 'flex-none px-5 bg-[#111] border border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]'
              : 'flex-1 text-[#070707] hover:brightness-110'
          )}
          style={{
            background: podeContinuar ? undefined : '#E8B84B',
            fontFamily: 'var(--font-dm-sans)',
          }}>
          {saving && !podeContinuar
            ? <Loader2 size={15} className="animate-spin" />
            : saved ? <><Check size={15} /><span>Salvo!</span></>
            : <span>Salvar rascunho</span>
          }
        </button>

        {podeContinuar && (
          <button type="button" onClick={() => handleSalvar(true)} disabled={saving}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
            {saving
              ? <Loader2 size={15} className="animate-spin" />
              : <><span>Salvar e continuar</span><ArrowRight size={15} /></>
            }
          </button>
        )}
      </div>

    </div>
  )
}
