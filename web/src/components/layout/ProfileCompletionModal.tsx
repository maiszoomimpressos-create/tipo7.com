'use client'

// Modal progressivo de completar perfil
// Busca os dados atuais do banco e exibe apenas os campos que ainda faltam
// Aparece uma vez por sessão enquanto houver campos de endereço vazios
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useProfileStatus } from '@/hooks/useProfileStatus'
import { MapPin, X, Loader2, ArrowRight, CheckCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlaceSuggestion {
  placeId: string
  nomePrincipal: string
  nomeSecundario: string
}

const SESSION_KEY = 'tipo7_perfil_modal_visto'

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
}

export function ProfileCompletionModal() {
  const { user }                                   = useAuth()
  const { incompleto, camposFaltando, carregando } = useProfileStatus()
  const supabase                                   = createClient()

  const [visivel,    setVisivel]    = useState(false)
  const [dispensado, setDispensado] = useState(false)
  const [buscando,   setBuscando]   = useState(false) // carregando dados do banco

  // Dados do endereço — pré-preenchidos com o que já existe no banco
  const [zipCode,      setZipCode]      = useState('')
  const [street,       setStreet]       = useState('')
  const [number,       setNumber]       = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city,         setCity]         = useState('')
  const [uf,           setUf]           = useState('')
  const [addrType,     setAddrType]     = useState<'casa' | 'apartamento' | ''>('')
  const [complement,   setComplement]   = useState('')

  // Quais campos de endereço ainda estão faltando (calculado após buscar o banco)
  const [camposVazios, setCamposVazios] = useState<string[]>([])

  const [cepLoading, setCepLoading] = useState(false)
  const [cepError,   setCepError]   = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  // ── Busca de endereço via Google Places ──
  const [addrQuery,       setAddrQuery]       = useState('')
  const [addrSuggestions, setAddrSuggestions] = useState<PlaceSuggestion[]>([])
  const [addrSearching,   setAddrSearching]   = useState(false)
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)
  const addrDropdownRef = useRef<HTMLDivElement>(null)
  const addrDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Decide se deve mostrar o modal
  useEffect(() => {
    if (carregando || !user || !incompleto || dispensado) return
    if (sessionStorage.getItem(SESSION_KEY)) return

    const camposBasicos = ['full_name', 'phone', 'cpf', 'birth_date']
    const faltaEndereco = camposFaltando.some(c => !camposBasicos.includes(c.campo))
    if (!faltaEndereco) return

    const timer = setTimeout(() => setVisivel(true), 2000)
    return () => clearTimeout(timer)
  }, [carregando, user, incompleto, camposFaltando, dispensado])

  // Quando o modal abre, busca os dados atuais do banco para pré-preencher
  useEffect(() => {
    if (!visivel || !user) return

    setBuscando(true)
    supabase
      .from('profiles')
      .select('zip_code, street, street_number, neighborhood, city, state, address_type, complement')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return

        // Pré-preenche com o que já existe
        if (data.zip_code)      setZipCode(formatCEP(data.zip_code))
        if (data.street)        setStreet(data.street)
        if (data.street_number) setNumber(data.street_number)
        if (data.neighborhood)  setNeighborhood(data.neighborhood)
        if (data.city)          setCity(data.city)
        if (data.state)         setUf(data.state)
        if (data.address_type)  setAddrType(data.address_type as 'casa' | 'apartamento')
        if (data.complement)    setComplement(data.complement)

        // Calcula quais campos ainda estão vazios
        const vazios: string[] = []
        if (!data.zip_code)      vazios.push('zip_code')
        if (!data.street)        vazios.push('street')
        if (!data.street_number) vazios.push('street_number')
        if (!data.neighborhood)  vazios.push('neighborhood')
        if (!data.address_type)  vazios.push('address_type')
        setCamposVazios(vazios)

        setBuscando(false)
      })
  }, [visivel, user])

  // ── Fecha dropdown ao clicar fora ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addrDropdownRef.current && !addrDropdownRef.current.contains(e.target as Node))
        setShowAddrDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscarEnderecoSugestoes = useCallback((valor: string) => {
    if (addrDebounceRef.current) clearTimeout(addrDebounceRef.current)
    if (!valor || valor.length < 3) { setAddrSuggestions([]); setShowAddrDropdown(false); return }
    addrDebounceRef.current = setTimeout(async () => {
      setAddrSearching(true)
      try {
        const res  = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(valor)}`)
        const data = await res.json()
        setAddrSuggestions(data.suggestions ?? [])
        setShowAddrDropdown((data.suggestions ?? []).length > 0)
      } catch { setAddrSuggestions([]) }
      finally { setAddrSearching(false) }
    }, 350)
  }, [])

  const selecionarEndereco = async (s: PlaceSuggestion) => {
    setAddrQuery(s.nomePrincipal)
    setShowAddrDropdown(false)
    setAddrSuggestions([])
    try {
      const res  = await fetch(`/api/places/details?place_id=${s.placeId}`)
      const data = await res.json()
      if (data.cep)    { setZipCode(formatCEP(data.cep)); setCepError(null) }
      if (data.rua)    setStreet(data.rua)
      if (data.numero) setNumber(data.numero)
      if (data.bairro) setNeighborhood(data.bairro)
      if (data.cidade) setCity(data.cidade)
      if (data.estado) setUf(data.estado.slice(0, 2).toUpperCase())
    } catch { /* usuário pode preencher manualmente */ }
  }

  const fechar = () => {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDispensado(true)
    setVisivel(false)
  }

  const buscarCEP = async (cepFormatado: string) => {
    const digitos = cepFormatado.replace(/\D/g, '')
    if (digitos.length !== 8) return
    setCepLoading(true)
    setCepError(null)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const data = await res.json()
      if (data.erro) { setCepError('CEP não encontrado.'); return }
      setStreet(data.logradouro ?? '')
      setNeighborhood(data.bairro    ?? '')
      setCity(data.localidade ?? '')
      setUf(data.uf          ?? '')
    } catch {
      setCepError('Erro ao buscar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  const handleCEP = (v: string) => {
    const f = formatCEP(v)
    setZipCode(f)
    setCepError(null)
    if (f.replace(/\D/g,'').length === 8) buscarCEP(f)
  }

  // Ativa o salvar se qualquer campo vazio foi preenchido agora
  const temAlgoCampo = !!(
    (camposVazios.includes('zip_code')      && zipCode)       ||
    (camposVazios.includes('street')        && street)        ||
    (camposVazios.includes('street_number') && number)        ||
    (camposVazios.includes('neighborhood')  && neighborhood)  ||
    (camposVazios.includes('address_type')  && addrType)
  )

  const handleSalvar = async () => {
    if (!user || !temAlgoCampo) return
    setSaving(true)
    try {
      const dados: Record<string, string | null> = {}
      if (zipCode)      dados.zip_code      = zipCode.replace(/\D/g,'')
      if (street)       dados.street        = street
      if (number)       dados.street_number = number
      if (neighborhood) dados.neighborhood  = neighborhood
      if (city)         dados.city          = city
      if (uf)           dados.state         = uf
      if (addrType)     dados.address_type  = addrType
      if (complement)   dados.complement    = complement

      await supabase.from('profiles').update(dados).eq('id', user.id)
      setSaved(true)
      setTimeout(() => { fechar(); window.location.reload() }, 1500)
    } finally {
      setSaving(false)
    }
  }

  if (!visivel) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">

        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

        <div className="p-6">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232,184,75,0.12)' }}>
                <MapPin size={16} className="text-[#E8B84B]" />
              </div>
              <div>
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Complete seu endereço
                </p>
                <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Necessário para comprar ingressos
                </p>
              </div>
            </div>
            <button type="button" onClick={fechar} className="text-[#444] hover:text-[#777] transition-colors mt-0.5">
              <X size={16} />
            </button>
          </div>

          {/* Carregando dados do banco */}
          {buscando && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-[#E8B84B]" />
            </div>
          )}

          {/* Salvo com sucesso */}
          {!buscando && saved && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle size={32} className="text-green-500" />
              <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>Endereço salvo!</p>
            </div>
          )}

          {/* Formulário com apenas os campos faltando */}
          {!buscando && !saved && (
            <div className="flex flex-col gap-4">

              {/* Busca de endereço via Google Places */}
              <div className="flex flex-col gap-1.5" ref={addrDropdownRef}>
                <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Buscar endereço
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={addrQuery}
                    onChange={e => { setAddrQuery(e.target.value); buscarEnderecoSugestoes(e.target.value) }}
                    onFocus={() => addrSuggestions.length > 0 && setShowAddrDropdown(true)}
                    placeholder="Digite sua rua, bairro ou cidade..."
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-10 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444]">
                    {addrSearching
                      ? <Loader2 size={14} className="animate-spin text-[#E8B84B]" />
                      : <Search size={14} />
                    }
                  </div>
                  {showAddrDropdown && addrSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                      {addrSuggestions.map((s, i) => (
                        <button key={s.placeId} type="button"
                          onMouseDown={() => selecionarEndereco(s)}
                          className={cn(
                            'w-full text-left px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex flex-col gap-0.5',
                            i > 0 && 'border-t border-[#1a1a1a]'
                          )}
                        >
                          <span className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomePrincipal}</span>
                          {s.nomeSecundario && (
                            <span className="text-[#555] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{s.nomeSecundario}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CEP — só aparece se estiver vazio */}
              {camposVazios.includes('zip_code') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>CEP</label>
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric"
                      value={zipCode} onChange={e => handleCEP(e.target.value)}
                      placeholder="00000-000"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                    {cepLoading && <Loader2 size={14} className="animate-spin text-[#E8B84B] absolute right-3.5 top-1/2 -translate-y-1/2" />}
                  </div>
                  {cepError && <p className="text-red-400 text-xs">{cepError}</p>}

                  {/* Campos preenchidos pelo CEP — aparecem após busca bem-sucedida */}
                  {street && (
                    <div className="grid grid-cols-[1fr_90px] gap-2 mt-1">
                      <input type="text" value={street} onChange={e => setStreet(e.target.value)}
                        placeholder="Rua"
                        className="bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      />
                      <input type="text" value={city} onChange={e => setCity(e.target.value)}
                        placeholder="Cidade"
                        className="bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Rua — só aparece se estiver vazio */}
              {camposVazios.includes('street') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>Rua / Logradouro</label>
                  <input
                    type="text" value={street} onChange={e => setStreet(e.target.value)}
                    placeholder="Ex: Rua das Flores"
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                </div>
              )}

              {/* Número — só aparece se estiver vazio */}
              {camposVazios.includes('street_number') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Número da residência
                  </label>
                  <input
                    type="text" value={number} onChange={e => setNumber(e.target.value)}
                    placeholder="Ex: 42"
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                </div>
              )}

              {/* Bairro — só aparece se estiver vazio */}
              {camposVazios.includes('neighborhood') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>Bairro</label>
                  <input
                    type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)}
                    placeholder="Ex: Centro"
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                </div>
              )}

              {/* Tipo — só aparece se estiver vazio */}
              {camposVazios.includes('address_type') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Tipo de residência
                  </label>
                  <div className="flex gap-2">
                    {(['casa', 'apartamento'] as const).map(tipo => (
                      <button key={tipo} type="button" onClick={() => setAddrType(tipo)}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200',
                          addrType === tipo
                            ? 'bg-[#E8B84B] text-[#070707] border-[#E8B84B]'
                            : 'bg-transparent text-[#666] border-[#222] hover:border-[#444]'
                        )}
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {tipo === 'casa' ? 'Casa' : 'Apartamento'}
                      </button>
                    ))}
                  </div>
                  {addrType === 'apartamento' && (
                    <input type="text" value={complement} onChange={e => setComplement(e.target.value)}
                      placeholder="Ex: Apto 42, Bloco B"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838] mt-1"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  )}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 mt-1">
                <button type="button" onClick={fechar}
                  className="flex-1 py-2.5 rounded-xl text-sm text-[#555] border border-[#1c1c1c] hover:text-[#888] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Agora não
                </button>
                <button type="button" onClick={handleSalvar}
                  disabled={saving || !temAlgoCampo}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-40 flex items-center justify-center gap-2 transition-all hover:brightness-110"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {saving
                    ? <Loader2 size={14} className="animate-spin" />
                    : <><span>Salvar</span><ArrowRight size={14} /></>
                  }
                </button>
              </div>

              <a href="/perfil" onClick={fechar}
                className="text-center text-[#333] text-xs hover:text-[#555] transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                Preencher tudo no perfil completo
              </a>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
